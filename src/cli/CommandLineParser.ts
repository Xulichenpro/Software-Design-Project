import type { ArgumentToken } from '../application/contracts/ArgumentToken.js';
import type { ParsedCommandLine } from '../application/contracts/ParsedCommandLine.js';
import { EditorError } from '../application/contracts/EditorError.js';

export class CommandLineParser {
  parse(line: string): ParsedCommandLine | undefined {
    if (!line.trim() || line.trimStart().startsWith('#')) return undefined;
    const tokens: ArgumentToken[] = [];
    let index = 0;
    while (index < line.length) {
      while (index < line.length && /\s/.test(line[index]!)) index++;
      if (index === line.length) break;
      const quoted = line[index] === '"';
      let value = '';
      if (quoted) {
        index++;
        let closed = false;
        while (index < line.length) {
          const character = line[index++]!;
          if (character === '"') { closed = true; break; }
          if (character === '\\') {
            const escaped = line[index++];
            if (escaped !== '"' && escaped !== '\\') throw new EditorError('unsupported escape in quoted argument');
            value += escaped;
          } else value += character;
        }
        if (!closed) throw new EditorError('unterminated quoted argument');
        if (index < line.length && !/\s/.test(line[index]!)) throw new EditorError('expected whitespace after closing quote');
      } else {
        while (index < line.length && !/\s/.test(line[index]!)) {
          const character = line[index++]!;
          if (character === '"') throw new EditorError('quote must begin an argument');
          value += character;
        }
      }
      tokens.push(Object.freeze({ value, quoted }));
    }
    const name = tokens[0]!;
    if (name.quoted) throw new EditorError('command name must be unquoted');
    return Object.freeze({ name: name.value, args: Object.freeze(tokens.slice(1)) });
  }
}
