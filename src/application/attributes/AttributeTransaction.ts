/** Every handler write goes through this transaction so it can be rolled back. */
export interface AttributeTransaction {
  setAttribute(shapeId: string, name: string, value: string | undefined): void;
}
