# st-message-snapshot

酒馆（SillyTavern）UI 扩展：把单独一楼存成一张图片，所见即所得。

- 截的是渲染完的页面元素，regex 改写／隐藏、卡脚本插进来的面板、酒馆助手 iframe、折叠块的开合状态都按屏幕上的样子进图。
- 跟着玩家当前的主题走（颜色、字体、气泡框）。
- 渲染库：[snapdom](https://github.com/zumerlab/snapdom)（借浏览器自己的渲染器，非 html2canvas 那种重写 CSS 的路线）。

## 安装

酒馆 → 扩展（方块图标）→「安装扩展」→ 填 `https://github.com/ALeafWolf/st-message-snapshot` → 刷新页面。更新在扩展管理里点更新。

## 用法

每楼「…」菜单里的相机按钮 → 弹窗预览 → 保存 / 复制（PNG）/ 分享（系统分享面板，iPad 存相册走这里）。

弹窗里可调，选过的会记住（`extensionSettings.messageSnapshot`）：

| 选项 | 取值 | 默认 |
| --- | --- | --- |
| 格式 | JPEG / WebP / PNG | JPEG |
| 清晰度 | 1× / 1.5× / 2× / 3× | 2× |
| 质量 | 50–100（仅 JPEG、WebP） | 90 |
| 底色 | 主题 / 壁纸 / 透明（仅 PNG、WebP） | 主题 |

底色：
- **主题**：主题遮罩色 + 楼层祖先的底色，不画壁纸。
- **壁纸**：按屏幕上的叠法还原：body 底色 → 壁纸（`#bg_custom` 优先，其次 `#bg1`；视频取当前帧）按 `background-size` / `position` 铺满整张图，带壁纸元素自己的 `filter`（酒馆默认 `blur(3px)`，按倍率放大）→ 楼层祖先的底色。长图是把壁纸铺到整张图上，不是屏幕那一屏的切片。Safari 旧版不支持画布 `filter`，壁纸会不模糊。找不到壁纸时退回主题底色并提示。

换格式、质量、底色只重新编码；换清晰度才重截。长图超过浏览器画布上限会自动降倍率并提示；浏览器导不出的格式（Safari 的 WebP）自动换成 PNG/JPEG 并提示。

参考体积（Theo #22，SIGVALD 收起）：JPEG 90 2× 1.1 MB；WebP 80 2× 465 KB；WebP 80 1× 203 KB；PNG 2× 3.8 MB。

## 截取范围

`.mes_block` 里屏幕上看得见的一切，只去掉楼层界面零件（名字行、按钮、swipe、计时、思维链块上的按钮）。正文里预设或卡自带的折叠块（如梦鲸「思考」）照截，不按预设特判。

`prototype/snap-proto.js` 是最早的控制台原型，留作对照。

## 原型结论（2026-10-26，Theo 会话 #22 楼，桌面 Chrome）

截取对象是 `.mes_block`，`exclude` + `excludeMode: "remove"` 去掉名字行、按钮、swipe、计时、思维链；底色＝ `#000` → `--SmartThemeBlurTintColor` → `#chat` 背景色依次压上，四周留 16px。

| 验证项 | 结果 |
| --- | --- |
| 卡 CSS 伪元素画的标题（圣器室 `VESTIARIUM · 圣器室`，选择器以 `#chat.<线>` 为前提） | 截到，纸纹、蜡印都在 |
| 梦鲸「梦境选项」（同源 iframe，挂在 `.mes_text` 里） | 截到，iframe 内样式完整 |
| `.mes_text` 之后由卡脚本 `after()` 插入的 `<details>`（SIGVALD） | 收起、展开两种状态都截到，SVG 灯盏完整 |
| 2× 输出 | 2141×4694，约 1.6 s |

踩到的坑：

1. **`<q>` 引号重复**：酒馆把 `q::before/::after` 的 content 设成 `""`，snapdom 不复制空 content，克隆里 UA 默认的 open-quote 回来了，出现 `“"If …"”`。修法：`afterClone` 插件往克隆里加 `q::before,q::after{content:none!important}`。
2. **正文里的「梦鲸思客 - 思考」折叠块**在屏幕上是可见的（在 `.mes_text` 里，不是酒馆的思维链），所以会被截进去。定为照截（10-26 用户：别的卡不一定用这个预设）。

## 未验证

- iPad / Safari：画布面积上限（~16.7M 像素）、foreignObject 首绘图片空白、保存方式（长按 / `navigator.share`）。
- 外链图片的 CORS；原型只在 flat 聊天样式下跑过，bubble / document 样式没试。
- 内部滚动区（`max-height` + `overflow`）。
