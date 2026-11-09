import type { Document, Element } from '@xmldom/xmldom';
import sax from 'sax';

export interface SourceRange {
  readonly start: number;
  readonly end: number;
  readonly nameStart: number;
  readonly nameEnd: number;
}

export class SourceRangeIndex {
  build(text: string, document: Document): ReadonlyMap<Element, SourceRange> {
    const elements: Element[] = [];
    const collect = (element: Element) => {
      elements.push(element);
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1) collect(child as Element);
      }
    };
    if (!document.documentElement) throw new Error('Missing document element');
    collect(document.documentElement);

    const ranges = new Map<Element, SourceRange>();
    const stack: Array<{ element: Element; start: number; nameStart: number; nameEnd: number }> = [];
    const source = sax.parser(true, { position: true });
    let next = 0;
    source.onerror = error => { throw error; };
    source.onopentag = tag => {
      const element = elements[next++];
      if (!element || element.tagName !== tag.name) throw new Error('XML source does not match DOM');
      const start = source.startTagPosition - 1;
      stack.push({ element, start, nameStart: start + 1, nameEnd: start + 1 + tag.name.length });
    };
    source.onclosetag = name => {
      const entry = stack.pop();
      if (!entry || entry.element.tagName !== name) throw new Error('Unmatched XML element');
      ranges.set(entry.element, {
        start: entry.start,
        end: source.position,
        nameStart: entry.nameStart,
        nameEnd: entry.nameEnd,
      });
    };
    source.write(text).close();
    if (stack.length || next !== elements.length) throw new Error('Incomplete XML source ranges');
    return ranges;
  }
}
