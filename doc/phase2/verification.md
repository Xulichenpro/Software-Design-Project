# Phase 2 验证与发布记录

本轮保持已批准的 ShapeProvider / PluginCommand / Registry 架构，只修复边界行为并补充验收证据。需求来源为 `requirements/phase_cli_2.md`；A/B 的独立增量判据与共同零内核差异必须分别核验。

## 1. 本轮实际验证（2026-11-09）

| 命令 | 实际结果 |
|---|---|
| `npm run test:phase1` | 200/200，通过；包括四份固定回放、真实 final 对照、装配隔离和历史指标 |
| `npm run test:cli:plugins` | 98/98，通过 |
| `npm run test:plugin:unit` | 45/45，通过 |
| `npm run test:plugin:host` | 真实本机 VSCode 宿主 15/15，通过，退出码 0 |
| `npm run typecheck` / `npm run typecheck:extension` | 严格类型检查通过 |
| `npm run build` / `npm run build:extension` | CLI 与扩展构建通过 |

源码修复经过独立规格审查及代码质量审查。回归过程先确认失败，再修改实现：加载组 10 个反例、状态/事务组 11 个反例；指标测试复现工作树污染与类型语法误计；回放测试还复现了预读取导致的原始提示符顺序差异。最终恢复逐条读入后，真实 final 的 stdout 与 SVG 均逐字节相同。

## 2. 修复边界

- `PluginLoader` 将配置路径解析为绝对路径后再解析裸包名。
- `ApplicationBootstrap` 只在选择方式 A 时加载代码装配模块；B 的空配置/disabled 不受 A 插件缺失或求值错误影响。
- 非法 contributes 容器、名称列表或名称均报告清单错误，丢弃本插件并继续后续加载。
- 快照补充同层索引；顶层 front/back 标星，增删节点造成的兄弟索引位移不会误标。
- 属性写入、输出物化和记录构造统一受回滚保护；undo/redo 批次中途失败也恢复先前写入。
- box 创建拒绝明确未加引号的 CLI 标题，内部未提供 quoted 的创建仍可用。
- metrics 从两端 Git 对象读取数据，以实际 TypeScript AST 统计可执行复杂度，不再把可选属性标记当分支。

## 3. 固定回放与基础兼容

输入、实际输出、期望 SVG、导入资产和来源提交均位于 [doc/transcript](../transcript/README.md)：

```powershell
node --import tsx --test tests/acceptance/transcripts.test.ts
```

- `cli-1.txt` 覆盖 Phase 1 §6，`flowchart-a.txt` 覆盖 §6.1 手工组合版；从 `final` Git 对象恢复旧源码运行，与当前禁用全部可选插件的入口比较原始 stdout 和输出 SVG。
- `box.txt` 覆盖 §6.1 box 版；`plugins.txt` 覆盖 stats/dir/属性/标签/保存及重排；同一固定目录运行 A/B，原始 stdout 与输出 SVG 逐字节一致。
- 输入只含命令和注释，预期输出分开保存；日志留在父进程内存，SVG 输出位于被列目录之外。LF 属性固定，Windows 新检出也不会改变 golden 字节。
- 记录器 `node --import tsx scripts/record-transcripts.mjs` 运行真实程序产生基线；不得手工修改 golden 掩盖差异。

## 4. A/B 提交差异证据

原插件接入提交 `a54f7ae`、`4aee647`、`ed1ded0` 排除新增包及 A 的唯一装配文件后，内核与既有插件差异为空。它们同时修改配置，不能单独作为 B 的严格证明。

独立 B 分支及实际会话见 [config-only-demo.md](config-only-demo.md)。其 `04e4c92` 只新增 box 包并修改配置，没有修改任何已有运行源码：

```powershell
git diff --name-status 04e4c92^ 04e4c92
git diff --exit-code 04e4c92^ 04e4c92 -- src plugins/stats plugins/dir
```

第二条退出码 0、输出为空，所检查目录实际存在。A/B 均经过 PluginHost 同一暂存、清单校验、重名检查和整包回滚路径。

## 5. 指标复算

```powershell
node scripts/metrics.mjs --from final --to HEAD --label p2
```

报告记录解析后的两个不可变提交、TypeScript 版本和复杂度定义。所有行数、文件清单、复杂度均来自 Git tree/blob，与执行时工作树内容无关。`--repo` 可选取独立 Git 仓库，`--output` 可写入临时报告目录；测试用真实临时历史检验脏工作树、类型语法、增删文件及分类。

发布报告在最后源码提交生成并随最后的文档提交提交。最终 p2 与报告终点在 src/plugins/scripts/extensions 及列出的配置范围无差异；报告本身位于统计范围外，避免自引用。

## 6. 发布约定

`final` 保持不变。用户在本轮明确要求“撤掉已有 p2，给正确的打 p2”，因此本轮按该授权重建 p2，而不是保留旧 p2 或另建 p2.1。更新远端 p2 时核对旧标签对象并使用针对该标签的 lease；其他远端引用不强制更新。

最终提交包含测试、报告、独立 B 演示引用、VSCode 证据及源码；推送后再次核验远端 master、p2 和演示分支对应的对象。
