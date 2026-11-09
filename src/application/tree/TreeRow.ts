export interface TreeRow {
  readonly id: string | undefined;
  readonly kind: string | undefined;
  readonly isRoot: boolean;
  readonly base: string;
}
