# ADR-009：DirectoryReader 归属、适配器与 dir 输出

- Status: Accepted
- Date: 2026-11-09

## Context

需求要求 `dir` 使用适配器模式访问文件系统，且“接入 dir 不修改内核或既有插件”。
AGENTS 图只画了 `DirCommand --> DirectoryReader --> NodeDirectoryAdapter`，没有规定
接口放在内核还是插件包。`dir` 的正文与示例在空格数量上存在冲突，用户已明确选择
“标记后用两个空格连接名称”。

## Decision

1. `DirectoryReader`、`NodeDirectoryAdapter`、`DirCommand` 全部放在 `plugins/dir`；
   内核只提供 `QueryCommand`/`CommandResult`。dir 提交不新增内核文件。
2. 适配器角色：
   - Client：`DirCommand`
   - Target：`DirectoryReader`
   - Adapter：`NodeDirectoryAdapter`
   - Adaptee：Node `fs.readdir` / `process.cwd()`
3. 接口：
   ```ts
   interface DirectoryEntry { readonly name: string; readonly kind: 'directory' | 'file'; }
   interface DirectoryReader {
     currentDirectory(): string;
     list(path: string): Promise<readonly DirectoryEntry[]>;
   }
   ```
4. `NodeDirectoryAdapter` 使用 `process.cwd()` 与 `readdir(path, { withFileTypes: true })`；
   隐藏项包含，`.`/`..` 不列出；符号链接/特殊项按 `file`（输出 `[FILE]`），不追目标。
5. 输出格式：**标记后用两个空格连接名称**（用户明确选择，覆盖 phase2 示例中的
   `[FILE] ` 单空格写法）：
   ```text
   [DIR]  docs
   [FILE]  demo.svg
   ```
6. 目录在前、文件在后，各组按名称固定字符比较（code unit）升序；空目录
   `(empty directory)`；读取失败 `error: cannot read directory: <path>`，命令继续可用。
7. `dir` 是 `QueryCommand`：不接收参数、不依赖文档、不改变文档/历史/dirty，不触发
   undo 限制。插件通过 `context.registerCommand` 注册，A/B 使用同一实现。

## Consequences

- dir 提交的内核 diff 为 0；接口/适配器可独立测试。
- 测试替身替换 `DirectoryReader`；真实适配器测试用临时目录注入
  `currentDirectory`（构造参数）避免全局 chdir。
- 由于用户选择两个空格，Phase 2 文档中的 dir 示例需要更新，否则示例与测试冲突。

## Alternatives

- 把 `DirectoryReader` 放内核：dir 提交新增内核文件，违反零差异判据，拒绝。
- 使用 `localeCompare`：受区域设置影响，拒绝。
- 只列文件不列目录/隐藏项：违反需求，拒绝。

## Verification

- `plugins/dir/tests/*`：混合、空目录、隐藏项、排序、失败、符号链接、真实临时目录。
- `tests/acceptance/*`：未 init 可用、有文档时成功/失败不改历史。
- `scripts/verify-ab.mjs`：固定临时目录下 A/B 输出逐字节一致，日志在目录外。
