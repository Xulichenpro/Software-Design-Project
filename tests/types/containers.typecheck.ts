import type { GroupShape } from '../../src/domain/shapes/GroupShape.js';
import type { CanvasRoot } from '../../src/domain/tree/CanvasRoot.js';
import type { ChildCollection } from '../../src/domain/tree/ChildCollection.js';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type Assert<T extends true> = T;
type IsSame<T, Expected> = [T] extends [Expected] ? [Expected] extends [T] ? true : false : false;

export type GroupChildrenIsConcrete = Assert<IsAny<GroupShape['children']> extends false ? true : false>;
export type CanvasChildrenIsConcrete = Assert<IsAny<CanvasRoot['children']> extends false ? true : false>;
export type GroupChildrenIsCollection = Assert<IsSame<GroupShape['children'], ChildCollection>>;
export type CanvasChildrenIsCollection = Assert<IsSame<CanvasRoot['children'], ChildCollection>>;
