export abstract class EditRecord<T> {
  readonly #forward: T; readonly #inverse: T;
  constructor(forward: T, inverse: T) { this.#forward = Object.freeze(forward); this.#inverse = Object.freeze(inverse); }
  get forward(): T { return this.#forward; }
  get inverse(): T { return this.#inverse; }
}
