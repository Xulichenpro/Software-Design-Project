/** Read-only view of a shape handed to attribute handlers. */
export interface ReadonlyShape {
  readonly id: string;
  readonly kind: string;
  readonly tag: string;
  readonly label: string;
  readonly descendants: readonly ReadonlyShape[];
  getAttribute(name: string): string | undefined;
}
