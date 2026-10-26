// 原型：把倒数第二楼截成一张 PNG，弹在页面上看。不改聊天、不存任何东西。
(async () => {
  const SNAPDOM = "https://cdn.jsdelivr.net/npm/@zumer/snapdom@3.3.4/dist/snapdom.js";
  if (!window.snapdom) {
    await new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = SNAPDOM; s.onload = ok; s.onerror = () => bad(new Error("snapdom 加载失败"));
      document.head.append(s);
    });
  }

  const all = [...document.querySelectorAll("#chat .mes")];
  const mes = all[all.length - 2];
  const block = mes.querySelector(".mes_block");

  // 楼层界面零件：名字行、按钮、swipe、计时、思维链
  const EXCLUDE = [
    ".ch_name", ".mes_buttons", ".mes_edit_buttons", ".extraMesButtons", ".mes_timer", ".tokenCounterDisplay",
    ".mesIDDisplay", ".swipe_left", ".swipe_right", ".swipes-counter", ".mes_bias", ".mes_reasoning_details",
  ];

  // 截图前先记下这一楼的结构，好判断都截到了什么
  const report = {
    mesid: mes.getAttribute("mesid"),
    children: [...block.children].map((c) => c.className.split(" ")[0] || c.tagName),
    iframes: [...block.querySelectorAll("iframe")].map((f) => {
      let sameOrigin = false;
      try { sameOrigin = !!f.contentDocument; } catch {}
      return { h: f.offsetHeight, sameOrigin, src: (f.getAttribute("src") || "srcdoc").slice(0, 60) };
    }),
    details: [...block.querySelectorAll("details")].map((d) => `${d.className.split(" ")[0]}:${d.open ? "open" : "closed"}`),
  };

  // 酒馆把 <q> 的默认引号去掉了（::before/::after content 是 ""），snapdom 不复制空 content，
  // 克隆里浏览器默认的 open-quote 又冒出来 →「“"If …"”」。克隆里补一条规则压回去。
  const quoteFix = { name: "st-q-quotes", afterClone(ctx) {
    const s = document.createElement("style");
    s.textContent = "q::before,q::after{content:none!important}";
    ctx.clone.prepend(s);
  } };

  const t0 = performance.now();
  const shot = await snapdom(block, { scale: 2, embedFonts: true, exclude: EXCLUDE, excludeMode: "remove", plugins: [quoteFix] });
  const raw = await shot.toCanvas();
  const ms = Math.round(performance.now() - t0);

  // 底色：聊天区的主题遮罩色（半透明），压在模糊遮罩色上，再压在黑底上 → 不透明
  const root = getComputedStyle(document.body);
  const chatBg = getComputedStyle(document.getElementById("chat")).backgroundColor;
  const blurTint = root.getPropertyValue("--SmartThemeBlurTintColor").trim() || "rgba(0,0,0,0)";
  const pad = 16 * 2;
  const out = document.createElement("canvas");
  out.width = raw.width + pad * 2; out.height = raw.height + pad * 2;
  const g = out.getContext("2d");
  for (const fill of ["#000", blurTint, chatBg]) { g.fillStyle = fill; g.fillRect(0, 0, out.width, out.height); }
  g.drawImage(raw, pad, pad);

  report.ms = ms; report.size = `${out.width}x${out.height}`; report.bg = { chatBg, blurTint };
  console.log("[snap-proto]", JSON.stringify(report));

  // 预览层
  document.getElementById("snap-proto")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "snap-proto";
  wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);overflow:auto;padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;position:sticky;top:0";
  const btn = (label, fn) => { const b = document.createElement("button"); b.textContent = label; b.className = "menu_button"; b.onclick = fn; bar.append(b); };
  const url = out.toDataURL("image/png");
  btn("下载 PNG", () => { const a = document.createElement("a"); a.href = url; a.download = `mes-${report.mesid}.png`; a.click(); });
  btn("关闭", () => wrap.remove());
  const img = new Image(); img.src = url;
  img.style.cssText = `width:${out.width / 2}px;max-width:100%;box-shadow:0 0 0 1px #888`;
  wrap.append(bar, img);
  document.body.append(wrap);
  return report;
})();
