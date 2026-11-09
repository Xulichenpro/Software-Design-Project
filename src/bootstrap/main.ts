import { ApplicationBootstrap } from './ApplicationBootstrap.js';

const configIndex = process.argv.indexOf('--config');
const config = configIndex >= 0 ? process.argv[configIndex + 1] : undefined;

await new ApplicationBootstrap(undefined, undefined, config).run();
