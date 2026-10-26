# Message Snapshot

[English](#english) · [中文](#中文)

## English

A SillyTavern extension that saves a single chat message as an image — exactly as you see it.

- **What you see is what you get.** Regex edits and hidden text, panels added by character cards or scripts, TavernHelper frames, and whether each collapsible is open or closed all appear in the image just as they do on screen.
- **Matches your theme.** Colors, fonts and message boxes come from your current SillyTavern theme.
- **Only the message.** The name line, buttons, swipe arrows and timers are left out.

### Install

In SillyTavern, open **Extensions** (the cubes icon) → **Install extension**, enter

```
https://github.com/ALeafWolf/st-message-snapshot
```

and reload the page. To update later, use the update button in the extension manager.

### Use

Open a message's **…** menu and click the **camera** button. A preview opens where you can adjust:

| Option | Choices | Default |
| --- | --- | --- |
| Format | JPEG / WebP / PNG | JPEG |
| Scale | 1× / 1.5× / 2× / 3× | 2× |
| Quality | 50–100 (JPEG and WebP) | 90 |
| Background | Theme / Wallpaper / Transparent (PNG and WebP only) | Theme |

The preview shows the image size and file size as you change settings, and your choices are remembered. Then **Save**, **Copy**, or **Share** (the system share sheet — on iPhone / iPad this is how you save to Photos).

For a long message, JPEG at 2× is usually around 1 MB; WebP is about half that; PNG is several times larger.

### Good to know

- **Copy is always PNG.** Browsers only accept PNG images on the clipboard; scale and background still follow your settings.
- **Wallpaper** fills the whole image, including its blur. On a long message the wallpaper is enlarged to cover it, so you see part of it rather than exactly what was behind the message on screen. Older Safari versions draw it without blur.
- **Very long messages** may exceed what the browser can draw at the chosen scale; the scale is lowered automatically and the preview tells you.
- **Safari can't export WebP**; it falls back to PNG or JPEG and the preview tells you.
- Images in a message that are hosted on other sites may come out blank if that site doesn't allow it.

The interface follows SillyTavern's language: Simplified Chinese, Traditional Chinese, or English.

## 中文

酒馆（SillyTavern）扩展：把单独一楼存成一张图片，所见即所得。

- **屏幕上什么样，图就什么样。** regex 改写或隐藏的内容、角色卡和脚本加进来的面板、酒馆助手的界面、折叠块是开是关，都和屏幕上一致。
- **跟着主题走。** 颜色、字体、消息框都用你当前的酒馆主题。
- **只截这一楼的内容。** 名字行、按钮、swipe 箭头、计时这些界面零件不进图。

### 安装

酒馆里打开 **扩展**（方块图标）→ **安装扩展**，填入

```
https://github.com/ALeafWolf/st-message-snapshot
```

然后刷新页面。以后更新在扩展管理里点更新即可。

### 使用

点开某一楼的 **…** 菜单，点 **相机** 按钮，弹出预览，可以调：

| 选项 | 取值 | 默认 |
| --- | --- | --- |
| 格式 | JPEG / WebP / PNG | JPEG |
| 清晰度 | 1× / 1.5× / 2× / 3× | 2× |
| 质量 | 50–100（JPEG、WebP） | 90 |
| 底色 | 主题 / 壁纸 / 透明（仅 PNG、WebP） | 主题 |

调的时候预览会显示图片尺寸和文件大小，选过的设置会记住。然后 **保存**、**复制** 或 **分享**（调系统分享面板，iPhone / iPad 存相册走这里）。

一楼长消息用 JPEG 2× 一般在 1 MB 左右，WebP 约一半，PNG 会大好几倍。

### 说明

- **复制出来总是 PNG。** 浏览器的剪贴板只收 PNG；清晰度和底色仍按你的设置。
- **壁纸** 会铺满整张图，连模糊效果一起。长消息会把壁纸放大铺满，看到的是壁纸的一部分，不是屏幕上那一屏的背景。旧版 Safari 画出来不带模糊。
- **特别长的楼** 在所选清晰度下可能超出浏览器能画的大小，会自动降低清晰度，预览里有提示。
- **Safari 导不出 WebP**，会自动改用 PNG 或 JPEG，预览里有提示。
- 消息里引用的外站图片，如果对方网站不允许，截出来可能是空白。

界面语言跟着酒馆走：简体中文、繁体中文或英文。

---

Built on [snapdom](https://github.com/zumerlab/snapdom) (MIT). Maintainer notes: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
