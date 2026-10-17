把 MINO AGENT 的 3D 模型放到本目录，命名为 xiaomin.glb，即可在「AI 面试」房间自动显示。

建议模型：
- 格式 GLB（glTF 2.0 binary）
- 体积尽量 < 15 MiB（贴图 2048/4096，经减面）
- 如带口型/表情：请包含 mouthOpen 或 viseme 变形目标（AA/EE/IH/OH/UH 等），否则会退化为整体浮动

前端会自动尝试加载 /models/xiaomin.glb；找不到时显示 2D 立绘占位，不影响其它功能。
