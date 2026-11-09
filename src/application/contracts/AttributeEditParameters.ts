export interface AttributeEditRequest {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly quoted: boolean;
}

export interface AttributeWrite {
  readonly shapeId: string;
  readonly name: string;
  readonly value: string | undefined;
}

export interface AttributePatch {
  readonly writes: readonly AttributeWrite[];
  readonly lines: readonly string[];
}

export type AttributeEditParameters = AttributePatch;
