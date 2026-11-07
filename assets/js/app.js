// Odobli bolajonlar — asosiy ilova (marshrutlar va sahifalar)
import { CONFIG } from "./config.js";
import { t, setLang, getLang, LANGS, LANG_NAMES } from "./i18n.js";
import { $, $$, esc, L, toast, modal, parentGate, fmtDate, toMs, ago, money, deviceType, ICON } from "./util.js";
import { accessInfo, subActive } from "./access.js";

export const state = { seed: null, settings: {}, cats: {}, sections: [], videos: [], tariffs: [], user: null, owned: {}, org: null };
export let store = null;
const app = () => $("#app");

// ---------------- ishga tushirish ----------------
async function boot() {
  initTheme();
  try {
    state.seed = await fetch("data/seed.json", { cache: "no-cache" }).then((r) => r.json());
  } catch (e) { app().innerHTML = `<div class="wrap empty">data/seed.json ${esc(e.message)}</div>`; return; }
  const useFb = !!(CONFIG.firebase && CONFIG.firebase.apiKey);
  store = useFb ? (await import("./store-firebase.js")).store : (await import("./store-demo.js")).store;
  await store.init(state.seed, CONFIG.firebase);
  state.settings = await store.getSettings();
  setLang(localStorage.getItem("ob_lang") || state.settings.defaultLang || CONFIG.defaultLang || "uz");
  await loadCatalog();
  if (store.mode === "demo") $("#demo-bar").classList.remove("hidden");
  store.onAuth(async (u) => {
    state.user = u;
    try {
      state.owned = u ? await store.myOwned() : {};
      state.org = u?.orgId ? await store.getOrg(u.orgId) : null;
    } catch (e) { console.warn(e); }
    renderHeader(); route();
  });
  window.addEventListener("hashchange", route);
  setInterval(() => store.heartbeat(location.hash || "#/").catch(() => {}), 60000);
  store.heartbeat(location.hash || "#/").catch(() => {});
  window.addEventListener("error", (e) => logErr(e.message, e.filename + ":" + e.lineno));
  window.addEventListener("unhandledrejection", (e) => logErr(String(e.reason?.message || e.reason), "promise"));
}
let errCount = 0;
function logErr(msg, where) { if (errCount++ < 5) store?.logError({ msg: String(msg).slice(0, 300), where: String(where || "").slice(0, 200), url: location.href.slice(0, 200), ua: navigator.userAgent.slice(0, 160) }).catch(() => {}); }

export async function loadCatalog() {
  const [cats, sections, videos, tariffs] = await Promise.all([store.getCategories(), store.listSections(), store.listVideos(), store.listTariffs()]);
  Object.assign(state, { cats, sections, videos, tariffs });
}

// ---------------- mavzu (kun/tun) ----------------
function initTheme() {
  const saved = localStorage.getItem("ob_theme");
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next; localStorage.setItem("ob_theme", next); renderHeader();
}

// ---------------- sarlavha ----------------
export function renderHeader() {
  const u = state.user, isAdmin = u?.role === "admin";
  const cur = (location.hash || "#/").split("/")[1] || "";
  const nav = [["", t("nav.home")], ["s/" + (state.sections[0]?.id || ""), t("nav.cartoons")], ["tariffs", t("nav.tariffs")], ["profile", t("nav.profile")]];
  if (isAdmin) nav.push(["admin", t("nav.admin")]);
  const dark = document.documentElement.dataset.theme === "dark";
  $("#topbar").innerHTML = `<div class="wrap">
    <button class="iconbtn menu-toggle" id="menu-btn" aria-label="menu">${ICON.menu}</button>
    <a class="brand" href="#/"><span class="brand-mark">${ICON.logo}</span><span class="txt">${esc(L(state.settings.siteName) || "Odobli bolajonlar")}</span></a>
    <nav class="nav" id="nav">${nav.map(([h, n]) => `<a href="#/${h}" class="${cur === h.split("/")[0] ? "active" : ""}">${esc(n)}</a>`).join("")}</nav>
    <div class="tools">
      <div class="seg lang" role="group" aria-label="${t("common.language")}">${LANGS.map((l) => `<button data-lang="${l}" class="${getLang() === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</div>
      <button class="iconbtn" id="theme-btn" title="${dark ? t("theme.light") : t("theme.dark")}" aria-label="theme">${dark ? ICON.sun : ICON.moon}</button>
      ${u ? `<a class="chip bilim" href="#/profile" title="${t("bilim.balance")}"><span class="coin">b</span>${money(u.bilim)}</a>
        <a href="#/profile" title="${esc(u.name)}">${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((u.name || "?")[0])}</span>`}</a>`
        : `<a class="btn btn-primary btn-sm" href="#/login">${t("nav.login")}</a>`}
    </div></div>`;
  $$("#topbar [data-lang]").forEach((b) => b.onclick = () => { setLang(b.dataset.lang); localStorage.setItem("ob_lang", b.dataset.lang); renderHeader(); route(); });
  $("#theme-btn").onclick = toggleTheme;
  $("#menu-btn").onclick = () => $("#nav").classList.toggle("open");
  document.documentElement.lang = getLang();
  document.title = L(state.settings.siteName) || "Odobli bolajonlar";
  renderFooter();
}
function renderFooter() {
  const s = state.settings;
  $("#footer").innerHTML = `<div class="wrap row" style="justify-content:space-between">
    <div>© ${new Date().getFullYear()} ${esc(L(s.siteName))} · ${t("footer.age")}</div>
    <div class="row">${s.contactPhone ? `<span>☎ ${esc(s.contactPhone)}</span>` : ""}${s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : ""}${s.contactTelegram ? `<span>Telegram: ${esc(s.contactTelegram)}</span>` : ""}</div></div>`;
}

// ---------------- marshrutlar ----------------
export async function route() {
  if (!store) return;
  const parts = (location.hash || "#/").slice(2).split("?")[0].split("/");
  const q = new URLSearchParams((location.hash.split("?")[1] || ""));
  $("#nav")?.classList.remove("open");
  const isAdmin = state.user?.role === "admin";
  if (state.settings.maintenance && !isAdmin && parts[0] !== "login") {
    app().innerHTML = `<div class="wrap login-box card pad"><h2>${t("maint.title")}</h2><p class="muted">${t("maint.text")}</p><a class="btn btn-ghost" href="#/login">${t("nav.login")}</a></div>`; return;
  }
  window.scrollTo(0, 0);
  try {
    switch (parts[0]) {
      case "": return renderHome();
      case "s": return renderSection(parts[1]);
      case "watch": return renderWatch(parts[1], q.get("l"));
      case "tariffs": return renderTariffs();
      case "profile": return renderProfile();
      case "login": return renderLogin();
      case "admin": {
        if (!isAdmin) { app().innerHTML = `<div class="wrap empty"><h2>${t("err.noAdmin")}</h2><a class="btn btn-primary" href="#/login">${t("nav.login")}</a></div>`; return; }
        const m = await import("./admin.js"); return m.renderAdmin(parts[1] || "monitor", parts[2]);
      }
      default: app().innerHTML = `<div class="wrap empty"><h2>404</h2><a href="#/">${t("nav.home")}</a></div>`;
    }
  } catch (e) { console.error(e); app().innerHTML = `<div class="wrap empty">${esc(e.message)}</div>`; logErr(e.message, "route " + parts[0]); }
}

// ---------------- yordamchi: kartochkalar ----------------
const progress = () => { try { return JSON.parse(localStorage.getItem("ob_progress") || "{}"); } catch { return {}; } };
function ctx() { return { user: state.user, owned: state.owned, org: state.org }; }
function accessTag(v) {
  const a = accessInfo(v, ctx());
  if (a.reason === "own") return `<span class="tag own">✓ ${t("acc.own")}</span>`;
  if (a.reason === "org") return `<span class="tag own">✓ ${t("acc.org")}</span>`;
  if (a.reason === "sub") return `<span class="tag own">✓ ${t("acc.sub")}</span>`;
  if (v.access === "free") return `<span class="tag free">${t("acc.free")}</span>`;
  if (v.access === "login") return `<span class="tag login">${t("acc.login")}</span>`;
  return `<span class="tag paid">${money(v.price)} ${t("bilim.short")}</span>`;
}
export function videoCard(v) {
  const a = accessInfo(v, ctx()); const p = progress()[v.id]; const cat = state.cats[v.cat];
  const pct = p && p.d ? Math.min(100, Math.round((p.t / p.d) * 100)) : 0;
  return `<a class="vcard" href="#/watch/${esc(v.id)}">
    <div class="vthumb"><img loading="lazy" src="${esc(v.poster)}" alt="">
      <span class="num">${esc(t("ep.n", { n: v.order }))}</span>${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ""}
      ${a.ok ? "" : `<div class="lock"><span>${ICON.lock}</span></div>`}${pct ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ""}</div>
    <div class="vbody"><h3>${esc(L(v.title))}</h3><p class="muted small" style="margin:0">${esc(L(v.slogan))}</p>
      <div class="tags">${accessTag(v)}${cat ? `<span class="tag" style="color:${esc(cat.color)}">${esc(L(cat))}</span>` : ""}${v.age ? `<span class="tag">${esc(v.age)} ${t("ep.age")}</span>` : ""}</div></div></a>`;
}
function sectionVideos(id) { return state.videos.filter((v) => v.sectionId === id && v.published !== false).sort((a, b) => a.order - b.order); }

// ---------------- bosh sahifa ----------------
function renderHome() {
  const s = state.settings, h = s.hero || {};
  const heroVid = state.videos.find((v) => v.id === h.videoId) || state.videos[0];
  const pills = Object.values(state.cats).slice(0, 6).map((c) => `<span class="pill"><i style="background:${esc(c.color)}"></i>${esc(L(c))}</span>`).join("");
  let html = `<div class="wrap"><section class="hero">
    <div><h1>${esc(L(h.title))}</h1><p class="lead">${esc(L(h.subtitle))}</p>
      <div class="badge-row">${pills}</div>
      <div class="row">${heroVid ? `<a class="btn btn-primary" href="#/watch/${esc(heroVid.id)}">${ICON.play} ${t("home.watch")}</a>` : ""}
        <a class="btn btn-ghost" href="#/s/${esc(state.sections[0]?.id || "")}">${t("home.all")}</a></div>
      ${s.announcement?.on && L(s.announcement) ? `<div class="announce">📣 ${esc(L(s.announcement))}</div>` : ""}</div>
    <div class="art">${heroVid ? `<img src="${esc(state.sections.find((x) => x.id === heroVid.sectionId)?.cover || heroVid.poster)}" alt="">` : ""}</div></section>`;
  for (const b of (s.blocks || []).filter((x) => x.visible !== false)) {
    if (b.type === "continue") {
      const pr = progress();
      const list = Object.entries(pr).filter(([id, p]) => p.d && p.t > 5 && p.t < p.d - 5).sort((a, b) => b[1].at - a[1].at).map(([id]) => state.videos.find((v) => v.id === id)).filter(Boolean).slice(0, 4);
      if (list.length) html += `<div class="section-head"><h2>${t("home.continue")}</h2></div><div class="vgrid">${list.map(videoCard).join("")}</div>`;
    } else if (b.type === "section") {
      const sec = state.sections.find((x) => x.id === b.sectionId && x.visible !== false); if (!sec) continue;
      const vids = sectionVideos(sec.id); if (!vids.length) continue;
      html += `<div class="section-head"><div><h2>${esc(L(sec.title))}</h2><p class="muted">${esc(L(sec.desc))}</p></div><a class="btn btn-ghost btn-sm" href="#/s/${esc(sec.id)}">${t("home.playlist", { n: vids.length })}</a></div>
        <div class="vgrid">${vids.slice(0, b.limit || 8).map(videoCard).join("")}</div>`;
    } else if (b.type === "tariffs") {
      html += `<div class="section-head"><h2>${t("home.howTitle")}</h2></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
        <div class="card pad"><h3>🎈 ${t("acc.free")}</h3><p class="muted small">${t("home.howFree")}</p></div>
        <div class="card pad"><h3>🔑 ${t("acc.login")}</h3><p class="muted small">${t("home.howLogin")}</p></div>
        <div class="card pad"><h3><span class="coin">b</span> ${t("bilim.name")}</h3><p class="muted small">${t("home.howBilim")}</p><a href="#/tariffs">${t("nav.tariffs")} →</a></div>
        <div class="card pad"><h3>🏫 ${t("home.orgTitle")}</h3><p class="muted small">${t("home.howOrg")}</p></div></div>`;
    } else if (b.type === "parents") {
      html += `<div class="section-head"><h2>${t("home.parentsTitle")}</h2></div><div class="card pad"><div class="info-grid" style="margin:0">
        <div><h3>⏱ ${t("home.p1t")}</h3><p class="muted small">${t("home.p1")}</p></div>
        <div><h3>👨‍👩‍👧 ${t("home.p2t")}</h3><p class="muted small">${t("home.p2")}</p></div>
        <div><h3>🌙 ${t("home.p3t")}</h3><p class="muted small">${t("home.p3")}</p></div></div></div>`;
    }
  }
  app().innerHTML = html + "</div>";
}

// ---------------- bo‘lim ----------------
function renderSection(id) {
  const visible = state.sections.filter((x) => x.visible !== false);
  const sec = state.sections.find((x) => x.id === id) || visible[0];
  if (!sec) { app().innerHTML = `<div class="wrap empty">${t("common.empty")}</div>`; return; }
  const vids = sectionVideos(sec.id);
  app().innerHTML = `<div class="wrap">
    ${visible.length > 1 ? `<div class="tabs" style="margin-top:24px">${visible.map((x) => `<button data-sec="${esc(x.id)}" class="${x.id === sec.id ? "on" : ""}">${esc(L(x.title))}</button>`).join("")}</div>` : ""}
    <div class="section-head" style="margin-top:${visible.length > 1 ? 8 : 36}px"><div><h1>${esc(L(sec.title))}</h1><p class="muted">${esc(L(sec.desc))}</p></div>
      ${vids[0] ? `<a class="btn btn-primary" href="#/watch/${esc(vids[0].id)}">${ICON.play} ${t("sec.playAll")}</a>` : ""}</div>
    ${vids.length ? `<div class="vgrid">${vids.map(videoCard).join("")}</div>` : `<div class="card empty">${t("sec.soon")}</div>`}</div>`;
  $$("[data-sec]").forEach((b) => b.onclick = () => location.hash = "#/s/" + b.dataset.sec);
}

// ---------------- ekran vaqti (ota-ona nazorati) ----------------
function todayKey() { return new Date().toISOString().slice(0, 10); }
function watchedToday() { try { const d = JSON.parse(localStorage.getItem("ob_day") || "{}"); return d.date === todayKey() ? d.sec : 0; } catch { return 0; } }
function addWatched(sec) { const d = { date: todayKey(), sec: watchedToday() + sec }; localStorage.setItem("ob_day", JSON.stringify(d)); return d.sec; }
function limitMin() { return Number(localStorage.getItem("ob_limit") || 0); }
function limitReached() { const m = limitMin(); return m > 0 && watchedToday() >= m * 60 && sessionStorage.getItem("ob_limit_ok") !== todayKey(); }

// ---------------- tomosha sahifasi ----------------
async function renderWatch(id, wantLang) {
  const v = state.videos.find((x) => x.id === id);
  if (!v) { app().innerHTML = `<div class="wrap empty"><h2>404</h2></div>`; return; }
  const sec = state.sections.find((x) => x.id === v.sectionId);
  const list = sectionVideos(v.sectionId);
  const idx = list.findIndex((x) => x.id === v.id); const next = list[idx + 1];
  const a = accessInfo(v, ctx());
  const cat = state.cats[v.cat];
  app().innerHTML = `<div class="wrap"><div class="watch">
    <div>
      <div class="player" id="player"></div>
      <div class="langbar"><span class="muted small">${t("watch.audio")}</span><div class="seg" id="vlang"></div><div class="spacer"></div>
        ${next ? `<a class="btn btn-ghost btn-sm" href="#/watch/${esc(next.id)}">${t("watch.next")} →</a>` : ""}</div>
      <h1 style="font-size:clamp(24px,3.4vw,36px)">${esc(L(v.title))}</h1>
      <div class="tags" style="margin-bottom:12px">${accessTag(v)}${cat ? `<span class="tag" style="color:${esc(cat.color)}">${esc(L(cat))}</span>` : ""}${v.age ? `<span class="tag">${esc(v.age)} ${t("ep.age")}</span>` : ""}${v.duration ? `<span class="tag">⏱ ${esc(v.duration)}</span>` : ""}</div>
      <p class="slogan">«${esc(L(v.slogan))}»</p>
      <div class="info-grid">
        <div class="card pad"><h3>🎯 ${t("watch.goal")}</h3><p>${esc(L(v.desc))}</p>${(v.words || []).length ? `<p class="small muted"><b>${t("watch.words")}:</b> ${esc(v.words.join(", "))}</p>` : ""}</div>
        ${(L(v.questions) || []).length ? `<div class="card pad"><h3>💬 ${t("watch.questions")}</h3><ul>${L(v.questions).map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}
        ${L(v.activity) ? `<div class="card pad"><h3>🧩 ${t("watch.activity")}</h3><p>${esc(L(v.activity))}</p></div>` : ""}
      </div>
    </div>
    <aside class="card playlist"><h3>${esc(L(sec?.title))} · ${list.length}</h3>
      ${list.map((x) => { const ax = accessInfo(x, ctx()); return `<a class="pl-item ${x.id === v.id ? "on" : ""}" href="#/watch/${esc(x.id)}"><img src="${esc(x.poster)}" alt="" loading="lazy">
        <div><b>${esc(t("ep.n", { n: x.order }))}. ${esc(L(x.title))}</b><small>${ax.ok ? esc(x.duration || "") : "🔒 " + (x.access === "login" ? t("acc.login") : money(x.price) + " " + t("bilim.short"))}</small></div></a>`; }).join("")}
    </aside></div></div>`;
  $(".pl-item.on")?.scrollIntoView({ block: "nearest" });
  const box = $("#player");
  const gate = (title, text, btns = "") => {
    box.innerHTML = `<div class="gate" style="background-image:url('${esc(v.poster)}')"><div><div style="font-size:40px">🔒</div><h3>${title}</h3><p>${text}</p><div class="row" style="justify-content:center">${btns}</div></div></div>`;
  };
  if (!a.ok) {
    $("#vlang").innerHTML = LANGS.map((l) => `<button disabled>${l.toUpperCase()}</button>`).join("");
    if (a.reason === "needLogin") return gate(t("watch.needLogin"), t("watch.needLoginText"), `<a class="btn btn-primary" href="#/login">${t("nav.login")}</a>`);
    if (a.reason === "blocked") return gate(t("err.blocked"), "");
    gate(t("watch.paidTitle"), t("watch.paidText", { n: money(a.price), b: money(state.user?.bilim) }),
      `<button class="btn btn-accent" id="buy-btn"><span class="coin">b</span> ${t("watch.unlock", { n: money(a.price) })}</button><a class="btn btn-ghost" href="#/tariffs">${t("nav.tariffs")}</a>`);
    $("#buy-btn").onclick = async () => {
      if ((state.user?.bilim || 0) < a.price) { toast(t("err.notEnough"), true); location.hash = "#/tariffs"; return; }
      if (!(await parentGate(state.settings.parentGate !== false))) return;
      try { await store.purchaseVideo(v.id); state.owned = await store.myOwned(); toast(t("watch.bought")); renderWatch(id, wantLang); }
      catch (e) { toast(e.message, true); }
    };
    return;
  }
  if (limitReached()) {
    gate(t("limit.title"), t("limit.text", { n: limitMin() }), `<button class="btn btn-ghost" id="lim-ok">${t("limit.parent")}</button>`);
    $("#lim-ok").onclick = async () => { if (await parentGate(true)) { sessionStorage.setItem("ob_limit_ok", todayKey()); renderWatch(id, wantLang); } };
    return;
  }
  let src = null;
  try { src = await store.getSources(v); } catch (e) { console.warn(e); }
  if (!src || !Object.keys(src).length) return gate(t("watch.noSource"), "");
  const avail = LANGS.filter((l) => src[l]);
  let lang = avail.includes(wantLang) ? wantLang : avail.includes(getLang()) ? getLang() : avail[0];
  $("#vlang").innerHTML = LANGS.map((l) => `<button data-l="${l}" class="${l === lang ? "on" : ""}" ${src[l] ? "" : "disabled title='" + t("watch.noLang") + "'"}>${l.toUpperCase()}</button>`).join("");
  const pr = progress()[v.id];
  box.innerHTML = `<video id="vid" controls playsinline preload="metadata" poster="${esc(v.poster)}" src="${esc(src[lang])}"></video>`;
  const vid = $("#vid");
  if (pr && pr.t > 5 && pr.d && pr.t < pr.d - 5) vid.addEventListener("loadedmetadata", () => { vid.currentTime = pr.t; }, { once: true });
  let started = false, lastSave = 0, lastTick = null, watched = 0;
  vid.addEventListener("play", () => {
    lastTick = vid.currentTime;
    if (!started) { started = true; store.logView({ videoId: v.id, lang, sec: 0, completed: false, device: deviceType(), kind: "start" }).catch(() => {}); }
  });
  vid.addEventListener("timeupdate", () => {
    const now = vid.currentTime;
    if (lastTick != null && now > lastTick && now - lastTick < 2) { const d = now - lastTick; watched += d; addWatched(d); }
    lastTick = now;
    if (Date.now() - lastSave > 4000) { lastSave = Date.now(); saveProgress(v.id, now, vid.duration); }
    if (limitReached()) { vid.pause(); toast(t("limit.title")); }
  });
  vid.addEventListener("seeking", () => { lastTick = null; });
  vid.addEventListener("ended", () => {
    saveProgress(v.id, vid.duration, vid.duration);
    store.logView({ videoId: v.id, lang, sec: Math.round(watched), completed: true, device: deviceType(), kind: "end" }).catch(() => {});
    if (next && state.settings.autoplayNext) setTimeout(() => location.hash = "#/watch/" + next.id + "?l=" + lang, 1500);
  });
  $$("#vlang [data-l]").forEach((b) => b.onclick = () => {
    if (b.disabled) return; const tcur = vid.currentTime; lang = b.dataset.l; vid.src = src[lang];
    vid.addEventListener("loadedmetadata", () => { vid.currentTime = tcur; vid.play().catch(() => {}); }, { once: true });
    $$("#vlang button").forEach((x) => x.classList.toggle("on", x === b));
  });
}
function saveProgress(id, tt, d) {
  const p = progress(); p[id] = { t: Math.round(tt || 0), d: Math.round(d || 0), at: Date.now() };
  localStorage.setItem("ob_progress", JSON.stringify(p));
}

// ---------------- tariflar ----------------
function renderTariffs() {
  const pk = state.tariffs.filter((x) => x.active !== false && x.type === "package");
  const sb = state.tariffs.filter((x) => x.active !== false && x.type === "subscription");
  const u = state.user; const s = state.settings;
  app().innerHTML = `<div class="wrap">
    <div class="section-head" style="margin-top:36px"><div><h1>${t("tar.title")}</h1><p class="muted">${t("tar.lead")}</p></div>
      ${u ? `<span class="chip bilim" style="font-size:16px"><span class="coin">b</span>${t("bilim.balance")}: ${money(u.bilim)}</span>` : ""}</div>
    <h2>${t("tar.packages")}</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      ${pk.map((p) => `<div class="card pad stack"><h3>${esc(L(p.name))}</h3>
        <div><b style="font-family:InterDisplay;font-size:34px">${money(p.bilim)}</b> <span class="muted">${t("bilim.short")}</span>${p.bonus ? ` <span class="tag free">+${money(p.bonus)} ${t("tar.bonus")}</span>` : ""}</div>
        <div class="muted">${money(p.priceUZS)} ${t("tar.sum")}</div>
        <button class="btn btn-primary" data-pk="${esc(p.id)}">${t("tar.request")}</button></div>`).join("") || `<div class="muted">${t("common.empty")}</div>`}</div>
    <p class="muted small" style="margin-top:10px">${t("tar.payNote")} ${s.contactPhone ? "☎ " + esc(s.contactPhone) : ""} ${s.contactTelegram ? "· Telegram: " + esc(s.contactTelegram) : ""}</p>
    <h2 style="margin-top:34px">${t("tar.subs")}</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      ${sb.map((p) => `<div class="card pad stack"><h3>${esc(L(p.name))}</h3>
        <div><b style="font-family:InterDisplay;font-size:34px">${money(p.bilim)}</b> <span class="muted">${t("bilim.short")}</span></div>
        <div class="muted">${t("tar.days", { n: p.days })} · ${t("tar.subAll")}</div>
        <button class="btn btn-accent" data-sb="${esc(p.id)}">${t("tar.buyBilim")}</button></div>`).join("") || `<div class="muted">${t("common.empty")}</div>`}</div>
    ${u && subActive(u) ? `<p class="announce">✓ ${t("tar.subActive", { d: fmtDate(u.subUntil) })}</p>` : ""}
    <h2 style="margin-top:34px">🏫 ${t("home.orgTitle")}</h2><div class="card pad"><p>${t("tar.orgText")}</p><a class="btn btn-ghost" href="#/profile">${t("prof.joinOrg")}</a></div></div>`;
  const needLogin = () => { if (!state.user) { toast(t("err.needLogin"), true); location.hash = "#/login"; return true; } return false; };
  $$("[data-pk]").forEach((b) => b.onclick = async () => {
    if (needLogin() || !(await parentGate(s.parentGate !== false))) return;
    try { await store.requestTopup(b.dataset.pk); toast(t("tar.requested")); } catch (e) { toast(e.message, true); }
  });
  $$("[data-sb]").forEach((b) => b.onclick = async () => {
    if (needLogin()) return;
    const tr = state.tariffs.find((x) => x.id === b.dataset.sb);
    if ((state.user.bilim || 0) < tr.bilim) { toast(t("err.notEnough"), true); return; }
    if (!(await parentGate(s.parentGate !== false))) return;
    try { await store.buySubscription(tr.id); toast(t("tar.subBought")); renderTariffs(); } catch (e) { toast(e.message, true); }
  });
}

// ---------------- profil ----------------
async function renderProfile() {
  const u = state.user;
  if (!u) return renderLogin();
  const [tops, ledger] = await Promise.all([store.myTopups().catch(() => []), store.listLedger(u.uid).catch(() => [])]);
  const ownedIds = Object.keys(state.owned);
  const lim = limitMin();
  const typeName = (x) => t("tx." + x.type) || x.type;
  app().innerHTML = `<div class="wrap" style="padding-top:30px"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card pad stack"><div class="row">${u.photo ? `<img class="avatar" style="width:56px;height:56px" src="${esc(u.photo)}" referrerpolicy="no-referrer" alt="">` : `<span class="avatar" style="width:56px;height:56px;font-size:22px">${esc((u.name || "?")[0])}</span>`}
      <div><h2 style="margin:0">${esc(u.name)}</h2><div class="muted small">${esc(u.email)}${u.role === "admin" ? " · admin" : ""}</div></div></div>
      <div class="row"><span class="chip bilim" style="font-size:18px"><span class="coin">b</span>${money(u.bilim)} ${t("bilim.short")}</span><a class="btn btn-ghost btn-sm" href="#/tariffs">${t("prof.topup")}</a></div>
      <div>${subActive(u) ? `✓ ${t("tar.subActive", { d: fmtDate(u.subUntil) })}` : `<span class="muted">${t("prof.noSub")}</span>`}</div>
      <button class="btn btn-ghost" id="logout">${t("nav.logout")}</button></div>
    <div class="card pad stack"><h3>🏫 ${t("home.orgTitle")}</h3>
      ${state.org ? `<p><b>${esc(state.org.name)}</b><br><span class="muted small">${t("prof.orgUntil", { d: fmtDate(state.org.end) })}</span></p><button class="btn btn-danger btn-sm" id="leave">${t("prof.leave")}</button>`
        : `<p class="muted small">${t("prof.orgText")}</p><div class="row"><input class="input" id="code" placeholder="${t("prof.code")}" style="max-width:200px;text-transform:uppercase"><button class="btn btn-primary" id="join">${t("prof.join")}</button></div>`}</div>
    <div class="card pad stack"><h3>⚙️ ${t("prof.settings")}</h3>
      <label class="f">${t("prof.limit")}</label><div class="row"><select class="input" id="lim" style="max-width:200px">${[0, 15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === lim ? "selected" : ""}>${m ? t("prof.minutes", { n: m }) : t("prof.noLimit")}</option>`).join("")}</select></div>
      <p class="muted small">${t("prof.limitNote", { n: Math.round(watchedToday() / 60) })}</p></div></div>
    <div class="section-head"><h2>${t("prof.owned")}</h2></div>
    ${ownedIds.length ? `<div class="vgrid">${ownedIds.map((id) => state.videos.find((v) => v.id === id)).filter(Boolean).map(videoCard).join("")}</div>` : `<div class="card empty">${t("prof.noOwned")}</div>`}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-top:30px">
      <div class="card pad"><h3>${t("prof.requests")}</h3>${tops.length ? `<ul class="feed">${tops.map((x) => `<li><span>${money(x.bilim)} ${t("bilim.short")} · ${money(x.priceUZS)} ${t("tar.sum")}</span><span class="spacer"></span><span class="tag ${x.status === "approved" ? "own" : x.status === "rejected" ? "paid" : "login"}">${t("st." + x.status)}</span><time>${fmtDate(x.at)}</time></li>`).join("")}</ul>` : `<p class="muted">${t("common.empty")}</p>`}</div>
      <div class="card pad"><h3>${t("prof.history")}</h3>${ledger.length ? `<ul class="feed">${ledger.slice(0, 30).map((x) => `<li><span>${esc(typeName(x))}</span><span class="spacer"></span><b style="color:${x.amount >= 0 ? "var(--success)" : "var(--danger)"}">${x.amount > 0 ? "+" : ""}${money(x.amount)}</b><time>${fmtDate(x.at)}</time></li>`).join("")}</ul>` : `<p class="muted">${t("common.empty")}</p>`}</div></div></div>`;
  $("#logout").onclick = async () => { await store.signOut(); location.hash = "#/"; };
  $("#join")?.addEventListener("click", async () => {
    try { const o = await store.joinOrg($("#code").value); state.org = o || (await store.getOrg((await store.me()).orgId)); toast(t("prof.joined")); renderProfile(); } catch (e) { toast(e.message, true); }
  });
  $("#leave")?.addEventListener("click", async () => { await store.leaveOrg(); state.org = null; renderProfile(); });
  $("#lim").onchange = async (e) => {
    if (!(await parentGate(true))) { e.target.value = String(lim); return; }
    localStorage.setItem("ob_limit", e.target.value); toast(t("common.saved"));
  };
}

// ---------------- kirish ----------------
function renderLogin() {
  if (state.user) { location.hash = "#/profile"; return; }
  const demo = store.mode === "demo";
  app().innerHTML = `<div class="wrap"><div class="card pad login-box stack">
    <div class="brand-mark" style="margin:0 auto;width:56px;height:56px">${ICON.logo}</div>
    <h2>${t("login.title")}</h2><p class="muted">${t("login.text")}</p>
    ${demo ? `<button class="btn btn-primary" id="g-btn">${t("login.demoBtn")}</button>` : `<button class="btn btn-google" id="g-btn">${ICON.google} ${t("login.google")}</button>`}
    <p class="muted tiny">${t("login.privacy")}</p>
    ${demo ? `<p class="small" style="background:var(--coral-soft);padding:10px;border-radius:12px">${t("login.demoNote")}</p>` : ""}</div></div>`;
  $("#g-btn").onclick = async () => {
    try { await store.signIn(); toast(t("login.ok")); location.hash = "#/"; } catch (e) { if (e.message !== "cancel") toast(e.message, true); }
  };
}

boot();
