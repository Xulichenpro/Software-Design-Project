# SVG CLI 自底向上实施计划

目标：实现 references/phase_cli_1.md 第一阶段全部命令，遵循 AGENTS.md 与 doc/README.md 的 Command、Composite 架构。

用户已批准六轮实施计划与以下补充语义。每轮先写行为测试并运行确认缺失功能导致失败，单独提交 test；再实现并运行本轮及累计测试、类型检查，单独提交 feat。不得提前实现下一层。

## 已确认语义

- 跨父级 group 放在首个参数图形原位置；组内按照操作前原树遍历顺序。
- 普通 g 的 set 仅设置自身样式，依靠 SVG 样式继承。
- 外部 SVG 拒绝 transform、未知标签/属性、不匹配画布的 viewBox；重复显式 id 拒绝。生成 id 避让所有显式 id。
- 双引号内支持转义双引号与反斜杠；参数保留引号信息。
- 数值必须有限；几何尺寸与半径非负，画布尺寸为正，缩放系数为正。逆运算测试采用浮点容差。
- 成功的 init/read/save/resize 清空旧历史并阻止 undo/redo，直到下一次成功编辑；失败不改变状态或历史。
- save 成功后关联保存路径；没有关联路径时 save 必须指定路径。help 无文档也可执行。

## 六轮实施

- [x] 1. Receiver 基础：tests/domain、tests/application/receivers 与 tests/infrastructure 验证六种 Shape、多态几何、原子编辑、索引/顺序/无环、三个共享树 Receiver、局部正反 EditRecord、XML 往返与安全文件写入。实现 domain、contracts、records、receivers 和文档 IO 的必要 infrastructure；ShapeFactory 属基础层，命令工厂留待第三轮。独立验证：32/32 测试、严格类型检查通过；实现 c91b5a0。
- [x] 2. Command：tests/application/commands 验证每个具体命令 execute/undo/redo、记录只捕获一次、文档和查询转发、控制命令接收目标参数。实现 commands 五个抽象协议及全部具体类，不增加历史管理类或 target 绑定。独立验证：49/49 测试、严格类型检查通过；测试 3a7ad59，实现 d63a11f。
- [x] 3. Factory：tests/application/factory 验证全部命令语法、参数数量、数值、引号信息、in 子句和类别；实现 CommandFactory 与输入契约。独立验证：118/118 测试、严格类型检查及累计 diff 检查通过；测试 7d2dd8b / 6e35959，实现 27c59c4。
- [ ] 4. Executor：tests/application/execution 验证内部双栈、查询不入栈、屏障、失败不移栈、新编辑清 redo、控制命令目标。只依赖命令抽象。
- [ ] 5. Application：tests/cli 验证解析空行/注释/转义/引号、顺序执行、统一 error/warning 输出、错误后继续；实现 parser、renderer、CliApplication，使用 Terminal 替身。
- [ ] 6. Bootstrap：tests/acceptance 回放第 6 节与 6.1 版本 A、真实 npm run cli、保存再读与 IO 错误恢复。实现 NodeTerminal 和 ApplicationBootstrap，装配共享树及 IO，提供 CLI 入口。

每轮独立 verifier 检查实现与证据。最终更新 doc/README.md 中过程记录、一致性自查和质量证据。已确认 origin 配置；final tag 属最终交付流程，当前任务以代码实现和分轮本地提交为范围。
