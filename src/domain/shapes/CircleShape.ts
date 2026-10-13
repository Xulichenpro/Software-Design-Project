import { Shape } from './Shape.js';
export class CircleShape extends Shape {
 constructor(id: string, cx: number, cy: number, r: number) { super(id, { cx, cy, r }, ["r"]); }
 get tag() { return 'circle'; }
 protected get xKeys() { return ["cx"]; }
 protected get yKeys() { return ["cy"]; }
}
