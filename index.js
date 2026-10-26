// 单楼存图：截的是渲染完的 .mes_block，regex、卡脚本插的面板、酒馆助手 iframe、折叠块开合都按屏幕上的样子进图。
import { snapdom } from "./lib/snapdom.mjs";

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

// 画布上限：iOS / Safari 约 1677 万像素（超了 toBlob 静默给空图），其余浏览器单边 32767。
const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
    || /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const MAX_AREA = SAFARI ? 16_000_000 : 120_000_000;
const MAX_SIDE = SAFARI ? 16_000 : 32_000;

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

/** 能用的最大倍率：不超过所选，也不让画布超限。 */
function fitScale(block, wanted) {
    const w = block.offsetWidth + PAD * 2;
    const h = block.offsetHeight + PAD * 2;
    const limit = Math.min(Math.sqrt(MAX_AREA / (w * h)), MAX_SIDE / w, MAX_SIDE / h);
    return wanted <= limit ? wanted : Math.floor(limit * 10) / 10;
}

/** 楼层下面垫着的主题底色，从外到内依次压上。backdrop-filter 截不到，壁纸不画。 */
function themeLayers(block) {
    const layers = [];
    for (let el = block.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") layers.unshift(bg);
    }
    const tint = getComputedStyle(document.body).getPropertyValue("--SmartThemeBlurTintColor").trim();
    return ["#000", ...(tint ? [tint] : []), ...layers];
}

async function capture(block, scale) {
    await document.fonts?.ready;
    const shot = await snapdom(block, {
        scale, embedFonts: true, exclude: CHROME, excludeMode: "remove", plugins: [quoteFix],
    });
    return shot.toCanvas();
}

function compose(raw, block, scale, background) {
    const pad = Math.round(PAD * scale);
    const canvas = document.createElement("canvas");
    canvas.width = raw.width + pad * 2;
    canvas.height = raw.height + pad * 2;
    const g = canvas.getContext("2d");
    if (background === "theme") {
        for (const fill of themeLayers(block)) {
            g.fillStyle = fill;
            g.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
    g.drawImage(raw, pad, pad);
    return canvas;
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
    if (!again) throw new Error("画布太大，浏览器没能生成图片");
    return { blob: again, format: fallback, note: `这个浏览器导不出 ${f.label}，已改用 ${FORMATS[fallback].label}` };
}

function fileName(mes, ext) {
    const id = mes.getAttribute("mesid");
    const name = ctx().chat?.[id]?.name || ctx().name2 || "message";
    return `${name} #${id}.${ext}`.replace(/[\\/:*?"<>|]/g, "_");
}

const kb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

function optionList(pairs, current) {
    return pairs.map(([value, label]) => `<option value="${value}"${String(value) === String(current) ? " selected" : ""}>${label}</option>`).join("");
}

function dialogHtml(s) {
    return `
<div class="mss-dialog" role="dialog" aria-label="存为图片">
  <div class="mss-controls">
    <label>格式<select class="text_pole" data-k="format">${optionList(Object.entries(FORMATS).map(([k, f]) => [k, f.label]), s.format)}</select></label>
    <label>清晰度<select class="text_pole" data-k="scale">${optionList(SCALES.map((n) => [n, `${n}×`]), s.scale)}</select></label>
    <label class="mss-quality">质量<input type="range" min="50" max="100" step="5" data-k="quality" value="${s.quality}"><span>${s.quality}</span></label>
    <label>底色<select class="text_pole" data-k="background">${optionList([["theme", "主题"], ["transparent", "透明"]], s.background)}</select></label>
  </div>
  <div class="mss-info"><span class="mss-size">生成中…</span><span class="mss-note"></span></div>
  <div class="mss-preview"><img alt=""></div>
  <div class="mss-actions">
    <div class="menu_button mss-save"><i class="fa-solid fa-download"></i>保存</div>
    <div class="menu_button mss-copy"><i class="fa-solid fa-copy"></i>复制</div>
    <div class="menu_button mss-share" hidden><i class="fa-solid fa-share-nodes"></i>分享</div>
    <div class="menu_button mss-close"><i class="fa-solid fa-xmark"></i>关闭</div>
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
    const img = $(".mss-preview img");

    const raws = new Map(); // 倍率 → snapdom 原图；换格式、质量、底色不用重截
    let result = null;
    let url = "";
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
        transparent.textContent = alpha ? "透明" : "透明（仅 PNG / WebP）";
        $('[data-k="background"]').value = alpha ? s.background : "theme";
    };

    async function render() {
        if (busy) { pending = true; return; }
        busy = true;
        overlay.classList.add("mss-busy");
        try {
            const s = settings();
            const scale = fitScale(block, Number(s.scale));
            if (!raws.has(scale)) raws.set(scale, await capture(block, scale));
            const background = FORMATS[s.format].alpha ? s.background : "theme";
            const canvas = compose(raws.get(scale), block, scale, background);
            result = await encode(canvas, s.format, s.quality);
            result.canvas = canvas;
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(result.blob);
            img.src = url;
            img.style.width = `${canvas.width / scale}px`;
            $(".mss-size").textContent = `${canvas.width}×${canvas.height} · ${FORMATS[result.format].label} · ${kb(result.blob.size)}`;
            const notes = [];
            if (scale !== Number(s.scale)) notes.push(`长图超过浏览器画布上限，清晰度已降到 ${scale}×`);
            if (result.note) notes.push(result.note);
            $(".mss-note").textContent = notes.join("；");
            const label = FORMATS[result.format].label;
            $(".mss-copy").title = canCopy(result.blob.type)
                ? `复制 ${label}`
                : `剪贴板只收 PNG：按当前清晰度和底色复制为 PNG，${label} 与质量设置只作用于保存和分享`;
            const file = new File([result.blob], fileName(mes, FORMATS[result.format].ext), { type: result.blob.type });
            $(".mss-share").hidden = !navigator.canShare?.({ files: [file] });
            result.file = file;
        } catch (err) {
            console.error("[message-snapshot]", err);
            $(".mss-size").textContent = "生成失败";
            $(".mss-note").textContent = String(err?.message || err);
        } finally {
            busy = false;
            overlay.classList.remove("mss-busy");
            if (pending) { pending = false; render(); }
        }
    }

    function close() {
        if (url) URL.revokeObjectURL(url);
        raws.clear();
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
        if (!result || busy) return;
        if (e.target.closest(".mss-save")) {
            const a = document.createElement("a");
            a.href = url;
            a.download = result.file.name;
            a.click();
        } else if (e.target.closest(".mss-copy")) {
            try {
                const blob = canCopy(result.blob.type) ? result.blob : await toBlob(result.canvas, "image/png");
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                toastr.success("已复制到剪贴板");
            } catch (err) {
                toastr.error(`复制失败：${err?.message || err}`);
            }
        } else if (e.target.closest(".mss-share")) {
            try {
                await navigator.share({ files: [result.file] });
            } catch (err) {
                if (err?.name !== "AbortError") toastr.error(`分享失败：${err?.message || err}`);
            }
        }
    });

    syncControls();
    render();
}

const BUTTON = '<div title="存为图片" class="mes_button mes_snapshot fa-solid fa-camera interactable" tabindex="0" role="button"></div>';

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
