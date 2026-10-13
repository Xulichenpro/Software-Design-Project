import { Shape } from './Shape.js';
export class LineShape extends Shape {
 constructor(id: string, x1: number, y1: number, x2: number, y2: number) { super(id, { x1, y1, x2, y2 }, []); }
 get tag() { return 'line'; }
 protected get xKeys() { return ["x1","x2"]; }
 protected get yKeys() { return ["y1","y2"]; }
 protected override get geometryDescription() { return `(${this.geometry.x1},${this.geometry.y1}) -> (${this.geometry.x2},${this.geometry.y2})`; }
}

