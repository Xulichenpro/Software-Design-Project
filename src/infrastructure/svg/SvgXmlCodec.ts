import { DOMParser, DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import type { Element, Node, Document } from '@xmldom/xmldom';
import type { SvgCodec } from '../../application/contracts/SvgCodec.js';
import type { SvgImportResult } from '../../application/contracts/SvgImportResult.js';
import { EditorError } from '../../application/contracts/EditorError.js';
import { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { ShapeFactory } from '../../domain/factory/ShapeFactory.js';
import type { SvgElement } from '../../domain/representation/SvgElement.js';

export class SvgXmlCodec implements SvgCodec {
  static readonly namespace = 'http://www.w3.org/2000/svg';
  constructor(private readonly factory: ShapeFactory) {}
  decode(text: string): SvgImportResult {
    let document: Document;
    try {
      document = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(text, 'image/svg+xml');
    } catch { throw new EditorError('invalid SVG XML'); }
    if (document.doctype) throw new EditorError('SVG document types are unsupported');
    const root = document.documentElement;
    if (!root || root.tagName !== 'svg') throw new EditorError('expected svg root element');
    this.validateNamespace(root);
    for (let i = 0; i < root.attributes.length; i++) {
      const attribute = root.attributes.item(i)!;
      if (!['xmlns', 'width', 'height', 'viewBox'].includes(attribute.name)) throw new EditorError(`unknown attribute: ${attribute.name}`);
    }
    const number = (name: string) => {
      const value = root.getAttribute(name); if (!value?.trim() || !Number.isFinite(Number(value))) throw new EditorError(`${name} must be finite`);
      return Number(value);
    };
    const width = number('width'); const height = number('height'); const tree = new ShapeTree(); tree.initialize(width, height);
    if (root.hasAttribute('viewBox')) {
      const values = root.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number);
      if (values.length !== 4 || values.some((value, index) => value !== [0, 0, width, height][index])) throw new EditorError('unsupported viewBox');
    }
    const reserved = new Set<string>();
    const reserve = (element: Element) => {
      if (element.hasAttribute('id')) {
        const id = element.getAttribute('id')!;
        if (reserved.has(id)) throw new EditorError(`id already exists: ${id}`); reserved.add(id);
      }
      for (const child of this.elementChildren(element)) reserve(child);
    };
    for (const child of this.elementChildren(root)) reserve(child);
    const counters = new Map<string, number>(); const warnings: string[] = [];
    const representation = (element: Element): SvgElement => {
      this.validateNamespace(element);
      const attributes: Record<string, string> = Object.create(null);
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i)!;
        if (attr.name === 'xmlns' && attr.value === SvgXmlCodec.namespace) continue;
        attributes[attr.name] = attr.value;
      }
      if (!element.hasAttribute('id')) {
        let index = counters.get(element.tagName) ?? 0; let id: string;
        do { id = element.tagName + ++index; } while (reserved.has(id));
        counters.set(element.tagName, index); reserved.add(id); attributes.id = id;
        warnings.push(`assigned id ${id} to unnamed <${element.tagName}>`);
      }
      let content = '';
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3 || child.nodeType === 4) content += child.nodeValue ?? '';
        else if (child.nodeType !== 1 && child.nodeType !== 8) throw new EditorError('unsupported SVG node');
      }
      return { tag: element.tagName, attributes, text: content, children: this.elementChildren(element).map(representation) };
    };
    for (let node = root.firstChild; node; node = node.nextSibling) {
      if ((node.nodeType === 3 || node.nodeType === 4) && node.nodeValue?.trim()) throw new EditorError('unexpected text in svg');
    }
    const shapes = this.elementChildren(root).map(element => this.factory.createFromSvgElement(representation(element)));
    tree.editStructure({ placements: shapes.map((shape, index) => ({ shape, parent: tree.root, index })) });
    return { tree, warnings: Object.freeze(warnings) };
  }
  encode(tree: ShapeTree): string {
    const { width, height } = tree.canvasSize;
    const document = new DOMImplementation().createDocument(SvgXmlCodec.namespace, 'svg', null);
    const root = document.documentElement!;
    root.setAttribute('width', String(width)); root.setAttribute('height', String(height)); root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const append = (parent: Node, element: SvgElement) => {
      const node = document.createElementNS(SvgXmlCodec.namespace, element.tag);
      for (const [name, value] of Object.entries(element.attributes)) node.setAttribute(name, value);
      if (element.text !== undefined) node.appendChild(document.createTextNode(element.text));
      for (const child of element.children) append(node, child);
      parent.appendChild(node);
    };
    for (const shape of tree.root.children.items) append(root, shape.toSvgElement());
    const serialized = new XMLSerializer().serializeToString(document).replace(/\r/g, '&#13;');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized;
  }
  private validateNamespace(element: Element) {
    if (element.prefix || (element.namespaceURI && element.namespaceURI !== SvgXmlCodec.namespace)) throw new EditorError('unsupported SVG namespace');
  }
  private elementChildren(element: Element): Element[] {
    const result: Element[] = [];
    for (let child = element.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) result.push(child as Element);
    return result;
  }
}
