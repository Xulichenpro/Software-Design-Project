import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Terminal } from '../application/contracts/Terminal.js';
import type { PluginContributes, PluginHost, PluginManifest, PluginModule } from './PluginHost.js';

interface PluginConfigEntry {
  readonly module: string;
  readonly enabled?: boolean;
  readonly options?: Readonly<Record<string, unknown>>;
}

interface LoadedManifest extends PluginManifest {
  readonly contributes?: PluginContributes;
}

/**
 * Configuration-driven assembly (route B). Resolves modules by string, reads
 * their manifest and delegates every acceptance decision to `PluginHost`.
 */
export class PluginLoader {
  constructor(private readonly host: PluginHost, private readonly terminal: Terminal) {}

  async load(configPath: string): Promise<void> {
    const entries = await this.#readConfig(configPath);
    if (!entries) { this.#error('invalid plugin config'); return; }
    const configDir = dirname(resolve(configPath));
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      await this.#loadEntry(entry, configDir, configPath);
    }
  }

  async #readConfig(configPath: string): Promise<readonly PluginConfigEntry[] | undefined> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(configPath, 'utf8'));
    } catch {
      return undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const plugins = (parsed as { plugins?: unknown }).plugins;
    if (!Array.isArray(plugins)) return undefined;
    const entries: PluginConfigEntry[] = [];
    for (const candidate of plugins) {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return undefined;
      const entry = candidate as Record<string, unknown>;
      if (typeof entry.module !== 'string' || !entry.module.trim()) return undefined;
      if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') return undefined;
      if (entry.options !== undefined && (typeof entry.options !== 'object' || entry.options === null || Array.isArray(entry.options))) {
        return undefined;
      }
      entries.push({
        module: entry.module,
        ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }),
        ...(entry.options === undefined ? {} : { options: entry.options as Readonly<Record<string, unknown>> }),
      });
    }
    return entries;
  }

  async #loadEntry(entry: PluginConfigEntry, configDir: string, configPath: string): Promise<void> {
    const resolved = await this.#resolveModule(entry.module, configDir, configPath);
    if (!resolved) { this.#error(`plugin not found: ${entry.module}`); return; }
    const manifest = await this.#readManifest(resolved, entry.module);
    let imported: unknown;
    try {
      imported = await import(pathToFileURL(resolved).href);
    } catch (error) {
      this.#error(`plugin failed to activate: ${manifest.name} (${reasonOf(error)})`);
      return;
    }
    const plugin = (imported as { default?: unknown } | null)?.default;
    if (plugin === undefined || plugin === null ||
      (typeof plugin !== 'object' && typeof plugin !== 'function')) {
      this.#error(`plugin has no default export: ${entry.module}`);
      return;
    }
    await this.host.load(plugin as PluginModule, manifest, entry.options);
  }

  async #resolveModule(raw: string, configDir: string, configPath: string): Promise<string | undefined> {
    if (!raw.startsWith('.') && !isAbsolute(raw)) {
      try {
        return createRequire(resolve(configPath)).resolve(raw);
      } catch {
        return undefined;
      }
    }
    const base = isAbsolute(raw) ? resolve(raw) : resolve(configDir, raw);
    if (await isFile(base)) return base;
    for (const candidate of [join(base, 'src', 'index.ts'), join(base, 'index.ts')]) {
      if (await isFile(candidate)) return candidate;
    }
    const packagePath = join(base, 'package.json');
    if (await isFile(packagePath)) {
      const main = await readPackageMain(packagePath);
      if (main) {
        const entry = resolve(base, main);
        if (await isFile(entry)) return entry;
      }
    }
    return undefined;
  }

  async #readManifest(resolved: string, moduleName: string): Promise<LoadedManifest> {
    let directory = dirname(resolved);
    for (;;) {
      const candidate = join(directory, 'package.json');
      if (await isFile(candidate)) {
        try {
          const parsed = JSON.parse(await readFile(candidate, 'utf8')) as Record<string, unknown>;
          const name = typeof parsed.name === 'string' && parsed.name ? parsed.name : moduleName;
          const contributes = parsed.contributes as PluginContributes | undefined;
          return contributes === undefined ? { name } : { name, contributes };
        } catch {
          return { name: moduleName };
        }
      }
      const parent = dirname(directory);
      if (parent === directory) return { name: moduleName };
      directory = parent;
    }
  }

  #error(message: string): void {
    this.terminal.writeLine(`error: ${message}`);
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function readPackageMain(packagePath: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(packagePath, 'utf8')) as { main?: unknown };
    return typeof parsed.main === 'string' ? parsed.main : undefined;
  } catch {
    return undefined;
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
