import type { PluginHost } from './PluginHost.js';

/**
 * Route A assembly. Phase 1 has no optional plugins, so this is intentionally
 * empty; later phases add static imports here.
 */
export async function load(_host: PluginHost): Promise<void> {}
