// 单楼存图：截的是渲染完的 .mes_block，regex、卡脚本插的面板、酒馆助手 iframe、折叠块开合都按屏幕上的样子进图。
import { snapdom } from "./lib/snapdom.mjs";
import { collectObstacles, planSlices } from "./slices.js";

const MODULE = "messageSnapshot";
const DEFAULTS = { format: "jpeg", scale: 2, quality: 90, background: "theme" };
const FORMATS = {
    jpeg: { label: "JPEG", mime: "image/jpeg", ext: "jpg", lossy: true, alpha: false },
    webp: { label: "WebP", mime: "image/webp", ext: "webp", lossy: true, alpha: true },
    png: { label: "PNG", mime: "image/png", ext: "png", lossy: false, alpha: true },
};
const SCALES = [1, 1.5, 2, 3];
const PAD = 16;

// 楼层上的界面零件，不算内容。其余凡是屏幕上看得见的都截。
const CHROME = [
    ".ch_name", ".mes_buttons", ".mes_edit_buttons", ".mes_timer", ".tokenCounterDisplay", ".mesIDDisplay",
    ".swipe_left", ".swipe_right", ".swipes-counter", ".mes_bias", ".mes_reasoning_actions",
];

// 单张画布上限：iOS / Safari 约 1677 万像素（超了 toBlob 静默给空图），桌面浏览器单边 32767。
// 安卓 WebView 的上限随机型变、查不到，先按下面的数试，画出来发现底部是空的就对半降（见 sideCap）。
// 一张放不下的长楼按行缝切成几张，不降清晰度。
const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
    || /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const ANDROID = /android/i.test(navigator.userAgent);
const MAX_AREA = SAFARI ? 16_000_000 : ANDROID ? 32_000_000 : 120_000_000;
const MAX_SIDE = SAFARI || ANDROID ? 16_000 : 32_000;
const MIN_SIDE = 2_000;
const CAP_KEY = "messageSnapshot.sideCap";
// 屏幕像素密度也算进倍率（手机上 1 个 CSS 像素是 2–3 个屏幕像素），但不超过这个数：再高只是文件变大。
const MAX_DENSITY = 3;
// 原图总像素不超过这个数才留在内存里（换格式、质量、底色时不用重画）；再大就每次重画，省内存。
const KEEP_PIXELS = 40_000_000;

// 界面文字。不走酒馆的 addLocaleData：它拿英文原句当键、不许覆盖已有条目，"Save"、"Copy" 这类词会被酒馆自己的译法顶掉。
const STRINGS = {
    en: {
        saveAsImage: "Save as image",
        format: "Format",
        scale: "Scale",
        quality: "Quality",
        background: "Background",
        bgTheme: "Theme",
        bgWallpaper: "Wallpaper",
        bgTransparent: "Transparent",
        bgTransparentAlphaOnly: "Transparent (PNG / WebP only)",
        generating: "Generating…",
        failed: "Failed to generate",
        save: "Save",
        copy: "Copy",
        share: "Share",
        close: "Close",
        copyAs: "Copy {format}",
        copyAsPng: "The clipboard only accepts PNG: copies a PNG at the current scale and background. {format} and quality apply to Save and Share only.",
        copied: "Copied to clipboard",
        copyFailed: "Copy failed: {error}",
        shareFailed: "Share failed: {error}",
        scaleClamped: "Image exceeds the browser's canvas limit; scale lowered to {scale}×",
        pieces: "{count} images",
        widthPx: "{width}px wide",
        total: "{size} total",
        split: "Too long for one image: split between lines into {count} images",
        capLowered: "This browser cut off tall images; each image is now limited to {px}px",
        maybeCut: "The bottom of an image may be incomplete",
        noWallpaper: "No usable wallpaper found; using the theme background",
        wallpaperLoadFailed: "Failed to load the wallpaper",
        noEncoder: "This browser can't export {format}; using {fallback}",
        canvasTooBig: "The image is too large for the browser to generate",
        noteSeparator: "; ",
    },
    "zh-cn": {
        saveAsImage: "存为图片",
        format: "格式",
        scale: "清晰度",
        quality: "质量",
        background: "底色",
        bgTheme: "主题",
        bgWallpaper: "壁纸",
        bgTransparent: "透明",
        bgTransparentAlphaOnly: "透明（仅 PNG / WebP）",
        generating: "生成中…",
        failed: "生成失败",
        save: "保存",
        copy: "复制",
        share: "分享",
        close: "关闭",
        copyAs: "复制 {format}",
        copyAsPng: "剪贴板只收 PNG：按当前清晰度和底色复制为 PNG，{format} 与质量设置只作用于保存和分享",
        copied: "已复制到剪贴板",
        copyFailed: "复制失败：{error}",
        shareFailed: "分享失败：{error}",
        scaleClamped: "长图超过浏览器画布上限，清晰度已降到 {scale}×",
        pieces: "共 {count} 张",
        widthPx: "宽 {width}px",
        total: "合计 {size}",
        split: "一张放不下，已按行缝分成 {count} 张",
        capLowered: "这个浏览器画不全太高的图，每张已限制在 {px}px 以内",
        maybeCut: "图片底部可能没画全",
        noWallpaper: "没找到能用的壁纸，已改用主题底色",
        wallpaperLoadFailed: "壁纸加载失败",
        noEncoder: "这个浏览器导不出 {format}，已改用 {fallback}",
        canvasTooBig: "画布太大，浏览器没能生成图片",
        noteSeparator: "；",
    },
    "zh-tw": {
        saveAsImage: "存為圖片",
        format: "格式",
        scale: "清晰度",
        quality: "品質",
        background: "底色",
        bgTheme: "主題",
        bgWallpaper: "桌布",
        bgTransparent: "透明",
        bgTransparentAlphaOnly: "透明（僅 PNG / WebP）",
        generating: "產生中…",
        failed: "產生失敗",
        save: "儲存",
        copy: "複製",
        share: "分享",
        close: "關閉",
        copyAs: "複製 {format}",
        copyAsPng: "剪貼簿只收 PNG：按目前清晰度和底色複製為 PNG，{format} 與品質設定只作用於儲存和分享",
        copied: "已複製到剪貼簿",
        copyFailed: "複製失敗：{error}",
        shareFailed: "分享失敗：{error}",
        scaleClamped: "長圖超過瀏覽器畫布上限，清晰度已降到 {scale}×",
        pieces: "共 {count} 張",
        widthPx: "寬 {width}px",
        total: "合計 {size}",
        split: "一張放不下，已按行縫分成 {count} 張",
        capLowered: "這個瀏覽器畫不全太高的圖，每張已限制在 {px}px 以內",
        maybeCut: "圖片底部可能沒畫全",
        noWallpaper: "找不到可用的桌布，已改用主題底色",
        wallpaperLoadFailed: "桌布載入失敗",
        noEncoder: "這個瀏覽器匯不出 {format}，已改用 {fallback}",
        canvasTooBig: "畫布太大，瀏覽器沒能產生圖片",
        noteSeparator: "；",
    },
};

/** 酒馆界面语言 → 字典。繁体：zh-tw / zh-hk / zh-hant；其余中文走简体；别的语言都用英文。 */
function pickStrings() {
    const locale = String(SillyTavern.getContext().getCurrentLocale?.() || navigator.language || "en").toLowerCase();
    if (!locale.startsWith("zh")) return STRINGS.en;
    return /tw|hk|mo|hant/.test(locale) ? STRINGS["zh-tw"] : STRINGS["zh-cn"];
}
const LANG = pickStrings();

/** 取文字并填 {占位}。 */
const tr = (key, vars = {}) => (LANG[key] ?? STRINGS.en[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// 酒馆把 <q> 的默认引号去掉了（::before/::after 的 content 是 ""），snapdom 不复制空 content，
// 克隆里浏览器默认的 open-quote 又冒出来 →「“"If …"”」。在克隆里压回去。
const quoteFix = {
    name: "st-q-quotes",
    afterClone(context) {
        const style = document.createElement("style");
        style.textContent = "q::before,q::after{content:none!important}";
        context.clone.prepend(style);
    },
};

const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    all[MODULE] = { ...DEFAULTS, ...all[MODULE] };
    return all[MODULE];
}

function saveSettings(patch) {
    Object.assign(settings(), patch);
    ctx().saveSettingsDebounced();
}

/** 单张图的边长上限。画出来发现被截断过的浏览器会记住一个更小的数。 */
function sideCap() {
    let learned = 0;
    try { learned = Number(localStorage.getItem(CAP_KEY)) || 0; } catch { /* 存储不可用 */ }
    return learned >= MIN_SIDE ? Math.min(learned, MAX_SIDE) : MAX_SIDE;
}

function lowerSideCap(px) {
    try { localStorage.setItem(CAP_KEY, String(px)); } catch { /* 存储不可用 */ }
}

/** 所选清晰度在这块屏幕上想要的倍率：× 屏幕像素密度，封顶 MAX_DENSITY（所选更高就按所选）。 */
function wantedDensity(wanted) {
    return Math.min(wanted * (window.devicePixelRatio || 1), Math.max(wanted, MAX_DENSITY));
}

/** 图上每个 CSS 像素实际占几个像素：想要的倍率，但不让宽度超限。 */
function density(block, wanted) {
    const k = wantedDensity(wanted);
    const limit = sideCap() / (block.offsetWidth + PAD * 2);
    return k <= limit ? k : Math.floor(limit * 10) / 10;
}

/** 一张图最多放多高的正文（CSS 像素），边距另算。 */
function sliceHeight(width, k) {
    const px = Math.min(sideCap(), MAX_AREA / ((width + PAD * 2) * k));
    return Math.max(200, Math.floor(px / k) - PAD * 2);
}

const isClear = (color) => !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";

/** 楼层祖先的底色，从外到内。body 的底色在壁纸下面（画布传播），壁纸模式要单独垫。 */
function ancestorFills(block, includeBody) {
    const layers = [];
    for (let el = block.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === document.body && !includeBody) break;
        const bg = getComputedStyle(el).backgroundColor;
        if (!isClear(bg)) layers.unshift(bg);
    }
    return layers;
}

/** 主题底色：不画壁纸，用主题遮罩色兜底。 */
function themeLayers(block) {
    const tint = getComputedStyle(document.body).getPropertyValue("--SmartThemeBlurTintColor").trim();
    return ["#000", ...(tint ? [tint] : []), ...ancestorFills(block, true)];
}

function fill(g, layers) {
    for (const color of layers) {
        g.fillStyle = color;
        g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    }
}

/** 屏幕上的壁纸：聊天专属背景 #bg_custom 优先，其次 #bg1；图片或视频当前帧。 */
function wallpaperSource() {
    for (const el of document.querySelectorAll("#bg_custom, #bg1")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
        const video = el.querySelector("video");
        if (video?.videoWidth) return { cs, media: video };
        const m = /url\("?(.+?)"?\)/.exec(cs.backgroundImage);
        if (m) return { cs, url: m[1] };
    }
    return null;
}

const wallpaperCache = new Map(); // url → 已解码的 Image
function loadImage(url) {
    if (!wallpaperCache.has(url)) {
        wallpaperCache.set(url, new Promise((ok, bad) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = () => { wallpaperCache.delete(url); bad(new Error(tr("wallpaperLoadFailed"))); };
            img.src = url;
        }));
    }
    return wallpaperCache.get(url);
}

/** background-position 的一个分量 → 0..1；px 之类没法按长图换算的取居中。 */
const positionFraction = (v) => (v?.endsWith("%") ? parseFloat(v) / 100 : 0.5);

/** 按 background-size / position 把壁纸铺满整张图，带上壁纸元素自己的 filter（酒馆默认 blur）。 */
async function drawWallpaper(g, scale) {
    const src = wallpaperSource();
    if (!src) return false;
    const media = src.media || await loadImage(src.url);
    const iw = media.videoWidth || media.naturalWidth;
    const ih = media.videoHeight || media.naturalHeight;
    if (!iw || !ih) return false;
    const filter = src.cs.filter === "none" ? "none" : src.cs.filter.replace(/(-?[\d.]+)px/g, (_, n) => `${n * scale}px`);
    // 模糊会把画布外的透明吸进来，边上发暗；四周多铺出两倍半径。
    const over = 2 * Math.max(0, ...[...filter.matchAll(/blur\(([\d.]+)px\)/g)].map((m) => Number(m[1])));
    const w = g.canvas.width + over * 2;
    const h = g.canvas.height + over * 2;
    const k = src.cs.backgroundSize === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
    const [px, py] = src.cs.backgroundPosition.split(" ");
    g.save();
    g.filter = filter; // Safari 旧版不认 ctx.filter，退化成不模糊
    g.drawImage(media, (w - iw * k) * positionFraction(px) - over, (h - ih * k) * positionFraction(py ?? px) - over, iw * k, ih * k);
    g.restore();
    return true;
}

/** 截图期间把界面零件在页面上也藏起来：量行缝要和克隆里的排版一致（克隆里它们被删掉了）。 */
function hideChrome(block) {
    const saved = [...block.querySelectorAll(CHROME.join(","))].map((el) => {
        const entry = [el, el.style.getPropertyValue("display"), el.style.getPropertyPriority("display")];
        el.style.setProperty("display", "none", "important");
        return entry;
    });
    return () => {
        for (const [el, value, priority] of saved) {
            if (value) el.style.setProperty("display", value, priority);
            else el.style.removeProperty("display");
        }
    };
}

/** snapdom 写进 SVG 的 viewBox（CSS 像素）：可截区域以它为准。读不出来给空数组。 */
function viewBox(dataUrl) {
    try {
        // <svg …> 在最前面，全是 ASCII；只解开头一小段，免得切在多字节字符中间。
        const head = decodeURIComponent(dataUrl.slice(0, 600).replace(/%[0-9A-Fa-f]?$/, ""));
        const tag = head.match(/<svg\b[^>]*>/i)?.[0] || "";
        return (/\bviewBox="([^"]+)"/i.exec(tag)?.[1] || "").trim().split(/[\s,]+/).map(Number);
    } catch {
        return [];
    }
}

/** 克隆一次：之后每一张都从这份克隆里按区域取，不重新克隆。 */
async function capture(block, k) {
    await document.fonts?.ready;
    const restore = hideChrome(block);
    try {
        const obstacles = collectObstacles(block);
        const shot = await snapdom(block, {
            scale: k, dpr: 1, embedFonts: true, exclude: CHROME, excludeMode: "remove", plugins: [quoteFix],
        });
        const box = viewBox(shot.url);
        const view = box.length === 4 && box.every(Number.isFinite)
            ? { x: box[0], y: box[1], width: box[2], height: box[3] }
            : { x: 0, y: 0, width: block.offsetWidth, height: block.offsetHeight };
        return { shot, view, obstacles, kept: new Map(), slicedFor: 0 };
    } finally {
        restore();
    }
}

/** 取第 i 张的原图（透明底）。 */
async function sliceCanvas(cap, slices, i) {
    if (cap.kept.has(i)) return cap.kept.get(i);
    if (slices.length === 1) return cap.shot.toCanvas();
    const { top, bottom } = slices[i];
    return cap.shot.toCanvas({ crop: { x: cap.view.x, y: cap.view.y + top, width: cap.view.width, height: bottom - top } });
}

/**
 * 浏览器画不动太高的图时不报错，只是底部留空。这里拿量好的行位置去对：
 * 这张图靠下的几行字所在的位置如果全是透明的，就是没画全。楼层自己有底色时判不出来，按画全了算。
 */
function looksTruncated(canvas, slice, obstacles, k) {
    const floor = slice.top + (slice.bottom - slice.top) * 0.6;
    const lines = obstacles.filter((o) => o.top >= floor && o.bottom <= slice.bottom).slice(-5);
    if (!lines.length) return false;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    for (const line of lines) {
        const y = Math.floor((line.top - slice.top) * k);
        const h = Math.min(canvas.height - y, Math.max(1, Math.ceil((line.bottom - line.top) * k)));
        if (h < 1) continue;
        const data = g.getImageData(0, y, canvas.width, h).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return false;
    }
    return true;
}

async function compose(raw, block, scale, background) {
    const pad = Math.round(PAD * scale);
    const canvas = document.createElement("canvas");
    canvas.width = raw.width + pad * 2;
    canvas.height = raw.height + pad * 2;
    const g = canvas.getContext("2d");
    let note = "";
    if (background === "wallpaper") {
        fill(g, ["#000", getComputedStyle(document.body).backgroundColor]);
        const drawn = await drawWallpaper(g, scale).catch((err) => {
            console.warn("[message-snapshot]", err);
            return false;
        });
        if (drawn) {
            fill(g, ancestorFills(block, false));
        } else {
            note = tr("noWallpaper");
            fill(g, themeLayers(block));
        }
    } else if (background === "theme") {
        fill(g, themeLayers(block));
    }
    g.drawImage(raw, pad, pad);
    return { canvas, note };
}

const toBlob = (canvas, mime, quality) => new Promise((ok) => canvas.toBlob(ok, mime, quality));

// 剪贴板写图片目前各浏览器只收 PNG；哪天支持别的格式了就直接复制当前格式。
const canCopy = (mime) => mime === "image/png" || !!globalThis.ClipboardItem?.supports?.(mime);

/** 浏览器不会编码的格式（Safari 的 WebP）toBlob 会悄悄给 PNG，这里认出来换掉。 */
async function encode(canvas, format, quality) {
    const f = FORMATS[format];
    const blob = await toBlob(canvas, f.mime, f.lossy ? quality / 100 : undefined);
    if (blob && blob.type === f.mime) return { blob, format, note: "" };
    const fallback = f.alpha ? "png" : "jpeg";
    const again = await toBlob(canvas, FORMATS[fallback].mime, quality / 100);
    if (!again) throw new Error(tr("canvasTooBig"));
    return { blob: again, format: fallback, note: tr("noEncoder", { format: f.label, fallback: FORMATS[fallback].label }) };
}

function fileName(mes, ext, part = "") {
    const id = mes.getAttribute("mesid");
    const name = ctx().chat?.[id]?.name || ctx().name2 || "message";
    return `${name} #${id}${part}.${ext}`.replace(/[\\/:*?"<>|]/g, "_");
}

/** JPEG 没有透明通道，选了透明也只能用主题底色；设置里仍记着透明，切回 PNG / WebP 时恢复。 */
const effectiveBackground = (s) => (s.background === "transparent" && !FORMATS[s.format].alpha ? "theme" : s.background);

const kb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

function optionList(pairs, current) {
    return pairs.map(([value, label]) => `<option value="${value}"${String(value) === String(current) ? " selected" : ""}>${label}</option>`).join("");
}

function dialogHtml(s) {
    const backgrounds = [["theme", tr("bgTheme")], ["wallpaper", tr("bgWallpaper")], ["transparent", tr("bgTransparent")]];
    return `
<div class="mss-dialog" role="dialog" aria-label="${tr("saveAsImage")}">
  <div class="mss-controls">
    <label>${tr("format")}<select class="text_pole" data-k="format">${optionList(Object.entries(FORMATS).map(([k, f]) => [k, f.label]), s.format)}</select></label>
    <label>${tr("scale")}<select class="text_pole" data-k="scale">${optionList(SCALES.map((n) => [n, `${n}×`]), s.scale)}</select></label>
    <label class="mss-quality">${tr("quality")}<input type="range" min="50" max="100" step="5" data-k="quality" value="${s.quality}"><span>${s.quality}</span></label>
    <label>${tr("background")}<select class="text_pole" data-k="background">${optionList(backgrounds, s.background)}</select></label>
  </div>
  <div class="mss-info"><span class="mss-size">${tr("generating")}</span><span class="mss-note"></span></div>
  <div class="mss-preview"></div>
  <div class="mss-actions">
    <div class="menu_button mss-save"><i class="fa-solid fa-download"></i>${tr("save")}</div>
    <div class="menu_button mss-copy"><i class="fa-solid fa-copy"></i>${tr("copy")}</div>
    <div class="menu_button mss-share" hidden><i class="fa-solid fa-share-nodes"></i>${tr("share")}</div>
    <div class="menu_button mss-close"><i class="fa-solid fa-xmark"></i>${tr("close")}</div>
  </div>
</div>`;
}

async function openSnapshot(mes) {
    const block = mes.querySelector(".mes_block");
    if (!block || document.querySelector(".mss-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "mss-overlay";
    overlay.innerHTML = dialogHtml(settings());
    document.body.append(overlay);
    const $ = (sel) => overlay.querySelector(sel);
    const preview = $(".mss-preview");

    const captures = new Map(); // 倍率 → 克隆；换格式、质量、底色不用重新克隆
    let results = []; // 每张一项：{ blob, format, file, url, width, height, canvas }
    let busy = false;
    let pending = false;

    const syncControls = () => {
        const s = settings();
        $(".mss-quality").hidden = !FORMATS[s.format].lossy;
        $(".mss-quality span").textContent = s.quality;
        // JPEG 没有透明通道：选项留着、置灰并说明，切回 PNG / WebP 时恢复之前选的底色。
        const alpha = FORMATS[s.format].alpha;
        const transparent = $('[data-k="background"] option[value="transparent"]');
        transparent.disabled = !alpha;
        transparent.textContent = alpha ? tr("bgTransparent") : tr("bgTransparentAlphaOnly");
        $('[data-k="background"]').value = effectiveBackground(s);
    };

    const release = (list) => { for (const r of list) URL.revokeObjectURL(r.url); };

    /** 按当前设置出全部分张。发现浏览器没画全就降单张上限重来，最多降到 MIN_SIDE。 */
    async function produce(s, notes) {
        for (;;) {
            const k = density(block, Number(s.scale));
            if (!captures.has(k)) captures.set(k, await capture(block, k));
            const cap = captures.get(k);
            const slices = planSlices(cap.view.height, sliceHeight(cap.view.width, k), cap.obstacles);
            if (cap.slicedFor !== slices.length) { cap.kept.clear(); cap.slicedFor = slices.length; }
            const keep = cap.view.width * cap.view.height * k * k <= KEEP_PIXELS;
            const made = [];
            let retry = false;
            for (let i = 0; i < slices.length; i++) {
                const raw = await sliceCanvas(cap, slices, i);
                if (!cap.kept.has(i) && looksTruncated(raw, slices[i], cap.obstacles, k)) {
                    if (raw.height > MIN_SIDE) {
                        const px = Math.max(MIN_SIDE, Math.floor(raw.height / 2));
                        console.warn(`[message-snapshot] ${raw.width}×${raw.height} came out blank at the bottom; limiting images to ${px}px`);
                        lowerSideCap(px);
                        notes.cap = tr("capLowered", { px });
                        retry = true;
                        break;
                    }
                    notes.cut = tr("maybeCut");
                }
                if (keep) cap.kept.set(i, raw);
                const composed = await compose(raw, block, k, effectiveBackground(s));
                if (composed.note) notes.wallpaper = composed.note;
                const encoded = await encode(composed.canvas, s.format, s.quality);
                if (encoded.note) notes.encoder = encoded.note;
                const part = slices.length > 1 ? `-${i + 1}` : "";
                const file = new File([encoded.blob], fileName(mes, FORMATS[encoded.format].ext, part), { type: encoded.blob.type });
                made.push({
                    blob: encoded.blob, format: encoded.format, file, url: URL.createObjectURL(encoded.blob),
                    width: composed.canvas.width, height: composed.canvas.height,
                    // 只有一张时留着画布，复制要用它转 PNG；多张时不留，省内存。
                    canvas: slices.length === 1 ? composed.canvas : null,
                });
                if (slices.length > 1) composed.canvas.width = 0;
                if (!keep) raw.width = 0;
            }
            if (!retry) return { made, k, slices };
            release(made);
            cap.kept.clear();
        }
    }

    async function render() {
        if (busy) { pending = true; return; }
        busy = true;
        overlay.classList.add("mss-busy");
        try {
            const s = settings();
            const notes = {};
            const { made, k, slices } = await produce(s, notes);
            release(results);
            results = made;
            preview.replaceChildren(...made.map((r) => {
                const img = document.createElement("img");
                img.alt = "";
                img.src = r.url;
                img.style.width = `${r.width / k}px`;
                return img;
            }));
            const label = FORMATS[made[0].format].label;
            const bytes = made.reduce((sum, r) => sum + r.blob.size, 0);
            $(".mss-size").textContent = made.length === 1
                ? `${made[0].width}×${made[0].height} · ${label} · ${kb(bytes)}`
                : [tr("pieces", { count: made.length }), tr("widthPx", { width: made[0].width }), label, tr("total", { size: kb(bytes) })].join(" · ");
            const list = [];
            if (k < wantedDensity(Number(s.scale))) {
                list.push(tr("scaleClamped", { scale: Math.round(k / (window.devicePixelRatio || 1) * 10) / 10 }));
            }
            if (slices.length > 1) list.push(tr("split", { count: slices.length }));
            list.push(...Object.values(notes));
            $(".mss-note").textContent = list.join(tr("noteSeparator"));
            // 剪贴板一次只收一张图：分了张就不提供复制。
            $(".mss-copy").hidden = made.length > 1;
            $(".mss-copy").title = canCopy(made[0].blob.type) ? tr("copyAs", { format: label }) : tr("copyAsPng", { format: label });
            $(".mss-share").hidden = !navigator.canShare?.({ files: made.map((r) => r.file) });
        } catch (err) {
            console.error("[message-snapshot]", err);
            $(".mss-size").textContent = tr("failed");
            $(".mss-note").textContent = String(err?.message || err);
        } finally {
            busy = false;
            overlay.classList.remove("mss-busy");
            if (pending) { pending = false; render(); }
        }
    }

    function close() {
        release(results);
        results = [];
        captures.clear();
        overlay.remove();
        document.removeEventListener("keydown", onKey);
    }
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);

    let qualityTimer = 0;
    overlay.addEventListener("input", (e) => {
        const k = e.target.dataset?.k;
        if (!k) return;
        const value = k === "scale" || k === "quality" ? Number(e.target.value) : e.target.value;
        saveSettings({ [k]: value });
        syncControls();
        clearTimeout(qualityTimer);
        qualityTimer = setTimeout(render, k === "quality" ? 200 : 0);
    });

    overlay.addEventListener("click", async (e) => {
        if (e.target === overlay || e.target.closest(".mss-close")) return close();
        if (!results.length || busy) return;
        if (e.target.closest(".mss-save")) {
            // 多张逐个下载；浏览器第一次可能问一句是否允许下载多个文件。
            for (const [i, r] of results.entries()) {
                if (i) await new Promise((ok) => setTimeout(ok, 400));
                const a = document.createElement("a");
                a.href = r.url;
                a.download = r.file.name;
                a.click();
            }
        } else if (e.target.closest(".mss-copy")) {
            try {
                const r = results[0];
                const blob = canCopy(r.blob.type) ? r.blob : await toBlob(r.canvas, "image/png");
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                toastr.success(tr("copied"));
            } catch (err) {
                toastr.error(tr("copyFailed", { error: err?.message || err }));
            }
        } else if (e.target.closest(".mss-share")) {
            try {
                await navigator.share({ files: results.map((r) => r.file) });
            } catch (err) {
                if (err?.name !== "AbortError") toastr.error(tr("shareFailed", { error: err?.message || err }));
            }
        }
    });

    syncControls();
    render();
}

const BUTTON = `<div title="${tr("saveAsImage")}" class="mes_button mes_snapshot fa-solid fa-camera interactable" tabindex="0" role="button"></div>`;

/** 模板里加一次，之后新渲染的楼层自带；已经在页面上的楼层补上。 */
function addButtons() {
    for (const box of document.querySelectorAll("#message_template .extraMesButtons, #chat .mes .extraMesButtons")) {
        if (!box.querySelector(".mes_snapshot")) box.insertAdjacentHTML("afterbegin", BUTTON);
    }
}

addButtons();
document.addEventListener("click", (e) => {
    const button = e.target.closest?.(".mes_snapshot");
    if (button) openSnapshot(button.closest(".mes"));
});
document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("mes_snapshot")) {
        e.preventDefault();
        openSnapshot(e.target.closest(".mes"));
    }
});
