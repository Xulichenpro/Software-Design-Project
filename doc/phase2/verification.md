# Phase 2 验证手册

本文件固定每阶段的验证命令与判据。**装配层不计入内核零差异判据**：A 的
`src/bootstrap/codeAssembly.ts` 与 B 的 `plugins.config.json` 可以变化；只要求内核
`src/` 与既有 `plugins/` 不变。判据命令必须排除本次新增的插件包目录。

## 1. 基础命令

```powershell
npm run test:phase1
npm run test:plugin:unit
npm run typecheck
npm run build
npm run test:plugin:host
```

未运行不得宣称通过。VSCode host 测试在阶段 1-4 可暂不每次运行，收尾必须运行。

## 2. 零内核差异

设 `C` 为接入插件的那次提交，`N` 为本次新增插件包目录（相对仓库根）：

```bash
git diff --name-status C^ C
git diff C^ C -- src/ plugins/ ":(exclude)$N" ":(exclude)src/bootstrap/codeAssembly.ts"
```

- 第二条输出必须为空。装配层（A 的 `src/bootstrap/codeAssembly.ts`、B 的
  `plugins.config.json`）不计入内核差异，因此可以从判据中排除；如果排除装配文件后
  仍有 `src/` 或既有 `plugins/` 变化，逐项说明；无法说明即失败。
- 路径必须实际存在；Git 对不存在路径可能返回空结果，空输出本身不构成证明。
- 装配层变化不计入零差异判据；但 A 仍应只改一个顶层装配文件，B 不应改已有运行代码。

## 3. A/B 双装配一致

```bash
<启动入口> < doc/transcript/cli-1.txt
<启动入口> --config plugins.config.json < doc/transcript/cli-1.txt
```

- 两次输出 `diff` 为空。
- 输入文件只含命令与注释，不含 `svg>`/示例输出；预期输出与所需 SVG 分开保存。
- 覆盖：Phase 1 §6 基础会话、§6.1 版本 B box 会话、含 `stats`/`dir` 的新增命令会话。
- A/B 的插件集合、顺序、options、初始文件、运行目录一致。
- `dir` 使用内容固定的临时目录；输出日志写到该目录之外，避免日志改变目录列表。

## 4. 基础兼容性

用禁用全部可选插件（含树标签）的配置运行基线会话，与 `final` 的输出逐字节比较：

```bash
git show final:doc/transcript/cli-1.expected.txt
```

（若 `final` 没有该文件，则在阶段 1 用当前 Phase 1 代码生成基线并提交，作为后续对照。）
禁用可选插件后必须仍提供 Phase 1 全部命令和六种图形。

## 5. 加载器独立性

```bash
rg -n "import|require|switch" src/bootstrap
```

仅辅助人工检查：加载器不得硬编码具体插件导入、名称映射表或条件分支；不能仅凭搜索
无结果判定通过。需要结合 loader 测试（四条失败、重复、回滚、disabled、options）。

## 6. 插件独立测试

```powershell
npm run test:plugin:unit
```

- stats/dir/box/tree-star 各自测试可在不依赖其他插件的情况下运行。
- `dir` 同时覆盖 `DirectoryReader` 替身与真实临时目录适配器。
- box 覆盖读回降级/拒绝、结构保护、模板/文案。
- tree-star 覆盖编辑→保存→再编辑→undo 的 dirty 状态机。

## 7. metrics

```bash
node scripts/metrics.mjs --from final --to HEAD
```

- 输出写入 `docs/metrics/`；数字由脚本从 git 历史生成，不接受手填。
- 按“内核 / 装配处 / 插件”分类；VSCode 扩展单独列出，不混入 CLI 增量；依赖包与
  构建产物排除。

## 8. 收尾

- `doc/README.md` 的扩展点清单逐项对应代码位置与行为；ADR 链接有效。
- 最终全量测试 + VSCode host + A/B + 基线 + 零差异全部留证据。
- tag `p2` 打在最终提交；不移动已打 tag。
