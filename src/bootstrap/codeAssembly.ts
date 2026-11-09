import type { PluginHost } from './PluginHost.js';
import statsPlugin, { manifest as statsManifest } from '../../plugins/stats/src/index.js';
import dirPlugin, { manifest as dirManifest } from '../../plugins/dir/src/index.js';

/**
 * Route A assembly. Static imports keep module resolution independent of the
 * process working directory; the manifests come from the plugin sources so
 * they cannot drift from what `plugin.activate` registers.
 */
export async function load(host: PluginHost): Promise<void> {
  await host.load(statsPlugin, statsManifest);
  await host.load(dirPlugin, dirManifest);
}
