import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const from = option('--from', 'final');
const to = option('--to', 'HEAD');
const label = option('--label', to);

function git(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const includePaths = ['src', 'plugins', 'scripts', 'package.json', 'tsconfig.json', 'plugins.config.json'];
const diff = git(['diff', '--numstat', from, to, '--', ...includePaths]);
const vscodeDiff = git(['diff', '--numstat', from, to, '--', 'extensions']);
const history = git(['log', '--format=%s', `${from}..${to}`]).split(/\r?\n/).filter(Boolean);

function parseNumstat(text) {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const [added, deleted, ...pathParts] = line.split('\t');
    const path = pathParts.join('\t');
    return {
      path,
      added: added === '-' ? 0 : Number(added),
      deleted: deleted === '-' ? 0 : Number(deleted),
    };
  });
}

function categoryOf(path) {
  if (path.startsWith('plugins/')) return 'plugin';
  if (path.startsWith('extensions/')) return 'vscode';
  if (path.startsWith('src/bootstrap/')) return 'assembly';
  if (path.startsWith('src/')) return 'kernel';
  return 'tooling';
}

const roles = new Map([
  ['src/domain/shapes/Shape.ts', '图形基类：kind/label/heading、几何与样式、SVG 编码'],
  ['src/domain/shapes/ShapeProvider.ts', '图形扩展点：容器能力、canUngroup、结构校验、data-kind'],
  ['src/domain/shapes/ShapeRegistration.ts', '图形注册项静态契约'],
  ['src/domain/shapes/ShapeCreationContext.ts', '复合图形递归创建上下文'],
  ['src/domain/shapes/ShapeSvgReadback.ts', '内置图形共用的参数与 SVG 读回规则'],
  ['src/domain/tree/ShapeTree.ts', '共享文档、id 索引、最终拓扑校验与结构提交'],
  ['src/domain/tree/ShapeTopology.ts', '结构校验的不可变最终拓扑视图'],
  ['src/domain/tree/DocumentView.ts', '文档只读视图契约（root/findShape/requireInitialized）'],
  ['src/application/registries/ShapeProviderRegistry.ts', '图形类对象注册表与 data-kind 读回选择'],
  ['src/application/registries/CommandRegistry.ts', '命令注册表与 unknown command 文案'],
  ['src/application/registries/AttributeHandlerRegistry.ts', '属性处理器注册表'],
  ['src/application/registries/TreeDecoratorRegistry.ts', '树标签注册表、Observer 转发与异常隔离'],
  ['src/application/attributes/AttributeService.ts', '零/一/多命中分派、默认白名单、事务回滚'],
  ['src/application/attributes/AttributeHandler.ts', '属性语义扩展点'],
  ['src/application/tree/TreeDecorator.ts', '树标签扩展点'],
  ['src/application/tree/TreeRenderer.ts', 'Phase 1 基础树行与标签拼接'],
  ['src/application/execution/CommandExecutor.ts', '历史双栈与 edited/history/barrier 事件通知'],
  ['src/application/execution/DocumentSnapshot.ts', '不可变前后文档快照'],
  ['src/bootstrap/builtinContributions.ts', '内置 19 命令与六种图形的装配字典'],
  ['src/bootstrap/PluginHost.ts', '插件暂存、manifest 校验、重名与整包回滚'],
  ['src/bootstrap/PluginLoader.ts', '配置读取、模块解析与委托 Host 加载'],
  ['src/bootstrap/ApplicationBootstrap.ts', '一次性装配四个 Registry 并启动 CLI'],
  ['src/bootstrap/codeAssembly.ts', '方式 A 顶层代码装配入口（加载 stats/dir/box/tree-star）'],
  ['src/bootstrap/main.ts', '进程入口与 --config 选择'],
  ['src/extension-api/index.ts', '插件唯一公开导入入口（只做 re-export）'],
  ['scripts/metrics.mjs', '从 Git 历史生成 docs/metrics 报告'],
  ['plugins.config.json', '方式 B 插件配置（stats/dir/box/tree-star）'],
  ['package.json', '测试、metrics、构建脚本'],
  ['tsconfig.json', 'TypeScript 编译范围'],
  ['plugins/stats/src/StatsCommand.ts', 'stats 插件：只读容器/叶子统计'],
  ['plugins/stats/src/index.ts', 'stats 插件注册入口'],
  ['plugins/dir/src/DirCommand.ts', 'dir 插件：目录排序与两空格格式化'],
  ['plugins/dir/src/DirectoryReader.ts', 'dir 目录访问 Target 接口'],
  ['plugins/dir/src/NodeDirectoryAdapter.ts', 'Node 文件系统 Adapter'],
  ['plugins/dir/src/index.ts', 'dir 插件注册入口'],
  ['plugins/box/src/BoxShape.ts', 'box 复合图形：模板、容器能力与结构校验'],
  ['plugins/box/src/BoxAttributeHandler.ts', 'box fill/label 领域语义'],
  ['plugins/box/src/BoxTypeDecorator.ts', 'box 树标签 (box)'],
  ['plugins/box/src/index.ts', 'box 插件注册入口'],
  ['plugins/tree-star/src/ModifiedStarDecorator.ts', 'modified-star 标签状态机'],
  ['plugins/tree-star/src/index.ts', 'tree-star 插件注册入口'],
]);

function duty(path) {
  const exact = roles.get(path);
  if (exact) return exact;
  if (path.startsWith('src/domain/shapes/')) return '内置图形具体类：静态创建/读回与多态几何';
  if (path.startsWith('src/domain/tree/')) return '树与容器领域实现';
  if (path.startsWith('src/application/registries/')) return '扩展注册表';
  if (path.startsWith('src/application/attributes/')) return '属性扩展点与事务';
  if (path.startsWith('src/application/contracts/')) return '命令/文档/属性公开契约';
  if (path.startsWith('src/application/commands/')) return '具体命令实现';
  if (path.startsWith('src/application/receivers/')) return '命令 receiver';
  if (path.startsWith('src/application/records/')) return '编辑记录';
  if (path.startsWith('src/application/tree/')) return '树标签与渲染';
  if (path.startsWith('src/application/execution/')) return '命令执行与文档事件';
  if (path.startsWith('src/bootstrap/')) return '装配层';
  if (path.startsWith('src/infrastructure/')) return '基础设施适配器';
  if (path.startsWith('src/cli/')) return 'CLI 输入输出';
  if (path.startsWith('src/extension-api/')) return '插件公开入口';
  if (path.startsWith('src/')) return '内核源码';
  if (path.startsWith('plugins/')) return '插件包';
  if (path.startsWith('scripts/')) return '仓库脚本';
  return '配置/工具文件';
}

const stats = parseNumstat(diff);
const vscodeStats = parseNumstat(vscodeDiff);

async function currentLines(path) {
  try {
    const text = await readFile(join(root, path), 'utf8');
    return text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
  } catch {
    return 0;
  }
}

/** Removes comments and string literals before counting decision points. */
function stripCommentsAndStrings(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Cyclomatic-complexity proxy: 1 + decision tokens. This is a deterministic
 * source-level count (not a compiler metric); it is documented as a proxy in
 * the generated report. Optional property/parameter `?` is excluded via the
 * negative lookahead for `?.`/`??`.
 */
function complexityOf(text) {
  const source = stripCommentsAndStrings(text);
  const matches = source.match(/\b(?:if|for|while|case|catch)\b|&&|\|\||\?(?![.?])/g);
  return 1 + (matches?.length ?? 0);
}

async function readFileSafe(path) {
  try {
    return await readFile(join(root, path), 'utf8');
  } catch {
    return undefined;
  }
}

async function gitShow(path) {
  try {
    return git(['show', `${from}:${path}`]);
  } catch {
    return undefined;
  }
}

function buildTable(rows, lines) {
  if (rows.length === 0) return '（无变化）\n';
  const table = ['| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |', '|---|---|---:|---:|---:|'];
  for (const row of rows) {
    table.push(`| \`${row.path}\` | ${duty(row.path)} | ${row.added} | ${row.deleted} | ${lines.get(row.path) ?? 0} |`);
  }
  return table.join('\n') + '\n';
}

const categories = new Map([
  ['kernel', { title: '内核（Kernel）', rows: [] }],
  ['assembly', { title: '装配（Assembly）', rows: [] }],
  ['plugin', { title: '插件（Plugin）', rows: [] }],
  ['tooling', { title: '工具与配置（Tooling）', rows: [] }],
]);
for (const row of stats) categories.get(categoryOf(row.path)).rows.push(row);

const lines = new Map();
for (const row of [...stats, ...vscodeStats]) lines.set(row.path, await currentLines(row.path));

const complexityRows = [];
for (const row of stats) {
  if (!row.path.endsWith('.ts')) continue;
  if (!(row.path.startsWith('src/') || row.path.startsWith('plugins/'))) continue;
  const baseline = await gitShow(row.path);
  const current = await readFileSafe(row.path);
  const before = baseline === undefined ? 0 : complexityOf(baseline);
  const after = current === undefined ? 0 : complexityOf(current);
  complexityRows.push({ path: row.path, before, after, delta: after - before, category: categoryOf(row.path) });
}

const sum = rows => rows.reduce((total, row) => total + row.added, 0);
const sumDeleted = rows => rows.reduce((total, row) => total + row.deleted, 0);

const output = [];
output.push(`# Phase 2 指标报告（${from} → ${label}）`);
output.push('');
output.push('> 本报告由 `scripts/metrics.mjs` **从 Git 历史自动生成**（Generated from git history），请勿手工编辑。');
output.push(`> 生成命令：\`node scripts/metrics.mjs --from ${from} --to ${to} --label ${label}\`；产物目录：\`docs/metrics/\`。`);
output.push('> 范围：`git diff` 统计；已排除 `node_modules`、`dist`；VSCode 扩展单列，不计入 CLI 增量。');
output.push('> 圈复杂度为**决策点计数代理**（1 + if/for/while/case/catch/&&/||/三元 ?），用于增量比较，不是编译器级精确值。');
output.push('');
output.push('## 概览');
output.push('');
output.push('| 分类 | 文件数 | 新增行 | 删除行 |');
output.push('|---|---:|---:|---:|');
for (const category of categories.values()) {
  output.push(`| ${category.title} | ${category.rows.length} | ${sum(category.rows)} | ${sumDeleted(category.rows)} |`);
}
output.push(`| VSCode 扩展（单列） | ${vscodeStats.length} | ${sum(vscodeStats)} | ${sumDeleted(vscodeStats)} |`);
output.push('');
output.push('## 圈复杂度增量（决策点计数代理）');
output.push('');
output.push('| 分类 | final | HEAD | 增量 |');
output.push('|---|---:|---:|---:|');
for (const category of ['kernel', 'assembly', 'plugin']) {
  const rows = complexityRows.filter(row => row.category === category);
  const before = rows.reduce((total, row) => total + row.before, 0);
  const after = rows.reduce((total, row) => total + row.after, 0);
  output.push(`| ${categories.get(category).title} | ${before} | ${after} | ${after - before >= 0 ? '+' : ''}${after - before} |`);
}
output.push('');
output.push('### 文件明细');
output.push('');
if (complexityRows.length === 0) output.push('（无变化）');
else {
  output.push('| 文件 | final | HEAD | 增量 |');
  output.push('|---|---:|---:|---:|');
  for (const row of complexityRows.sort((a, b) => a.path.localeCompare(b.path))) {
    output.push(`| \`${row.path}\` | ${row.before} | ${row.after} | ${row.delta >= 0 ? '+' : ''}${row.delta} |`);
  }
}
output.push('');
for (const category of categories.values()) {
  output.push(`## ${category.title}`);
  output.push('');
  output.push('### 文件清单与职责');
  output.push('');
  output.push(buildTable(category.rows.sort((a, b) => a.path.localeCompare(b.path)), lines));
}
output.push('## VSCode 扩展（单列，不计入 CLI 增量）');
output.push('');
output.push(buildTable(vscodeStats.sort((a, b) => a.path.localeCompare(b.path)), lines));
output.push('## Git 历史');
output.push('');
output.push(`区间 \`${from}..${to}\` 的提交标题（最新在前）：`);
output.push('');
if (history.length === 0) output.push('（无提交）');
else for (const subject of history) output.push(`- ${subject}`);
output.push('');
output.push('---');
output.push('');
output.push('本文件由脚本生成；数字来自 Git 历史与当前工作树，不接受手工填写。');
output.push('');

const fileName = `metrics-${from.replace(/[^A-Za-z0-9._-]+/g, '-')}-${to.replace(/[^A-Za-z0-9._-]+/g, '-')}.md`;
const directory = join(root, 'docs', 'metrics');
await mkdir(directory, { recursive: true });
const target = join(directory, fileName);
await writeFile(target, output.join('\n'), 'utf8');
process.stdout.write(`metrics: wrote ${target}\n`);
