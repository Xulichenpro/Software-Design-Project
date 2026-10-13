import { Shape } from './Shape.js';
export class RectShape extends Shape {
 constructor(id: string, x: number, y: number, width: number, height: number) { super(id, { x, y, width, height }, ["width","height"]); }
 get tag() { return 'rect'; }
 protected get xKeys() { return ["x"]; }
 protected get yKeys() { return ["y"]; }
 protected override get geometryDescription() { return `x=${this.geometry.x} y=${this.geometry.y} w=${this.geometry.width} h=${this.geometry.height}`; }
}
