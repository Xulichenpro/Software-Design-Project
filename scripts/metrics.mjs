import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { version as typescriptVersion } from 'typescript';
import { API } from 'typescript/unstable/sync';
import { createVirtualFileSystem } from 'typescript/unstable/fs';
import { SyntaxKind, isFunctionLikeDeclaration, isTypeNode } from 'typescript/unstable/ast';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const from = option('--from', 'final');
const to = option('--to', 'HEAD');
const label = option('--label', to);
const root = resolve(option('--repo', scriptRoot));
const directory = resolve(option('--output', join(root, 'docs', 'metrics')));

function git(gitArgs, input) {
  const result = spawnSync('git', gitArgs, {
    cwd: root, input, encoding: input === undefined ? 'utf8' : undefined,
    windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

// Resolve both refs once. Every diff, tree, blob, and log operation uses these
// immutable commits, including when the caller passed a moving ref such as HEAD.
const fromCommit = git(['rev-parse', '--verify', '--end-of-options', `${from}^{commit}`]).trim();
const toCommit = git(['rev-parse', '--verify', '--end-of-options', `${to}^{commit}`]).trim();
const includePaths = ['src', 'plugins', 'scripts', 'extensions', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'plugins.config.json'];
const excludedNames = new Set(['node_modules', 'dist', 'out', 'build', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']);
const included = path => !path.split('/').some(part => excludedNames.has(part));
const diff = git(['diff', '--numstat', '-z', '--no-renames', fromCommit, toCommit, '--', ...includePaths]);
const history = git(['log', '--format=%s', `${fromCommit}..${toCommit}`]).split(/\r?\n/).filter(Boolean);

function parseNumstat(text) {
  return text.split('\0').filter(Boolean).map(line => {
    const [added, deleted, ...pathParts] = line.split('\t');
    const path = pathParts.join('\t');
    return {
      path,
      added: added === '-' ? 0 : Number(added),
      deleted: deleted === '-' ? 0 : Number(deleted),
    };
  }).filter(row => included(row.path));
}

function treeAt(commit) {
  const entries = git(['ls-tree', '-r', '-z', '--full-tree', commit, '--', ...includePaths]);
  const tree = new Map();
  for (const entry of entries.split('\0').filter(Boolean)) {
    const separator = entry.indexOf('\t');
    const [, type, hash] = entry.slice(0, separator).split(' ');
    const path = entry.slice(separator + 1);
    if (type === 'blob' && included(path)) tree.set(path, hash);
  }
  return tree;
}

const fromTree = treeAt(fromCommit);
const toTree = treeAt(toCommit);
const hashes = [...new Set([...fromTree.values(), ...toTree.values()])];
const blobs = new Map();
if (hashes.length > 0) {
  // cat-file sizes are bytes, so decode each UTF-8 blob after slicing the Buffer.
  const batch = git(['cat-file', '--batch'], `${hashes.join('\n')}\n`);
  let offset = 0;
  for (const expected of hashes) {
    const newline = batch.indexOf(10, offset);
    const [hash, type, sizeText] = batch.toString('utf8', offset, newline).split(' ');
    const size = Number(sizeText);
    if (hash !== expected || type !== 'blob' || !Number.isSafeInteger(size)) {
      throw new Error(`Invalid git cat-file response for ${expected}`);
    }
    offset = newline + 1;
    blobs.set(hash, batch.toString('utf8', offset, offset + size));
    offset += size + 1;
  }
}

const contentAt = (tree, path) => blobs.get(tree.get(path));
const linesAt = (tree, path) => {
  const text = contentAt(tree, path) ?? '';
  return text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
};

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
  ['tsconfig.build.json', 'TypeScript 发布构建范围（排除测试）'],
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
  if (path.startsWith('extensions/')) return 'VSCode 扩展与独立构建/测试配置';
  if (path.startsWith('scripts/')) return '仓库脚本';
  return '配置/工具文件';
}

const changed = parseNumstat(diff);
const stats = changed.filter(row => categoryOf(row.path) !== 'vscode');
const vscodeStats = changed.filter(row => categoryOf(row.path) === 'vscode');
const isSource = path => path.endsWith('.ts') && (path.startsWith('src/') || path.startsWith('plugins/'));

const decisionKinds = new Set([
  SyntaxKind.IfStatement, SyntaxKind.ForStatement, SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement, SyntaxKind.WhileStatement, SyntaxKind.DoStatement,
  SyntaxKind.CaseClause, SyntaxKind.CatchClause, SyntaxKind.ConditionalExpression,
]);
const logicalOperators = new Set([
  SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken, SyntaxKind.QuestionQuestionToken,
  SyntaxKind.AmpersandAmpersandEqualsToken, SyntaxKind.BarBarEqualsToken, SyntaxKind.QuestionQuestionEqualsToken,
]);

/**
 * Aggregate cyclomatic complexity: one baseline for each implemented function,
 * method, constructor, getter, setter, or arrow; plus each executable decision.
 * Nested functions contribute their own baseline and decisions exactly once.
 * Top-level decisions count too; modules have no extra baseline. Signatures and
 * type-only files contribute zero. Optional syntax/chains are not decisions.
 *
 * TypeScript 7 exposes parsed ASTs through its native snapshot API, not the old
 * createSourceFile API. The exact compiler version is pinned in package-lock.
 */
function complexityOf(source) {
  let complexity = 0;
  function visit(node) {
    // Class `extends` and expression instantiations have an executable
    // expression even though TypeScript also classifies this node as a type.
    if (node.kind === SyntaxKind.ExpressionWithTypeArguments) {
      visit(node.expression);
      return;
    }
    if (isTypeNode(node) || node.kind === SyntaxKind.InterfaceDeclaration || node.kind === SyntaxKind.TypeAliasDeclaration) return;
    if (isFunctionLikeDeclaration(node) && node.body) complexity++;
    if (decisionKinds.has(node.kind)) complexity++;
    if (node.kind === SyntaxKind.BinaryExpression && logicalOperators.has(node.operatorToken.kind)) complexity++;
    node.forEachChild(visit);
  }
  visit(source);
  return complexity;
}

function complexityAt(tree, endpoint) {
  const paths = [...tree.keys()].filter(isSource);
  const totals = new Map();
  if (paths.length === 0) return totals;
  // This virtual project contains only immutable Git blob content. Returning
  // null for unknown reads prevents the compiler from falling back to disk.
  const virtualRoot = join(root, '.metrics-ast', endpoint).replaceAll('\\', '/');
  const config = `${virtualRoot}/tsconfig.json`;
  const files = Object.fromEntries(paths.map(path => [`${virtualRoot}/${path}`, contentAt(tree, path)]));
  files[config] = JSON.stringify({ compilerOptions: { noLib: true, noResolve: true, types: [] }, files: paths });
  const fs = createVirtualFileSystem(files);
  fs.readFile = path => files[path] ?? null;
  const api = new API({ cwd: root, fs });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    try {
      const project = snapshot.getProject(config);
      if (!project) throw new Error(`TypeScript did not open the ${endpoint} metrics project`);
      for (const path of paths) {
        const source = project.program.getSourceFile(`${virtualRoot}/${path}`);
        if (!source) throw new Error(`TypeScript did not parse ${endpoint}:${path}`);
        totals.set(path, complexityOf(source));
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
  return totals;
}

function buildTable(rows) {
  if (rows.length === 0) return '（无变化）\n';
  const table = [`| 文件 | 职责 | 新增行 | 删除行 | ${from} 行数 | ${to} 行数 |`, '|---|---|---:|---:|---:|---:|'];
  for (const row of rows) {
    table.push(`| \`${row.path}\` | ${duty(row.path)} | ${row.added} | ${row.deleted} | ${linesAt(fromTree, row.path)} | ${linesAt(toTree, row.path)} |`);
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

const beforeComplexity = complexityAt(fromTree, 'from');
const afterComplexity = complexityAt(toTree, 'to');
const complexityRows = [...new Set([...beforeComplexity.keys(), ...afterComplexity.keys()])].map(path => {
  const before = beforeComplexity.get(path) ?? 0;
  const after = afterComplexity.get(path) ?? 0;
  return { path, before, after, delta: after - before, category: categoryOf(path) };
});
const changedPaths = new Set(stats.map(row => row.path));
const changedComplexityRows = complexityRows.filter(row => changedPaths.has(row.path));

const sum = rows => rows.reduce((total, row) => total + row.added, 0);
const sumDeleted = rows => rows.reduce((total, row) => total + row.deleted, 0);

const output = [];
output.push(`# Phase 2 指标报告（${from} → ${to}）`);
output.push('');
output.push('> 本报告由 `scripts/metrics.mjs` **从 Git 历史自动生成**（Generated from git history），请勿手工编辑。');
output.push(`> 标签：\`${label}\`（仅作展示，不替代 Git 端点）。`);
output.push(`> 源提交：\`${from}\` = \`${fromCommit}\`；\`${to}\` = \`${toCommit}\`。`);
output.push(`> 复现命令：\`node scripts/metrics.mjs --from ${fromCommit} --to ${toCommit} --label ${JSON.stringify(label)}\`；默认产物目录：\`docs/metrics/\`。可用 \`--repo <仓库目录>\` 和 \`--output <产物目录>\` 指定独立输入与输出。`);
output.push('> 范围：两个不可变 Git 提交的树、blob 与 `git diff --no-renames`；覆盖 `src/`、`plugins/`、`scripts/`、`package.json`、`tsconfig.json`、`tsconfig.build.json`、`plugins.config.json`；VSCode 扩展单列，不计入 CLI 增量。依赖目录、锁文件和 `dist/out/build` 构建产物均排除。');
output.push(`> 圈复杂度使用 TypeScript ${typescriptVersion} 编译器 AST：每个有实现体的函数、方法、构造器、getter/setter、箭头函数计基数 1；每个 if、for/for-in/for-of、while/do-while、非 default case、catch、三元表达式、&&/||/??（含对应逻辑赋值）再计 1。嵌套函数各计一次；顶层决策计入但模块不另加基数；类型、声明签名、可选属性/参数/链、字符串、注释和正则字面量均不产生决策点。`);
output.push('> 分类复杂度为两端完整源码树的总量（包含未修改文件）；下方复杂度文件明细和职责清单只列区间内变化文件。缺失端点的文件复杂度与行数为 0。所有数字均与当前 HEAD、暂存区和工作树内容无关。');
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
output.push('## 圈复杂度增量（TypeScript AST）');
output.push('');
output.push(`| 分类 | ${from} | ${to} | 增量 |`);
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
if (changedComplexityRows.length === 0) output.push('（无变化）');
else {
  output.push(`| 文件 | ${from} | ${to} | 增量 |`);
  output.push('|---|---:|---:|---:|');
  for (const row of changedComplexityRows.sort((a, b) => a.path.localeCompare(b.path))) {
    output.push(`| \`${row.path}\` | ${row.before} | ${row.after} | ${row.delta >= 0 ? '+' : ''}${row.delta} |`);
  }
}
output.push('');
for (const category of categories.values()) {
  output.push(`## ${category.title}`);
  output.push('');
  output.push('### 文件清单与职责');
  output.push('');
  output.push(buildTable(category.rows.sort((a, b) => a.path.localeCompare(b.path))));
}
output.push('## VSCode 扩展（单列，不计入 CLI 增量）');
output.push('');
output.push(buildTable(vscodeStats.sort((a, b) => a.path.localeCompare(b.path))));
output.push('## Git 历史');
output.push('');
output.push(`区间 \`${from}..${to}\` 的提交标题（最新在前）：`);
output.push('');
if (history.length === 0) output.push('（无提交）');
else for (const subject of history) output.push(`- ${subject}`);
output.push('');
output.push('---');
output.push('');
output.push('本文件由脚本生成；源码、文件清单、行数、复杂度及提交历史均来自上方明确记录的两个 Git 提交，不接受手工填写。');
output.push('');

const fileName = `metrics-${from.replace(/[^A-Za-z0-9._-]+/g, '-')}-${to.replace(/[^A-Za-z0-9._-]+/g, '-')}.md`;
await mkdir(directory, { recursive: true });
const target = join(directory, fileName);
await writeFile(target, output.join('\n'), 'utf8');
process.stdout.write(`metrics: wrote ${target}\n`);
