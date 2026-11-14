// 长楼分张：量出正文里每一行字、每张图的上下边界，切点只落在它们之间的空隙里。
// 这里只算坐标，不碰画布；坐标都是相对楼层顶边的 CSS 像素。

/** 不能从中间切开的整块内容。 */
const SOLID = "img, svg, canvas, video, picture, hr, input, textarea, select, button, object, embed";

/** 字形的墨迹只占行框中间一段；上下各让出这么多，行框互相贴着或略有重叠时仍然找得到行缝。 */
const TEXT_INSET = 0.15;

/**
 * 收集 root 里所有「切不得」的纵向区间。
 * @param {Element} root 楼层
 * @returns {{top:number,bottom:number}[]} 合并、排好序的区间
 */
export function collectObstacles(root) {
    const origin = root.getBoundingClientRect();
    const spans = [];
    gather(root, origin.left, origin.top, 1, spans);
    const height = origin.height;
    const clipped = spans
        .map((s) => ({ top: Math.max(0, s.top), bottom: Math.min(height, s.bottom) }))
        .filter((s) => s.bottom - s.top > 0.5)
        .sort((a, b) => a.top - b.top);
    const merged = [];
    for (const s of clipped) {
        const last = merged[merged.length - 1];
        if (last && s.top <= last.bottom) last.bottom = Math.max(last.bottom, s.bottom);
        else merged.push({ ...s });
    }
    return merged;
}

/** dx/dy：这份文档的视口原点在楼层坐标里的位置（iframe 里的坐标要先换算出来）；zoom：iframe 被缩放的倍数。 */
function gather(root, dx, dy, zoom, out) {
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    const push = (rect, inset = 0) => {
        if (!rect.width || !rect.height) return;
        const cut = rect.height * inset;
        out.push({ top: (rect.top + cut) * zoom - dy, bottom: (rect.bottom - cut) * zoom - dy });
    };

    const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    const range = doc.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!/\S/.test(node.nodeValue)) continue;
        const style = node.parentElement && view.getComputedStyle(node.parentElement);
        if (!style || style.visibility === "hidden") continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) push(rect, TEXT_INSET);
    }

    for (const el of root.querySelectorAll(SOLID)) push(el.getBoundingClientRect());

    for (const frame of root.querySelectorAll("iframe")) {
        const rect = frame.getBoundingClientRect();
        let inner = null;
        try { inner = frame.contentDocument; } catch { /* 跨域 */ }
        if (!inner?.body) { push(rect); continue; }
        // iframe 内的坐标以它自己的视口为原点；外面套了 transform: scale 时按比例换算。
        const k = frame.offsetWidth ? rect.width / frame.offsetWidth : 1;
        const left = rect.left + frame.clientLeft * k;
        const top = rect.top + frame.clientTop * k;
        gather(inner.body, dx - left * zoom, dy - top * zoom, zoom * k, out);
    }
}

/**
 * 把 [0, height] 切成每段不超过 maxHeight 的几段。
 * 段数取最少；每段尽量一样高，切点挑目标位置附近最宽的空隙（段落之间的空隙比行缝宽）。
 * 找不到空隙（比如一张比整段还高的图）就在上限处硬切。
 * @returns {{top:number,bottom:number,hard:boolean}[]}
 */
export function planSlices(height, maxHeight, obstacles) {
    if (height <= maxHeight) return [{ top: 0, bottom: height, hard: false }];
    const gaps = [];
    for (let i = 0; i + 1 < obstacles.length; i++) {
        const top = obstacles[i].bottom;
        const bottom = obstacles[i + 1].top;
        if (bottom - top >= 1) gaps.push({ mid: (top + bottom) / 2, size: bottom - top });
    }
    const slices = [];
    let start = 0;
    while (height - start > maxHeight) {
        const left = Math.ceil((height - start) / maxHeight);
        const ideal = (height - start) / left;
        const limit = start + maxHeight;
        const near = gaps.filter((g) => g.mid > start + ideal * 0.75 && g.mid <= Math.min(limit, start + ideal * 1.2));
        const any = near.length ? near : gaps.filter((g) => g.mid > start + maxHeight * 0.25 && g.mid <= limit);
        let cut = limit;
        let hard = true;
        if (any.length) {
            const target = start + ideal;
            const widest = Math.max(...any.map((g) => g.size));
            // 宽度相差不到一半的都算「一样宽」，在里面挑离目标最近的。
            const best = any.filter((g) => g.size >= widest * 0.5)
                .reduce((a, b) => (Math.abs(a.mid - target) <= Math.abs(b.mid - target) ? a : b));
            cut = Math.round(best.mid);
            hard = false;
        }
        slices.push({ top: start, bottom: cut, hard });
        start = cut;
    }
    slices.push({ top: start, bottom: height, hard: false });
    return slices;
}
