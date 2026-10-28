# MINOS 品牌资源

## 唯一项目标志

使用用户指定的 [原始 logo](<../logo.png>)，不另画替代标志、不重新输入或重绘图内文字、不拉伸、不裁掉外围图形。当前原图是白底黑色方形图，深色界面保留完整白底，不以 CSS 反色伪造深色版本。

![MINOS 项目横幅](<minos-project-banner.png>)

## 交付资源与生成方式

| 用途 | 资源 / 生成入口 |
| --- | --- |
| 原始母版 | [logo.png](<../logo.png>)，1254 × 1254 PNG |
| 项目 README 横幅 | [minos-project-banner.png](<minos-project-banner.png>)，1600 × 640 PNG |
| 横幅生成 | [生成脚本](<../../desktop/generate_project_banner.py>)，仅排版原图与项目说明 |
| Web 品牌图 | [原字节副本](<../../pi-web/public/icons/minos-logo.png>) |
| Web / PWA 尺寸 | [192px](<../../pi-web/public/icons/minos-logo-192.png>)、[512px](<../../pi-web/public/icons/minos-logo-512.png>)、[Apple 180px](<../../pi-web/public/icons/minos-logo-apple.png>) |
| Windows 应用 | [多分辨率 ICO](<../../pi-web/public/icons/minos-logo.ico>)，含 16/24/32/48/64/128/256px |
| 图标生成 | [生成脚本](<../../desktop/generate_brand_icons.py>)，同步应用、PWA、浏览器 favicon |

脚本使用 Pillow；横幅脚本当前使用 Windows Arial 字体。修改母版后重新生成衍生资源，检查展示，再重建前端与安装包。仅替换仓库文件不会改变已经安装的 EXE 图标。

## 品牌与面试角色分离

- 登录、欢迎页、侧栏、桌面标题栏、浏览器与 Windows 应用使用本项目 logo。
- **AI 面试官继续使用原有独立动态角色**，其 [头像资源](<../../pi-web/public/avatar>) 和 [CharacterView](<../../pi-web/components/minos/components/CharacterView.jsx>) 不随品牌替换。
- 不将历史角色、闲置模型或第三方模板作者头像当作项目新 logo。

## 使用与许可

用户指定原图作为项目品牌来源，不代表已取得对其全部素材的再许可权。当前没有对外提供品牌商标或商业使用授权；外部分发、宣传与衍生设计需由项目所有者确认权限。README 横幅仅为本项目文档展示，不是新注册商标声明。
