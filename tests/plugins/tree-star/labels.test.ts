import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';
import { ModifiedStarDecorator } from '../../../plugins/tree-star/src/ModifiedStarDecorator.js';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import type { TreeDecorator } from '../../../src/application/tree/TreeDecorator.js';
import type { TreeRow } from '../../../src/application/tree/TreeRow.js';
import {
  addBox, boxArguments, boxQuoted, createBoxEnvironment,
} from '../box/fixtures.js';
import type { BoxEnvironment } from '../box/fixtures.js';

function labelledEnvironment(decorators: readonly TreeDecorator[]) {
  const environment = createBoxEnvironment({ decorators });
  return { environment, executor: new CommandExecutor(environment.decorators, environment.tree) };
}

async function createBox(environment: BoxEnvironment, executor: CommandExecutor): Promise<void> {
  await executor.execute(new CreateCommand(
    environment.editor, 'box', 'n1', boxArguments(), undefined, [...boxQuoted],
  ));
}

function rows(environment: BoxEnvironment): readonly string[] {
  return environment.renderer.render(environment.tree).lines;
}

const baseRows = [
  'svg (800x600)',
  '└── g#n1',
  '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
  '    └── text#n1-label  (140,135) "开始"',
];

function starredRows(label: string): readonly string[] {
  return [
    'svg (800x600) *',
    `└── g#n1 ${label}`,
    '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9 *',
    '    └── text#n1-label  (140,135) "开始" *',
  ];
}

test('modified-star registered before box-type-label yields g#n1 * (box)', async () => {
  const { environment, executor } = labelledEnvironment([
    new ModifiedStarDecorator(), new BoxTypeDecorator(),
  ]);
  await createBox(environment, executor);
  assert.deepEqual(rows(environment), starredRows('* (box)'));
});

test('box-type-label registered before modified-star yields g#n1 (box) *', async () => {
  const { environment, executor } = labelledEnvironment([
    new BoxTypeDecorator(), new ModifiedStarDecorator(),
  ]);
  await createBox(environment, executor);
  assert.deepEqual(rows(environment), starredRows('(box) *'));
});

test('the two labels do not consult each other and each appends only its own suffix', async () => {
  const star = new ModifiedStarDecorator();
  const boxType = new BoxTypeDecorator();
  const environment = createBoxEnvironment({ decorators: [star, boxType] });
  const executor = new CommandExecutor(environment.decorators, environment.tree);
  await createBox(environment, executor);

  const boxRow: TreeRow = { id: 'n1', kind: 'box', isRoot: false, base: '└── g#n1' };
  const rectRow: TreeRow = { id: 'n1-rect', kind: 'rect', isRoot: false, base: '    ├── rect#n1-rect' };
  assert.equal(star.decorate(boxRow, environment.tree), '*');
  assert.equal(boxType.decorate(boxRow, environment.tree), '(box)');
  assert.equal(star.decorate(rectRow, environment.tree), '*');
  assert.equal(boxType.decorate(rectRow, environment.tree), undefined);

  const withoutStar = createBoxEnvironment({ decorators: [new ModifiedStarDecorator(), new BoxTypeDecorator()] });
  addBox(withoutStar, 'n1');
  assert.deepEqual(rows(withoutStar), baseRows.map(line => line === '└── g#n1' ? '└── g#n1 (box)' : line));
});

test('an empty suffix adds no space; without labels the base rows stay byte-for-byte identical', () => {
  const plain = createBoxEnvironment({ decorators: [] });
  addBox(plain, 'n1');
  assert.deepEqual(rows(plain), baseRows);

  const starOnly = createBoxEnvironment({ decorators: [new ModifiedStarDecorator()] });
  addBox(starOnly, 'n1');
  assert.deepEqual(rows(starOnly), baseRows, 'a clean modified-star row appends nothing, not even a space');

  const boxOnly = createBoxEnvironment({ decorators: [new BoxTypeDecorator()] });
  addBox(boxOnly, 'n1');
  assert.deepEqual(rows(boxOnly), baseRows.map(line => line === '└── g#n1' ? '└── g#n1 (box)' : line));
});
