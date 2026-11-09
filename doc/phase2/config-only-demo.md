# 方式 B：仅新增插件与修改配置的提交证据

独立演示分支：`demo/phase2-config-only`；演示提交：`04e4c9278b1c11c6e1d5e5b3e56cab9e572fa312`。

该分支从原 box 接入前的 `e22651a` 开始，复用当时 box 包，实际通过配置加载运行。它用于证明接入差异，不替代修复后的最终 `p2`。

```powershell
git diff --name-status 04e4c92^ 04e4c92
git diff --exit-code 04e4c92^ 04e4c92 -- src plugins/stats plugins/dir
```

第一条输出恰好是：

```text
M plugins.config.json
A plugins/box/package.json
A plugins/box/src/BoxAttributeHandler.ts
A plugins/box/src/BoxShape.ts
A plugins/box/src/BoxTypeDecorator.ts
A plugins/box/src/index.ts
```

第二条退出码 0、输出为空；检查路径实际存在。没有修改 `codeAssembly.ts`、加载器、内核或既有插件，因此满足第 6 节方式 B 的独立差异判据。

在该演示分支以 `plugins.config.json` 装配的实际会话：

```text
init
create box n1 120 100 160 60 "开始"
set n1 fill red
set n1 label "updated"
undo
redo
stats
tree
```

实际输出包括以下结果且无 error：

```text
box#n1 created (g#n1 + rect#n1-rect + text#n1-label)
box#n1 fill propagated to n1-rect
box#n1 label updated: "updated"
box#n1 label restored: "开始"
box#n1 label updated: "updated"
rect: 1  text: 1  (total 2, containers 1)
svg (800x600)
└── g#n1 (box)
    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=red
    └── text#n1-label  (140,135) "updated"
```

原 `4aee647`/`ed1ded0` 接入提交支持代码装配 A 和共同的零内核差异判据；本分支专门补足 B 的源码零修改证明，不能通过排除装配文件来冒充 B 判据。
