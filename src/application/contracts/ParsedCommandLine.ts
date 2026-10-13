import type { ArgumentToken } from './ArgumentToken.js';
export interface ParsedCommandLine { readonly name: string; readonly args: readonly ArgumentToken[]; }
