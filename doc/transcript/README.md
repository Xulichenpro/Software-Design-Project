# 固定回放输入与真实基线

所有 `.txt` 输入只含命令和注释；`.expected.txt` 是真实 CLI 的原始 stdout（包括提示符），不是手写的示例输出。`assets/other.svg` 是需求 §6 的导入文件，`expected-svg/` 保存实际输出 SVG，`provenance.json` 记录基线来源。

| 输入 | 来源与比较 |
|---|---|
| `cli-1.txt` | Phase 1 §6；从不可变 `final` 的 Git 对象恢复源码运行，对照禁用可选插件的当前入口 |
| `flowchart-a.txt` | Phase 1 §6.1 手工组合版本 A；同样对照实际 `final` |
| `box.txt` | §6.1 box 版本 B；比较代码装配 A 与配置装配 B |
| `plugins.txt` | help、未初始化 dir/stats、box 属性、统计、保存、顶层重排、undo 和双标签；比较 A/B |

自动回放：

```powershell
node --import tsx --test tests/acceptance/transcripts.test.ts
```

测试创建固定的临时工作目录，目录中只有 `docs/`、`plugins/`、`.hidden`、`demo.svg`。输入文件位于其兄弟 `input/`，SVG 输出位于兄弟 `output/`，日志仅在父进程内存中收集；两条装配路径使用相同目录、配置顺序和输入。测试清理临时目录，不将日志写入被 `dir` 列举的目录。

更新基线必须运行实际程序并复核差异：

```powershell
node --import tsx scripts/record-transcripts.mjs
```

前两个基线永远从 `final` Git 对象生成；后两个从当前代码装配生成，再由测试逐字节核对配置装配。记录器需要本地存在 `final` 标签和已安装的依赖，不 checkout 或修改旧标签。
