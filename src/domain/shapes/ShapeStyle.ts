export class ShapeStyle {
  #values = new Map<string, string>();
  static readonly names: readonly string[] = ['fill', 'stroke', 'stroke-width'];
  get(name: string) { return this.#values.get(name); }
  set(name: string, value: string | undefined) {
    if (!ShapeStyle.names.includes(name)) throw new Error(`unknown attribute: ${name}`);
    if (name === 'stroke-width' && value !== undefined) {
      const number = Number(value);
      if (!value.trim() || !Number.isFinite(number) || number < 0) throw new Error('stroke-width must be finite and non-negative');
    }
    if (value === undefined) this.#values.delete(name); else this.#values.set(name, value);
  }
  get attributes(): Readonly<Record<string, string>> { return Object.freeze(Object.fromEntries(this.#values)); }
}
