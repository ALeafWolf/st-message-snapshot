# 开发笔记

给维护者看的：怎么截、为什么这么截、踩过的坑、还没验证的。使用说明在仓库根的 README。

## 结构

- `index.js`：按钮注入、截图、合成、编码、弹窗、界面文字。
- `slices.js`：长楼分张的坐标计算（量行缝、定切点），不碰画布。
- `style.css`：弹窗样式，颜色全用酒馆主题变量（`--SmartTheme*`）。
- `lib/snapdom.mjs`：[snapdom](https://github.com/zumerlab/snapdom) 3.3.4 的 ESM 构建，原样放进仓库，不走 CDN；许可证在 `lib/LICENSE-snapdom`。
- `docs/snap-proto.js`：最早的控制台原型，留作对照。

## 截取

- 截取对象是 `.mes_block`。`exclude` + `excludeMode: "remove"` 去掉楼层界面零件：名字行、按钮、swipe、计时、token 计数、思维链块上的按钮（`CHROME` 常量）。其余凡是屏幕上看得见的都截。
- 正文里预设或卡自带的折叠块（如梦鲸「思考」）照截，不按预设特判：别的卡不一定用同一个预设。
- 截的是实时 DOM，所以 regex 改写、卡脚本插入的节点、`<details>` 开合、同源 iframe 内容都自带；不重跑 regex。
- snapdom 内联计算样式，以祖先为前提的选择器（如 `#chat.<线> .xxx::before`）照样生效。换成「克隆到别处再套样式表」的库会丢。

## 合成

snapdom 出透明底原图，按倍率缓存（换格式、质量、底色只重新合成和编码，换清晰度才重截），再画到加了 16px 边距的画布上：

- **主题**：`#000` → `--SmartThemeBlurTintColor` → 楼层各祖先（含 body）的非透明背景色，从外到内。
- **壁纸**：屏幕上的叠法是 body 底色（画布传播，在壁纸下面）→ `#bg1` 上的壁纸 → 楼层祖先底色 → 楼层自己的半透明底色。酒馆的壁纸模糊是 `#bg1` 元素自身的 `filter: blur(3px)`，不是 backdrop-filter，所以能在画布上照原样复现：读壁纸元素的 `filter`，px 值乘倍率后给 `ctx.filter`；四周多铺两倍模糊半径，免得边缘把透明吸进来发暗。`#bg_custom`（聊天专属背景）优先，视频取当前帧，按 `background-size`（cover / contain）和 `background-position`（百分比；px 取居中）铺满整张图。
- **透明**：不垫底。JPEG 下不可选（选项置灰，设置里仍记着，切回 PNG / WebP 恢复）。

## 编码与平台限制

- 单张画布上限：Safari / iOS 1600 万像素、单边 16000；安卓 3200 万像素、单边 16000（猜的起点，见下面「分张」的自检）；桌面 1.2 亿像素、单边 32000。只有宽度超限才降倍率，高度超限一律分张。
- `toBlob` 遇到不会编码的格式会悄悄给 PNG（Safari 的 WebP），按 `blob.type` 认出来，换成 PNG（要透明时）或 JPEG 并提示。
- 剪贴板：Chrome 的 `ClipboardItem.supports` 对 `image/jpeg`、`image/webp` 都是 false，只能写 PNG；复制前先问 `supports`，哪天支持了就直接复制当前格式。

## 倍率

图上每个 CSS 像素占几个像素 ＝ 所选清晰度 × `devicePixelRatio`，封顶 3（所选本身更高就按所选）。传给 snapdom 的是 `scale: 这个数, dpr: 1`。

snapdom 的 `dpr` 默认取 `devicePixelRatio`，0.3.0 没传，于是手机上「2×」实际是 6×，而上限是按 2× 算的：长楼的画布比预想大九倍，snapdom 再悄悄把它整体缩到单边 32767（控制台有 `[SnapDOM] … is larger than a canvas allows; scaled down`）。桌面 Chromium 画得出这张图，安卓 WebView 画不全，用户看到的就是「长楼被截断」。

## 分张

一张放不下的楼按行缝切成几张（`slices.js`）：

- **量**：`Range.getClientRects()` 取每个文本节点的行框（上下各让出 15%，行框互相贴着时也找得到缝），加上图片、SVG、表单控件这类切不得的整块；同源 iframe 钻进去量，跨域的整个算一块。量的时候把界面零件（`CHROME`）在页面上也 `display: none`，截完恢复：克隆里它们是被删掉的，不这样量出来的坐标会整体偏一个名字行。
- **切**：段数取最少，每段尽量一样高；在目标位置附近挑最宽的空隙（段落间距比行缝宽），找不到就在上限处硬切。
- **截**：只克隆一次，每张用 snapdom 的 `toCanvas({ crop })` 取（改的是 SVG 的 viewBox，每张是独立的小图）。原图总像素不超过 4000 万才缓存，再大每次重画。
- **自检**：浏览器画不动太高的图时不报错，只是底部留空。每张画完拿量好的行位置去对：靠下的几行字所在位置全透明，就把单张边长上限对半降、记进 `localStorage`（`messageSnapshot.sideCap`）后重来，最低降到 2000；到底了还是空就在提示里说「底部可能没画全」。楼层自己有不透明底色时判不出来，按画全了算。

## 界面文字

自带三份字典（en / zh-cn / zh-tw），按 `getCurrentLocale()` 选：`zh` 开头里带 tw / hk / mo / hant 的用繁体，其余中文用简体，别的语言用英文。

不用酒馆的 `addLocaleData`：它拿英文原句当键，且不许覆盖已有条目（`if (!Object.hasOwn(localeData, key))`），"Save"、"Copy"、"Format" 这类词酒馆自己的中文翻译里早就有，会被酒馆的译法顶掉。

加字符串时三份字典都要加，键和 `{占位}` 要一致。

## 踩过的坑

- **`<q>` 引号重复**：酒馆把 `q::before/::after` 的 content 设成 `""`，snapdom 不复制空 content，克隆里浏览器默认的 open-quote 回来了，出现 `“"If …"”`。修法：`afterClone` 插件往克隆里加 `q::before,q::after{content:none!important}`。

## 原型验证（2026-10-26，Theo 会话 #22 楼，桌面 Chrome，flat 聊天样式）

| 验证项 | 结果 |
| --- | --- |
| 卡 CSS 伪元素画的标题（`VESTIARIUM · 圣器室`，选择器以 `#chat.<线>` 为前提） | 截到，纸纹、蜡印都在 |
| 梦鲸「梦境选项」（同源 iframe，在 `.mes_text` 里） | 截到，iframe 内样式完整 |
| `.mes_text` 之后由卡脚本 `after()` 插入的 `<details>`（SIGVALD） | 收起、展开都截到，SVG 完整 |
| 壁纸底色 | 壁纸铺满、3px 模糊复现，楼层半透明底色压在上面 |
| 2× 输出 | 2141×4694，约 1.6 s |

同一楼（SIGVALD 收起）的体积：

| 设置 | 尺寸 | 大小 |
| --- | --- | --- |
| JPEG 90 2× | 2141×3561 | 1.1 MB |
| WebP 90 2× | 2141×3561 | 614 KB |
| WebP 80 2× | 2141×3561 | 465 KB |
| WebP 80 1× | 1070×1780 | 203 KB |
| PNG 2× | 2141×3561 | 3.8 MB |
| PNG 3× | 3212×5342 | 7.1 MB |

JPEG 80 与 WebP 80 在 2× 下放大对比，文字边缘都干净。

## 未验证

- iPad / Safari：分张、foreignObject 首次绘制图片空白、WebP 回退、分享存相册。
- 安卓 WebView（柏宝阁）：分张与自检只在桌面无头 Chrome 里用「高于 N 像素的部分清空」模拟过；真机上的上限是多少、`crop` 分段是否真能画全，都没验证。
- 多张保存在各平台的表现（连续下载是否被拦）、多文件分享。
- 中文界面（只在本地核对了语言选择和字典键）。
- 聊天专属背景 `#bg_custom`、视频壁纸。
- 消息里的外链图片（CORS）。
- bubble / document 聊天样式。
- 内部滚动区（`max-height` + `overflow`）。
