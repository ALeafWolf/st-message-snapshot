# st-message-snapshot

酒馆（SillyTavern）UI 扩展：把单独一楼存成一张图片，所见即所得。

- 截的是渲染完的页面元素，regex 改写／隐藏、卡脚本插进来的面板、酒馆助手 iframe、折叠块的开合状态都按屏幕上的样子进图。
- 跟着玩家当前的主题走（颜色、字体、气泡框）。
- 渲染库：[snapdom](https://github.com/zumerlab/snapdom)（借浏览器自己的渲染器，非 html2canvas 那种重写 CSS 的路线）。

## 现状

只有原型（`prototype/snap-proto.js`，控制台脚本），扩展本体还没写。

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
2. **正文里的「梦鲸思客 - 思考」折叠块**在屏幕上是可见的（在 `.mes_text` 里，不是酒馆的思维链），所以会被截进去。是否默认去掉待定。

## 未验证

- iPad / Safari：画布面积上限（~16.7M 像素）、foreignObject 首绘图片空白、保存方式（长按 / `navigator.share`）。
- 外链图片的 CORS；原型只在 flat 聊天样式下跑过，bubble / document 样式没试。
- 内部滚动区（`max-height` + `overflow`）。
