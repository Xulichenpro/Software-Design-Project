import { DOMParser } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';

export class XmlParser {
  parse(text: string): Document & { readonly documentElement: Element } {
    const document = new DOMParser({
      onError: (_level, message) => { throw new Error(message); },
    }).parseFromString(text, 'image/svg+xml');
    if (!document.documentElement) throw new Error('Missing document element');
    return document as Document & { readonly documentElement: Element };
  }
}
