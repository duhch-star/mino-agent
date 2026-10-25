# LaTeX 简历版式来源与许可

本工作台内置的是三套重新实现的中文适配版式，不是声称直接运行上游原模板：

1. classic：经典单栏。参考 https://github.com/sb2nov/resume 的单栏结构与清晰分节；MIT。
2. technical：classic 的紧凑技术型变体，不是第三个独立开源项目。
3. sidebar：参考 https://github.com/deedy/Deedy-Resume 的非对称双栏思路；Apache-2.0。

适配改动：统一使用 ctexart 与 Fandol 中文字体、取消上游个人履历与字体依赖、采用结构化 JSON 到安全 TeX 的渲染、重新实现栏目和间距。简历内容不包含上游作者个人信息。

upstream 目录保留获取到的许可证及上游参考文件。MIT 格式许可不代表作者个人简历数据可复用。当前 Deedy 参考类文件仅存档，不参与编译；没有捆绑 MacFonts 字体。

参考版权：Sourabh Bajaj；Debarghya Das (Copyright 2014)。许可证全文见 upstream/sb2nov-LICENSE.txt 与 upstream/deedy-LICENSE.txt。

实际模板渲染逻辑在 app/services/resume_service.py。所有用户与模型文字进行 TeX 转义。PDF 仅编译服务端生成的源码，不支持执行任意用户上传的 .tex。
