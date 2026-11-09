# SVG Outline

为 VS Code Explorer 中的 SVG 文件添加 `[]` 标记，并在原生 Outline 中显示 SVG 元素层级。节点使用原始 `标签名#id`，无 id 时只显示标签；点击节点定位到源码。不会修改文件名或文件内容。

## 从源码启动

在仓库根目录 `C:\Users\xlc\software-design\pj` 运行：

```powershell
npm ci
npm run build:extension
code .
```

在 VS Code 的“运行和调试”中选择 **Run SVG Extension**，按 **F5**。新打开的 Extension Development Host 会打开 `tests/assets/`，该样例工作区已配置 SVG 默认使用文本编辑器，不改变其他工作区的编辑器设置。

1. 在 Explorer 中观察 SVG 文件右侧的 `[]`。
2. 打开 `outline.svg`。如果它被其他扩展打开为预览，右键文件选择“打开方式 → 文本编辑器”。
3. 展开 Explorer 下方的 **Outline / 大纲**。若未显示，通过“视图 → 打开视图”查找 Outline。
4. 展开 `svg#canvas → g#flow → g#nested`；点击 `rect#start` 检查源码定位。
5. 将 `id="start"` 改为其他值，无须保存，大纲会更新。删去闭合标签时大纲暂时清空，修复后恢复。

也可以直接启动开发宿主：

```powershell
code --new-window --extensionDevelopmentPath="C:\Users\xlc\software-design\pj\extensions\vscode-svg" "C:\Users\xlc\software-design\pj\tests\assets"
```

源码改动后重新执行 `npm run build:extension`，并在开发宿主执行 **Developer: Reload Window**。构建需要仓库指定的 Node.js 24；生成的扩展包在 VS Code 扩展宿主中运行，不调用 CLI 进程。

## 分别运行测试

所有命令均在仓库根目录执行：

```powershell
npm run test:phase1
npm run test:plugin:unit
npm run test:plugin:host
```

`test:phase1` 包含原有命令测试和固定输出回归；`test:plugin:unit` 检查共享 XML 解析和源码范围；`test:plugin:host` 在独立测试 profile 的真实 VS Code 中检查注册、大纲、未保存编辑及文件装饰。

Windows 测试脚本优先使用默认安装位置的 VS Code。其他安装位置可指定：

```powershell
$env:VSCODE_EXECUTABLE_PATH = 'D:\Programs\Microsoft VS Code\Code.exe'
npm run test:plugin:host
```

未找到本机 VS Code 时，测试工具会下载稳定版。测试运行禁用其他用户扩展，不修改日常 VS Code profile。固定 SVG 样例全部位于 `tests/assets/` 同一级目录。

若本机 VS Code 正在更新、暂时不能启动，可强制使用独立下载的测试版本：

```powershell
$env:VSCODE_TEST_DOWNLOAD = '1'
npm run test:plugin:host
```

架构、复用与设计模式分析见仓库的 `doc/README.md`，测试先行记录见 `doc/vscode-tdd.md`。
