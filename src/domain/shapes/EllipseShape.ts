import { Shape } from './Shape.js';
export class EllipseShape extends Shape {
 constructor(id: string, cx: number, cy: number, rx: number, ry: number) { super(id, { cx, cy, rx, ry }, ["rx","ry"]); }
 get tag() { return 'ellipse'; }
 protected get xKeys() { return ["cx"]; }
 protected get yKeys() { return ["cy"]; }
}

