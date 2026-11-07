// Admin panel: monitoring, videolar, bo‘limlar, bosh sahifa, foydalanuvchilar, bog‘chalar, tariflar, to‘lovlar, tranzaksiyalar, sozlamalar
import { t, LANGS, getLang } from "./i18n.js";
import { $, $$, esc, L, toast, modal, confirmBox, fmtDate, toMs, ago, money, downloadCSV, uid } from "./util.js";
import { state, store, loadCatalog, renderHeader } from "./app.js";

const TABS = [
  ["monitor", "📊"], ["videos", "🎬"], ["sections", "📚"], ["home", "🏠"], ["users", "👥"],
  ["orgs", "🏫"], ["tariffs", "💳"], ["topups", "🧾"], ["ledger", "📒"], ["settings", "⚙️"],
];
let refreshTimer = null;

export async function renderAdmin(tab = "monitor") {
  clearInterval(refreshTimer);
  let pending = 0;
  try { pending = (await store.listTopups()).filter((x) => x.status === "pending").length; } catch {}
  $("#app").innerHTML = `<div class="wrap"><div class="admin">
    <nav class="card aside">${TABS.map(([k, ic]) => `<a href="#/admin/${k}" class="${k === tab ? "on" : ""}">${ic} ${t("adm." + k)}${k === "topups" && pending ? `<span class="badge">${pending}</span>` : ""}</a>`).join("")}
      <div class="muted tiny" style="padding:10px 12px">${t("adm.mode")}: <b>${store.mode === "demo" ? "DEMO" : "Firebase"}</b></div></nav>
    <section id="adm"></section></div></div>`;
  const fn = { monitor, videos, sections, home, users, orgs, tariffs, topups, ledger, settings }[tab] || monitor;
  try { await fn($("#adm")); } catch (e) { console.error(e); $("#adm").innerHTML = `<div class="card pad">${esc(e.message)}</div>`; }
}

// ---------- umumiy yordamchilar ----------
const head = (title, extra = "") => `<div class="section-head" style="margin-top:0"><h2 style="margin:0">${title}</h2><div class="row">${extra}</div></div>`;
function mlInputs(name, obj = {}, area = false) {
  return `<div class="ml" data-ml="${name}">${LANGS.map((l) => `<div style="margin-bottom:6px"><div class="lang-tabs"><span>${l.toUpperCase()}</span></div>
    ${area ? `<textarea class="input" data-l="${l}">${esc(obj?.[l] ?? "")}</textarea>` : `<input class="input" data-l="${l}" value="${esc(obj?.[l] ?? "")}">`}</div>`).join("")}</div>`;
}
function readMl(root, name, asList = false) {
  const o = {}; $$(`[data-ml="${name}"] [data-l]`, root).forEach((i) => {
    o[i.dataset.l] = asList ? i.value.split("\n").map((s) => s.trim()).filter(Boolean) : i.value.trim();
  }); return o;
}
const val = (root, sel) => $(sel, root)?.value?.trim() ?? "";
const num = (root, sel) => Number($(sel, root)?.value || 0);
const chk = (root, sel) => !!$(sel, root)?.checked;
const yes = (b) => (b ? "✓" : "—");
const dateIn = (v) => (toMs(v) ? new Date(toMs(v)).toISOString().slice(0, 10) : "");
const accName = (a) => t("acc." + a);
async function refreshAll() { await loadCatalog(); state.settings = await store.getSettings(); renderHeader(); }

// ================= MONITORING =================
async function monitor(el) {
  const since = Date.now() - 14 * 86400000;
  const [views, users, presence, errors, tops, ledger] = await Promise.all([
    store.listViews(since), store.listUsers(), store.listPresence(), store.listErrors(), store.listTopups(), store.listLedger(),
  ]);
  const now = Date.now(), day = 86400000, today0 = new Date().setHours(0, 0, 0, 0);
  const online = presence.filter((p) => now - toMs(p.at) < 5 * 60000);
  const starts = views.filter((v) => v.kind !== "end"); const ends = views.filter((v) => v.kind === "end" || v.completed);
  const vtitle = (id) => L(state.videos.find((v) => v.id === id)?.title) || id;
  const uname = (id) => { const u = users.find((x) => x.uid === id); return u ? u.name || u.email : "—"; };
  // kunlik ko‘rishlar
  const days = [...Array(14)].map((_, i) => { const d0 = today0 - (13 - i) * day; return { d0, n: starts.filter((v) => toMs(v.at) >= d0 && toMs(v.at) < d0 + day).length }; });
  const maxN = Math.max(1, ...days.map((d) => d.n));
  // eng ko‘p ko‘rilgan
  const per = {}; starts.forEach((v) => { per[v.videoId] = per[v.videoId] || { s: 0, e: 0 }; per[v.videoId].s++; });
  ends.forEach((v) => { per[v.videoId] = per[v.videoId] || { s: 0, e: 0 }; per[v.videoId].e++; });
  const top = Object.entries(per).sort((a, b) => b[1].s - a[1].s).slice(0, 8); const topMax = Math.max(1, ...top.map((x) => x[1].s));
  const share = (key) => { const m = {}; starts.forEach((v) => { const k = v[key] || "—"; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const subs = users.filter((u) => toMs(u.subUntil) > now).length;
  const circ = users.reduce((s, u) => s + Number(u.bilim || 0), 0);
  const err24 = errors.filter((e) => now - toMs(e.at) < day).length;
  const feed = [
    ...users.map((u) => ({ at: toMs(u.createdAt), txt: `👤 ${t("mon.signup")}: <b>${esc(u.name || u.email)}</b>` })),
    ...tops.map((x) => ({ at: toMs(x.at), txt: `🧾 ${t("mon.topup")}: <b>${esc(x.name || x.email)}</b> · ${money(x.bilim)} ${t("bilim.short")} · ${t("st." + x.status)}` })),
    ...ledger.filter((x) => x.type === "purchase" || x.type === "subscription").map((x) => ({ at: toMs(x.at), txt: `🛒 ${esc(uname(x.uid))}: ${x.type === "purchase" ? esc(vtitle(x.ref)) : t("tx.subscription")} (${money(x.amount)})` })),
    ...starts.slice(-40).map((v) => ({ at: toMs(v.at), txt: `▶ ${esc(vtitle(v.videoId))} · ${(v.lang || "").toUpperCase()} · ${v.device === "mobile" ? "📱" : "💻"}` })),
  ].sort((a, b) => b.at - a.at).slice(0, 25);
  el.innerHTML = head(t("adm.monitor"), `<label class="check small"><input type="checkbox" id="auto" checked> ${t("mon.auto")}</label><button class="btn btn-ghost btn-sm" id="rf">↻ ${t("mon.refresh")}</button>`) + `
    <div class="stats">
      <div class="card stat live"><b><span class="dot"></span> ${online.length}</b><span>${t("mon.online")}</span></div>
      <div class="card stat"><b>${starts.filter((v) => toMs(v.at) >= today0).length}</b><span>${t("mon.viewsToday")}</span></div>
      <div class="card stat"><b>${starts.length}</b><span>${t("mon.views14")}</span></div>
      <div class="card stat"><b>${pct(ends.length, starts.length)}%</b><span>${t("mon.completion")}</span></div>
      <div class="card stat"><b>${users.length}</b><span>${t("mon.users")} (+${users.filter((u) => now - toMs(u.createdAt) < 7 * day).length} / 7 ${t("mon.days")})</span></div>
      <div class="card stat"><b>${subs}</b><span>${t("mon.subs")}</span></div>
      <div class="card stat"><b>${money(circ)}</b><span>${t("mon.circ")}</span></div>
      <div class="card stat"><b>${tops.filter((x) => x.status === "pending").length}</b><span>${t("mon.pending")}</span></div>
      <div class="card stat"><b style="color:${err24 ? "var(--danger)" : "inherit"}">${err24}</b><span>${t("mon.errors24")}</span></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-top:18px">
      <div class="card pad"><h3>${t("mon.daily")}</h3><div class="chart">${days.map((d) => `<div class="col"><em>${d.n || ""}</em><i style="height:${Math.round((d.n / maxN) * 120)}px"></i><small>${new Date(d.d0).getDate()}</small></div>`).join("")}</div></div>
      <div class="card pad"><h3>${t("mon.top")}</h3>${top.length ? top.map(([id, x]) => `<div style="margin:8px 0"><div class="row small"><span>${esc(vtitle(id))}</span><span class="spacer"></span><b>${x.s}</b><span class="muted">· ${pct(x.e, x.s)}% ${t("mon.done")}</span></div><div class="bar"><i style="width:${(x.s / topMax) * 100}%"></i></div></div>`).join("") : `<p class="muted">${t("common.empty")}</p>`}</div>
      <div class="card pad"><h3>${t("mon.split")}</h3>
        <p class="small muted">${t("common.language")}</p>${share("lang").map(([k, n]) => `<div class="row small"><b style="width:40px">${esc(k.toUpperCase())}</b><div class="bar" style="flex:1"><i style="width:${pct(n, starts.length)}%"></i></div><span>${pct(n, starts.length)}%</span></div>`).join("") || "—"}
        <p class="small muted" style="margin-top:12px">${t("mon.device")}</p>${share("device").map(([k, n]) => `<div class="row small"><b style="width:70px">${k === "mobile" ? "📱" : "💻"} ${esc(k)}</b><div class="bar" style="flex:1"><i style="width:${pct(n, starts.length)}%;background:var(--accent)"></i></div><span>${pct(n, starts.length)}%</span></div>`).join("") || "—"}
        <p class="small muted" style="margin-top:12px">${t("mon.onlinePages")}</p>${online.map((p) => `<div class="small">• ${esc(p.page || "#/")} ${p.uid ? "· " + esc(uname(p.uid)) : "· " + t("mon.guest")}</div>`).join("") || "<div class='small muted'>—</div>"}
      </div>
      <div class="card pad"><h3>${t("mon.feed")}</h3><ul class="feed">${feed.map((f) => `<li><span>${f.txt}</span><span class="spacer"></span><time>${ago(f.at)}</time></li>`).join("") || `<li class="muted">${t("common.empty")}</li>`}</ul></div>
      <div class="card pad"><div class="row"><h3 style="margin:0">${t("mon.errLog")}</h3><span class="spacer"></span>${errors.length ? `<button class="btn btn-ghost btn-sm" id="clr">${t("mon.clear")}</button>` : ""}</div>
        <ul class="feed">${errors.slice(0, 15).map((e) => `<li><span class="small"><b>${esc(e.msg)}</b><br><span class="muted tiny">${esc(e.where || "")} · ${esc(e.url || "")}</span></span><span class="spacer"></span><time>${ago(e.at)}</time></li>`).join("") || `<li class="muted">✓ ${t("mon.noErrors")}</li>`}</ul></div>
    </div>`;
  $("#rf").onclick = () => renderAdmin("monitor");
  $("#clr")?.addEventListener("click", async () => { await store.clearErrors(); renderAdmin("monitor"); });
  refreshTimer = setInterval(() => { if ($("#auto")?.checked && (location.hash.startsWith("#/admin/monitor") || location.hash === "#/admin")) renderAdmin("monitor"); }, 30000);
}

// ================= VIDEOLAR =================
async function videos(el) {
  await refreshAll();
  const views = await store.listViews(0).catch(() => []);
  const cnt = {}; views.filter((v) => v.kind !== "end").forEach((v) => cnt[v.videoId] = (cnt[v.videoId] || 0) + 1);
  const secName = (id) => L(state.sections.find((s) => s.id === id)?.title) || "—";
  el.innerHTML = head(t("adm.videos"), `<select class="input" id="fsec" style="width:auto"><option value="">${t("vid.allSections")}</option>${state.sections.map((s) => `<option value="${esc(s.id)}">${esc(L(s.title))}</option>`).join("")}</select>
    <button class="btn btn-primary" id="add">+ ${t("vid.add")}</button>`) + `<div class="card"><div class="tablewrap"><table class="t"><thead><tr>
      <th></th><th>#</th><th>${t("vid.title")}</th><th>${t("vid.section")}</th><th>${t("vid.access")}</th><th>${t("vid.langs")}</th><th>${t("vid.views")}</th><th>${t("vid.published")}</th><th></th></tr></thead><tbody id="vt"></tbody></table></div></div>
    <p class="muted small" style="margin-top:10px">${t("vid.hint")}</p>`;
  const draw = () => {
    const f = $("#fsec").value;
    const list = state.videos.filter((v) => !f || v.sectionId === f).sort((a, b) => (a.sectionId || "").localeCompare(b.sectionId || "") || a.order - b.order);
    $("#vt").innerHTML = list.map((v) => `<tr><td><img class="thumb-sm" src="${esc(v.poster)}" alt=""></td><td>${v.order}</td><td><b>${esc(L(v.title))}</b><div class="muted tiny">${esc(v.id)}</div></td>
      <td>${esc(secName(v.sectionId))}</td><td>${accName(v.access)}${v.access === "paid" ? ` · ${money(v.price)}` : ""}</td>
      <td>${LANGS.map((l) => `<span class="tag ${v.sources?.[l] ? "free" : ""}">${l.toUpperCase()}</span>`).join(" ")}</td><td>${cnt[v.id] || 0}</td>
      <td><label class="check"><input type="checkbox" data-pub="${esc(v.id)}" ${v.published !== false ? "checked" : ""}></label></td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${esc(v.id)}">${t("common.edit")}</button><button class="btn btn-danger btn-sm" data-del="${esc(v.id)}">✕</button></td></tr>`).join("") || `<tr><td colspan="9" class="empty">${t("common.empty")}</td></tr>`;
    $$("[data-ed]").forEach((b) => b.onclick = () => videoForm(state.videos.find((v) => v.id === b.dataset.ed)));
    $$("[data-del]").forEach((b) => b.onclick = async () => { if (await confirmBox(t("common.confirmDelete"))) { await store.deleteVideo(b.dataset.del); toast(t("common.deleted")); renderAdmin("videos"); } });
    $$("[data-pub]").forEach((c) => c.onchange = async () => { const v = { ...state.videos.find((x) => x.id === c.dataset.pub) }; v.sources = (await store.getSources(v)) || v.sources || {}; v.published = c.checked; await store.saveVideo(v); toast(t("common.saved")); await refreshAll(); });
  };
  $("#fsec").onchange = draw; draw();
  $("#add").onclick = () => videoForm({ id: "", sectionId: $("#fsec").value || state.sections[0]?.id, order: state.videos.length + 1, access: "free", price: 0, published: true, sources: {} });
}
async function videoForm(v) {
  const isNew = !v.id;
  const sources = isNew ? (v.sources || {}) : ((await store.getSources(v).catch(() => null)) || v.sources || {});
  const cats = state.cats;
  modal(`<h2>${isNew ? t("vid.add") : t("common.edit")}</h2><div class="stack">
    <div class="form-grid">
      <div><label class="f">ID</label><input class="input" id="f-id" value="${esc(v.id)}" ${isNew ? "" : "disabled"} placeholder="${t("vid.idHint")}"></div>
      <div><label class="f">${t("vid.section")}</label><select class="input" id="f-sec">${state.sections.map((s) => `<option value="${esc(s.id)}" ${s.id === v.sectionId ? "selected" : ""}>${esc(L(s.title))}</option>`).join("")}</select></div>
      <div><label class="f">${t("vid.order")}</label><input class="input" id="f-ord" type="number" value="${v.order ?? 1}"></div>
      <div><label class="f">${t("vid.cat")}</label><select class="input" id="f-cat"><option value="">—</option>${Object.entries(cats).map(([k, c]) => `<option value="${esc(k)}" ${k === v.cat ? "selected" : ""}>${esc(L(c))}</option>`).join("")}</select></div>
      <div><label class="f">${t("vid.age")}</label><input class="input" id="f-age" value="${esc(v.age || "3–7")}"></div>
      <div><label class="f">${t("vid.duration")}</label><input class="input" id="f-dur" value="${esc(v.duration || "")}" placeholder="1:30"></div>
    </div>
    <div><label class="f">${t("vid.title")}</label>${mlInputs("title", v.title)}</div>
    <div><label class="f">${t("vid.desc")}</label>${mlInputs("desc", v.desc, true)}</div>
    <div><label class="f">${t("vid.slogan")}</label>${mlInputs("slogan", v.slogan)}</div>
    <div class="card pad" style="background:var(--surface-2)"><label class="f">${t("vid.files")}</label>
      ${LANGS.map((l) => `<div class="row" style="margin-bottom:6px"><b style="width:30px">${l.toUpperCase()}</b><input class="input" style="flex:1" data-src="${l}" value="${esc(sources[l] || "")}" placeholder="videos/${l}/ep13.mp4 ${t("common.or")} https://…/video.mp4"><button class="btn btn-ghost btn-sm" data-try="${l}">▶</button></div>`).join("")}
      <label class="f" style="margin-top:8px">${t("vid.poster")}</label><input class="input" id="f-pos" value="${esc(v.poster || "")}" placeholder="assets/posters/ep13.jpg">
      <p class="muted tiny" style="margin:6px 0 0">${t("vid.fileHint")}</p></div>
    <div class="form-grid">
      <div><label class="f">${t("vid.access")}</label><select class="input" id="f-acc">${["free", "login", "paid"].map((a) => `<option value="${a}" ${a === v.access ? "selected" : ""}>${accName(a)}</option>`).join("")}</select></div>
      <div><label class="f">${t("vid.price")}</label><input class="input" id="f-price" type="number" min="0" value="${v.price || 0}"></div>
      <div style="align-self:end"><label class="check"><input type="checkbox" id="f-sub" ${v.inSubscription !== false ? "checked" : ""}> ${t("vid.inSub")}</label></div>
      <div style="align-self:end"><label class="check"><input type="checkbox" id="f-pub" ${v.published !== false ? "checked" : ""}> ${t("vid.published")}</label></div>
    </div>
    <details><summary class="f" style="cursor:pointer">${t("vid.parentInfo")}</summary>
      <div style="margin-top:10px"><label class="f">${t("watch.questions")} (${t("vid.perLine")})</label>${mlInputs("questions", Object.fromEntries(LANGS.map((l) => [l, (v.questions?.[l] || []).join("\n")])), true)}</div>
      <div><label class="f">${t("watch.activity")}</label>${mlInputs("activity", v.activity, true)}</div>
      <div><label class="f">${t("watch.words")}</label><input class="input" id="f-words" value="${esc((v.words || []).join(", "))}"></div></details>
  </div><div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="f-save">${t("common.save")}</button></div>`, {
    onMount: (m, close) => {
      $$("[data-try]", m).forEach((b) => b.onclick = () => { const u = $(`[data-src="${b.dataset.try}"]`, m).value.trim(); if (u) window.open(u, "_blank", "noopener"); });
      $("#f-save", m).onclick = async () => {
        const id = isNew ? (val(m, "#f-id") || uid("v-")).replace(/[^a-zA-Z0-9_-]/g, "-") : v.id;
        if (isNew && state.videos.some((x) => x.id === id)) return toast(t("vid.idTaken"), true);
        const src = {}; $$("[data-src]", m).forEach((i) => { if (i.value.trim()) src[i.dataset.src] = i.value.trim(); });
        const out = { ...v, id, sectionId: val(m, "#f-sec"), order: num(m, "#f-ord"), cat: val(m, "#f-cat"), age: val(m, "#f-age"), duration: val(m, "#f-dur"),
          title: readMl(m, "title"), desc: readMl(m, "desc"), slogan: readMl(m, "slogan"), poster: val(m, "#f-pos"), sources: src,
          access: val(m, "#f-acc"), price: Math.max(0, num(m, "#f-price")), inSubscription: chk(m, "#f-sub"), published: chk(m, "#f-pub"),
          questions: readMl(m, "questions", true), activity: readMl(m, "activity"), words: val(m, "#f-words").split(",").map((s) => s.trim()).filter(Boolean) };
        if (!out.title.uz && !out.title.ru && !out.title.en) return toast(t("vid.needTitle"), true);
        if (!Object.keys(src).length) return toast(t("vid.needFile"), true);
        try { await store.saveVideo(out); toast(t("common.saved")); close(); renderAdmin("videos"); } catch (e) { toast(e.message, true); }
      };
    } });
}

// ================= BO‘LIMLAR =================
async function sections(el) {
  await refreshAll();
  el.innerHTML = head(t("adm.sections"), `<button class="btn btn-primary" id="add">+ ${t("sec.add")}</button>`) + `<p class="muted">${t("sec.hint")}</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${state.sections.map((s) => {
      const n = state.videos.filter((v) => v.sectionId === s.id).length;
      return `<div class="card"><div class="vthumb">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : ""}<span class="num">${s.order}</span></div><div class="vbody">
        <h3><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${esc(s.color || "#2A9D8F")}"></span> ${esc(L(s.title))}</h3>
        <p class="muted small">${esc(L(s.desc))}</p><div class="tags"><span class="tag">${t("sec.count", { n })}</span><span class="tag ${s.visible !== false ? "free" : ""}">${s.visible !== false ? t("sec.visible") : t("sec.hidden")}</span></div>
        <div class="row" style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-ed="${esc(s.id)}">${t("common.edit")}</button><a class="btn btn-ghost btn-sm" href="#/s/${esc(s.id)}">👁</a><button class="btn btn-danger btn-sm" data-del="${esc(s.id)}">✕</button></div></div></div>`;
    }).join("")}</div>`;
  $("#add").onclick = () => sectionForm({ id: "", order: state.sections.length + 1, visible: true, color: "#2A9D8F" });
  $$("[data-ed]").forEach((b) => b.onclick = () => sectionForm(state.sections.find((s) => s.id === b.dataset.ed)));
  $$("[data-del]").forEach((b) => b.onclick = async () => {
    if (state.videos.some((v) => v.sectionId === b.dataset.del)) return toast(t("sec.notEmpty"), true);
    if (await confirmBox(t("common.confirmDelete"))) { await store.deleteSection(b.dataset.del); renderAdmin("sections"); }
  });
}
function sectionForm(s) {
  const isNew = !s.id;
  modal(`<h2>${isNew ? t("sec.add") : t("common.edit")}</h2><div class="stack">
    <div class="form-grid"><div><label class="f">ID</label><input class="input" id="s-id" value="${esc(s.id)}" ${isNew ? "" : "disabled"} placeholder="yangi-multfilm"></div>
      <div><label class="f">${t("vid.order")}</label><input class="input" id="s-ord" type="number" value="${s.order || 1}"></div>
      <div><label class="f">${t("sec.color")}</label><input class="input" id="s-col" type="color" value="${esc(s.color || "#2A9D8F")}" style="height:44px"></div>
      <div style="align-self:end"><label class="check"><input type="checkbox" id="s-vis" ${s.visible !== false ? "checked" : ""}> ${t("sec.visible")}</label></div></div>
    <div><label class="f">${t("vid.title")}</label>${mlInputs("title", s.title)}</div>
    <div><label class="f">${t("vid.desc")}</label>${mlInputs("desc", s.desc, true)}</div>
    <div><label class="f">${t("sec.cover")}</label><input class="input" id="s-cov" value="${esc(s.cover || "")}" placeholder="assets/img/hero.jpg"></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="s-save">${t("common.save")}</button></div>`, {
    onMount: (m, close) => { $("#s-save", m).onclick = async () => {
      const id = isNew ? (val(m, "#s-id") || uid("sec-")).replace(/[^a-zA-Z0-9_-]/g, "-") : s.id;
      if (isNew && state.sections.some((x) => x.id === id)) return toast(t("vid.idTaken"), true);
      await store.saveSection({ ...s, id, order: num(m, "#s-ord"), color: val(m, "#s-col"), visible: chk(m, "#s-vis"), title: readMl(m, "title"), desc: readMl(m, "desc"), cover: val(m, "#s-cov") });
      toast(t("common.saved")); close(); renderAdmin("sections");
    }; } });
}

// ================= BOSH SAHIFA (PANELLAR) =================
async function home(el) {
  await refreshAll();
  const s = state.settings; const h = s.hero || {}; let blocks = JSON.parse(JSON.stringify(s.blocks || []));
  const ann = s.announcement || {};
  const blockName = (b) => b.type === "section" ? `📚 ${L(state.sections.find((x) => x.id === b.sectionId)?.title) || b.sectionId}` : t("blk." + b.type);
  el.innerHTML = head(t("adm.home"), `<a class="btn btn-ghost btn-sm" href="#/" target="_blank">👁 ${t("home.preview")}</a>`) + `
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">
      <div class="card pad stack"><h3>${t("home.hero")}</h3><div><label class="f">${t("home.heroTitle")}</label>${mlInputs("htitle", h.title)}</div>
        <div><label class="f">${t("home.heroSub")}</label>${mlInputs("hsub", h.subtitle, true)}</div>
        <div><label class="f">${t("home.heroVideo")}</label><select class="input" id="hvid">${state.videos.map((v) => `<option value="${esc(v.id)}" ${v.id === h.videoId ? "selected" : ""}>${esc(L(v.title))}</option>`).join("")}</select></div></div>
      <div class="stack"><div class="card pad stack"><h3>📣 ${t("home.announce")}</h3><label class="check"><input type="checkbox" id="aon" ${ann.on ? "checked" : ""}> ${t("home.announceOn")}</label>${mlInputs("ann", ann)}</div>
        <div class="card pad"><h3>${t("home.blocks")}</h3><p class="muted small">${t("home.blocksHint")}</p><div id="blk"></div>
          <div class="row" style="margin-top:10px"><select class="input" id="addsec" style="flex:1">${state.sections.map((x) => `<option value="${esc(x.id)}">${esc(L(x.title))}</option>`).join("")}</select><button class="btn btn-ghost" id="addb">+ ${t("home.addSection")}</button></div></div></div></div>
    <div class="row" style="margin-top:16px"><button class="btn btn-primary" id="save">${t("common.save")}</button></div>`;
  const drawBlocks = () => {
    $("#blk").innerHTML = blocks.map((b, i) => `<div class="row" style="padding:8px 0;border-bottom:1px dashed var(--line)">
      <label class="check"><input type="checkbox" data-vis="${i}" ${b.visible !== false ? "checked" : ""}></label><span style="flex:1">${esc(blockName(b))}</span>
      <button class="btn btn-ghost btn-sm" data-up="${i}" ${i ? "" : "disabled"}>↑</button><button class="btn btn-ghost btn-sm" data-dn="${i}" ${i < blocks.length - 1 ? "" : "disabled"}>↓</button>
      ${b.type === "section" ? `<button class="btn btn-danger btn-sm" data-rm="${i}">✕</button>` : ""}</div>`).join("");
    $$("[data-vis]").forEach((c) => c.onchange = () => { blocks[c.dataset.vis].visible = c.checked; });
    $$("[data-up]").forEach((b) => b.onclick = () => { const i = +b.dataset.up; [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]; drawBlocks(); });
    $$("[data-dn]").forEach((b) => b.onclick = () => { const i = +b.dataset.dn; [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]]; drawBlocks(); });
    $$("[data-rm]").forEach((b) => b.onclick = () => { blocks.splice(+b.dataset.rm, 1); drawBlocks(); });
  };
  drawBlocks();
  $("#addb").onclick = () => { blocks.push({ id: uid("b-"), type: "section", sectionId: $("#addsec").value, visible: true }); drawBlocks(); };
  $("#save").onclick = async () => {
    await store.saveSettings({ hero: { title: readMl(el, "htitle"), subtitle: readMl(el, "hsub"), videoId: $("#hvid").value }, announcement: { on: $("#aon").checked, ...readMl(el, "ann") }, blocks });
    await refreshAll(); toast(t("common.saved"));
  };
}

// ================= FOYDALANUVCHILAR =================
async function users(el) {
  const [list, orgs] = await Promise.all([store.listUsers(), store.listOrgs()]);
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || "—";
  el.innerHTML = head(t("adm.users"), `<input class="input" id="q" placeholder="${t("usr.search")}" style="width:220px"><select class="input" id="fr" style="width:auto"><option value="">${t("usr.allRoles")}</option><option value="admin">admin</option><option value="teacher">${t("usr.teacher")}</option><option value="user">${t("usr.user")}</option></select><button class="btn btn-ghost" id="csv">CSV</button>`) +
    `<div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>${t("usr.name")}</th><th>${t("usr.role")}</th><th>${t("bilim.name")}</th><th>${t("home.orgTitle")}</th><th>${t("usr.sub")}</th><th>${t("usr.seen")}</th><th></th></tr></thead><tbody id="ut"></tbody></table></div></div>`;
  const draw = () => {
    const q = $("#q").value.toLowerCase(), r = $("#fr").value;
    const rows = list.filter((u) => (!q || (u.name + " " + u.email).toLowerCase().includes(q)) && (!r || (u.role || "user") === r));
    $("#ut").innerHTML = rows.map((u) => `<tr style="${u.blocked ? "opacity:.55" : ""}"><td><b>${esc(u.name || "—")}</b>${u.blocked ? ` <span class="tag paid">${t("usr.blocked")}</span>` : ""}<div class="muted tiny">${esc(u.email)}</div></td>
      <td><select class="input" data-role="${esc(u.uid)}" style="width:auto;padding:6px">${["user", "teacher", "admin"].map((x) => `<option value="${x}" ${(u.role || "user") === x ? "selected" : ""}>${x === "user" ? t("usr.user") : x === "teacher" ? t("usr.teacher") : "admin"}</option>`).join("")}</select></td>
      <td><b>${money(u.bilim)}</b> <button class="btn btn-ghost btn-sm" data-bil="${esc(u.uid)}">±</button></td>
      <td><select class="input" data-org="${esc(u.uid)}" style="width:auto;padding:6px"><option value="">—</option>${orgs.map((o) => `<option value="${esc(o.id)}" ${o.id === u.orgId ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select></td>
      <td>${toMs(u.subUntil) > Date.now() ? fmtDate(u.subUntil) : "—"}</td><td class="small">${ago(u.lastSeen)}</td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-info="${esc(u.uid)}">ⓘ</button><button class="btn btn-ghost btn-sm" data-blk="${esc(u.uid)}">${u.blocked ? t("usr.unblock") : t("usr.block")}</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">${t("common.empty")}</td></tr>`;
    $$("[data-role]").forEach((s) => s.onchange = async () => { if (s.dataset.role === state.user.uid && s.value !== "admin") { toast(t("usr.selfAdmin"), true); s.value = "admin"; return; } await store.updateUser(s.dataset.role, { role: s.value }); toast(t("common.saved")); });
    $$("[data-org]").forEach((s) => s.onchange = async () => { await store.updateUser(s.dataset.org, { orgId: s.value || null }); toast(t("common.saved")); });
    $$("[data-blk]").forEach((b) => b.onclick = async () => { const u = list.find((x) => x.uid === b.dataset.blk); if (u.uid === state.user.uid) return; u.blocked = !u.blocked; await store.updateUser(u.uid, { blocked: u.blocked }); draw(); });
    $$("[data-bil]").forEach((b) => b.onclick = () => bilimForm(list.find((x) => x.uid === b.dataset.bil)));
    $$("[data-info]").forEach((b) => b.onclick = () => userInfo(list.find((x) => x.uid === b.dataset.info), orgName));
  };
  $("#q").oninput = draw; $("#fr").onchange = draw; draw();
  $("#csv").onclick = () => downloadCSV("users.csv", [["uid", "name", "email", "role", "bilim", "org", "subUntil", "createdAt", "lastSeen", "blocked"], ...list.map((u) => [u.uid, u.name, u.email, u.role, u.bilim, orgName(u.orgId), fmtDate(u.subUntil), fmtDate(u.createdAt, true), fmtDate(u.lastSeen, true), u.blocked ? 1 : 0])]);
}
function bilimForm(u) {
  modal(`<h3>${t("usr.adjust")}: ${esc(u.name)}</h3><p class="muted">${t("bilim.balance")}: <b>${money(u.bilim)}</b></p>
    <label class="f">${t("usr.amount")}</label><input class="input" id="b-am" type="number" placeholder="+50 / -10">
    <div style="height:10px"></div><label class="f">${t("usr.note")}</label><input class="input" id="b-note" placeholder="${t("usr.notePh")}">
    <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="b-ok">${t("common.save")}</button></div>`, { small: true, onMount: (m, close) => {
    $("#b-ok", m).onclick = async () => { const a = num(m, "#b-am"); if (!a) return; await store.adjustBilim(u.uid, a, val(m, "#b-note")); toast(t("common.saved")); close(); renderAdmin("users"); };
  } });
}
async function userInfo(u, orgName) {
  const [owned, led] = await Promise.all([store.userOwned(u.uid).catch(() => ({})), store.listLedger(u.uid).catch(() => [])]);
  modal(`<h2>${esc(u.name)}</h2><p class="muted">${esc(u.email)} · ${t("usr.since")} ${fmtDate(u.createdAt)} · ${orgName(u.orgId)}</p>
    <div class="form-grid"><div><label class="f">${t("usr.sub")}</label><input class="input" type="date" id="i-sub" value="${dateIn(u.subUntil)}"></div><div style="align-self:end"><button class="btn btn-ghost" id="i-save">${t("usr.setSub")}</button></div></div>
    <h3 style="margin-top:16px">${t("prof.owned")}</h3><p>${Object.keys(owned).map((id) => esc(L(state.videos.find((v) => v.id === id)?.title) || id)).join(", ") || "—"}</p>
    <h3>${t("prof.history")}</h3><ul class="feed">${led.slice(0, 20).map((x) => `<li><span>${t("tx." + x.type)} ${x.note ? "· " + esc(x.note) : ""}</span><span class="spacer"></span><b>${x.amount > 0 ? "+" : ""}${money(x.amount)}</b><time>${fmtDate(x.at, true)}</time></li>`).join("") || "<li class='muted'>—</li>"}</ul>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.close")}</button></div>`, { onMount: (m, close) => {
    $("#i-save", m).onclick = async () => { const d = $("#i-sub", m).value; await store.updateUser(u.uid, { subUntil: d ? new Date(d + "T23:59:59").getTime() : null }); toast(t("common.saved")); close(); renderAdmin("users"); };
  } });
}

// ================= BOG‘CHALAR (SHARTNOMALAR) =================
async function orgs(el) {
  await refreshAll();
  const list = await store.listOrgs();
  const counts = {}; await Promise.all(list.map(async (o) => { counts[o.id] = (await store.orgMembers(o.id).catch(() => [])).length; }));
  const live = (o) => o.active && (!o.end || toMs(o.end) > Date.now());
  el.innerHTML = head(t("adm.orgs"), `<button class="btn btn-primary" id="add">+ ${t("org.add")}</button>`) + `<p class="muted">${t("org.hint")}</p>
    <div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>${t("org.name")}</th><th>${t("org.contract")}</th><th>${t("org.period")}</th><th>${t("org.access")}</th><th>${t("org.code")}</th><th>${t("org.members")}</th><th>${t("org.status")}</th><th></th></tr></thead><tbody>
    ${list.map((o) => `<tr><td><b>${esc(o.name)}</b><div class="muted tiny">${esc(o.contact || "")} ${esc(o.phone || "")}</div></td><td>${esc(o.contractNo || "—")}</td><td class="small">${fmtDate(o.start)} — ${fmtDate(o.end)}</td>
      <td class="small">${o.allAccess ? t("org.all") : t("org.partial", { s: (o.sections || []).length, v: (o.videos || []).length })}</td><td><code>${esc(o.joinCode || "—")}</code></td>
      <td>${counts[o.id] || 0}${o.maxMembers ? " / " + o.maxMembers : ""}</td><td><span class="tag ${live(o) ? "own" : "paid"}">${live(o) ? t("org.active") : t("org.inactive")}</span></td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-mem="${esc(o.id)}">👥</button><button class="btn btn-ghost btn-sm" data-ed="${esc(o.id)}">${t("common.edit")}</button><button class="btn btn-danger btn-sm" data-del="${esc(o.id)}">✕</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty">${t("common.empty")}</td></tr>`}
    </tbody></table></div></div>`;
  $("#add").onclick = () => orgForm({ active: true, allAccess: false, sections: [], videos: [], start: Date.now(), end: Date.now() + 365 * 86400000 });
  $$("[data-ed]").forEach((b) => b.onclick = () => orgForm(list.find((o) => o.id === b.dataset.ed)));
  $$("[data-del]").forEach((b) => b.onclick = async () => { if (await confirmBox(t("common.confirmDelete"))) { await store.deleteOrg(b.dataset.del); renderAdmin("orgs"); } });
  $$("[data-mem]").forEach((b) => b.onclick = async () => {
    const mem = await store.orgMembers(b.dataset.mem);
    modal(`<h3>${esc(list.find((o) => o.id === b.dataset.mem).name)}</h3><ul class="feed">${mem.map((u) => `<li><span>${esc(u.name)} <span class="muted small">${esc(u.email)}</span></span></li>`).join("") || "<li class='muted'>—</li>"}</ul><div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.close")}</button></div>`);
  });
}
function genCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return [...Array(6)].map(() => a[Math.floor(Math.random() * a.length)]).join(""); }
function orgForm(o) {
  const isNew = !o.id;
  modal(`<h2>${isNew ? t("org.add") : t("common.edit")}</h2><div class="stack"><div class="form-grid">
    <div><label class="f">${t("org.name")}</label><input class="input" id="o-name" value="${esc(o.name || "")}" placeholder="12-son MTT"></div>
    <div><label class="f">${t("org.contract")}</label><input class="input" id="o-no" value="${esc(o.contractNo || "")}"></div>
    <div><label class="f">${t("org.contact")}</label><input class="input" id="o-ct" value="${esc(o.contact || "")}"></div>
    <div><label class="f">${t("org.phone")}</label><input class="input" id="o-ph" value="${esc(o.phone || "")}"></div>
    <div><label class="f">${t("org.start")}</label><input class="input" type="date" id="o-st" value="${dateIn(o.start)}"></div>
    <div><label class="f">${t("org.end")}</label><input class="input" type="date" id="o-en" value="${dateIn(o.end)}"></div>
    <div><label class="f">${t("org.code")}</label><div class="row" style="flex-wrap:nowrap"><input class="input" id="o-code" value="${esc(o.joinCode || genCode())}" style="text-transform:uppercase"><button class="btn btn-ghost btn-sm" id="o-gen">↻</button></div></div>
    <div><label class="f">${t("org.max")}</label><input class="input" type="number" id="o-max" value="${o.maxMembers || 0}"></div></div>
    <div class="row"><label class="check"><input type="checkbox" id="o-act" ${o.active ? "checked" : ""}> ${t("org.active")}</label><label class="check"><input type="checkbox" id="o-all" ${o.allAccess ? "checked" : ""}> ${t("org.allAccess")}</label></div>
    <div id="o-parts"><label class="f">${t("org.sections")}</label><div class="row">${state.sections.map((s) => `<label class="check"><input type="checkbox" data-osec="${esc(s.id)}" ${(o.sections || []).includes(s.id) ? "checked" : ""}> ${esc(L(s.title))}</label>`).join("")}</div>
      <label class="f" style="margin-top:10px">${t("org.videos")}</label><div class="row" style="max-height:180px;overflow:auto">${state.videos.filter((v) => v.access !== "free").map((v) => `<label class="check small"><input type="checkbox" data-ovid="${esc(v.id)}" ${(o.videos || []).includes(v.id) ? "checked" : ""}> ${esc(L(v.title))}</label>`).join("")}</div></div>
    <div><label class="f">${t("usr.note")}</label><textarea class="input" id="o-note">${esc(o.note || "")}</textarea></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="o-save">${t("common.save")}</button></div>`, {
    onMount: (m, close) => {
      const sync = () => { $("#o-parts", m).style.opacity = chk(m, "#o-all") ? .4 : 1; };
      $("#o-all", m).onchange = sync; sync();
      $("#o-gen", m).onclick = () => { $("#o-code", m).value = genCode(); };
      $("#o-save", m).onclick = async () => {
        if (!val(m, "#o-name")) return toast(t("org.needName"), true);
        const st = $("#o-st", m).value, en = $("#o-en", m).value;
        await store.saveOrg({ ...o, name: val(m, "#o-name"), contractNo: val(m, "#o-no"), contact: val(m, "#o-ct"), phone: val(m, "#o-ph"),
          start: st ? new Date(st + "T00:00:00").getTime() : null, end: en ? new Date(en + "T23:59:59").getTime() : null,
          joinCode: val(m, "#o-code").toUpperCase().replace(/[^A-Z0-9]/g, ""), maxMembers: num(m, "#o-max"), active: chk(m, "#o-act"), allAccess: chk(m, "#o-all"),
          sections: $$("[data-osec]", m).filter((c) => c.checked).map((c) => c.dataset.osec), videos: $$("[data-ovid]", m).filter((c) => c.checked).map((c) => c.dataset.ovid), note: val(m, "#o-note") });
        toast(t("common.saved")); close(); renderAdmin("orgs");
      };
    } });
}

// ================= TARIFLAR =================
async function tariffs(el) {
  await refreshAll();
  el.innerHTML = head(t("adm.tariffs"), `<button class="btn btn-primary" id="add">+ ${t("tar.add")}</button>`) + `<p class="muted">${t("tar.hint")}</p>
    <div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>#</th><th>${t("tar.name")}</th><th>${t("tar.type")}</th><th>${t("bilim.name")}</th><th>${t("tar.priceCol")}</th><th>${t("org.status")}</th><th></th></tr></thead><tbody>
    ${state.tariffs.map((x) => `<tr><td>${x.order}</td><td><b>${esc(L(x.name))}</b></td><td>${x.type === "package" ? t("tar.package") : t("tar.subscription")}</td>
      <td>${money(x.bilim)}${x.bonus ? ` <span class="tag free">+${x.bonus}</span>` : ""}</td><td>${x.type === "package" ? money(x.priceUZS) + " " + t("tar.sum") : t("tar.days", { n: x.days })}</td>
      <td>${x.active !== false ? `<span class="tag own">${t("org.active")}</span>` : `<span class="tag">${t("org.inactive")}</span>`}</td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${esc(x.id)}">${t("common.edit")}</button><button class="btn btn-danger btn-sm" data-del="${esc(x.id)}">✕</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">${t("common.empty")}</td></tr>`}
    </tbody></table></div></div>`;
  $("#add").onclick = () => tariffForm({ type: "package", active: true, order: state.tariffs.length + 1, bilim: 50, bonus: 0, priceUZS: 10000, days: 30 });
  $$("[data-ed]").forEach((b) => b.onclick = () => tariffForm(state.tariffs.find((x) => x.id === b.dataset.ed)));
  $$("[data-del]").forEach((b) => b.onclick = async () => { if (await confirmBox(t("common.confirmDelete"))) { await store.deleteTariff(b.dataset.del); renderAdmin("tariffs"); } });
}
function tariffForm(x) {
  const isNew = !x.id;
  modal(`<h2>${isNew ? t("tar.add") : t("common.edit")}</h2><div class="stack">
    <div class="form-grid"><div><label class="f">${t("tar.type")}</label><select class="input" id="x-type"><option value="package" ${x.type === "package" ? "selected" : ""}>${t("tar.package")}</option><option value="subscription" ${x.type === "subscription" ? "selected" : ""}>${t("tar.subscription")}</option></select></div>
      <div><label class="f">${t("vid.order")}</label><input class="input" type="number" id="x-ord" value="${x.order || 1}"></div>
      <div><label class="f" id="x-bl">${t("bilim.name")}</label><input class="input" type="number" id="x-bil" value="${x.bilim || 0}"></div>
      <div class="pk"><label class="f">${t("tar.bonus")}</label><input class="input" type="number" id="x-bon" value="${x.bonus || 0}"></div>
      <div class="pk"><label class="f">${t("tar.priceUZS")}</label><input class="input" type="number" id="x-uzs" value="${x.priceUZS || 0}"></div>
      <div class="sb"><label class="f">${t("tar.daysLbl")}</label><input class="input" type="number" id="x-days" value="${x.days || 30}"></div>
      <div style="align-self:end"><label class="check"><input type="checkbox" id="x-act" ${x.active !== false ? "checked" : ""}> ${t("org.active")}</label></div></div>
    <div><label class="f">${t("tar.name")}</label>${mlInputs("name", x.name)}</div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="x-save">${t("common.save")}</button></div>`, {
    onMount: (m, close) => {
      const sync = () => { const pk = val(m, "#x-type") === "package"; $$(".pk", m).forEach((e) => e.style.display = pk ? "" : "none"); $$(".sb", m).forEach((e) => e.style.display = pk ? "none" : ""); $("#x-bl", m).textContent = pk ? t("tar.bilimGives") : t("tar.bilimCosts"); };
      $("#x-type", m).onchange = sync; sync();
      $("#x-save", m).onclick = async () => {
        const type = val(m, "#x-type");
        await store.saveTariff({ ...x, id: x.id || uid(type === "package" ? "pkg-" : "sub-"), type, order: num(m, "#x-ord"), bilim: num(m, "#x-bil"), bonus: type === "package" ? num(m, "#x-bon") : 0,
          priceUZS: type === "package" ? num(m, "#x-uzs") : 0, days: type === "subscription" ? num(m, "#x-days") : 0, active: chk(m, "#x-act"), name: readMl(m, "name") });
        toast(t("common.saved")); close(); renderAdmin("tariffs");
      };
    } });
}

// ================= TO‘LOV SO‘ROVLARI =================
async function topups(el) {
  const list = await store.listTopups();
  el.innerHTML = head(t("adm.topups"), `<div class="tabs" style="margin:0" id="ft">${["pending", "approved", "rejected", ""].map((s) => `<button data-s="${s}" class="${s === "pending" ? "on" : ""}">${s ? t("st." + s) : t("common.all")}</button>`).join("")}</div>`) +
    `<p class="muted">${t("top.hint")}</p><div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>${t("common.date")}</th><th>${t("usr.name")}</th><th>${t("tar.name")}</th><th>${t("bilim.name")}</th><th>${t("tar.priceCol")}</th><th>${t("org.status")}</th><th></th></tr></thead><tbody id="tt"></tbody></table></div></div>`;
  const draw = (st) => {
    $("#tt").innerHTML = list.filter((x) => !st || x.status === st).map((x) => `<tr><td class="small">${fmtDate(x.at, true)}</td><td><b>${esc(x.name || "—")}</b><div class="muted tiny">${esc(x.email || "")}</div></td>
      <td>${esc(L(state.tariffs.find((r) => r.id === x.tariffId)?.name) || x.tariffId)}</td><td><b>${money(x.bilim)}</b></td><td>${money(x.priceUZS)} ${t("tar.sum")}</td>
      <td><span class="tag ${x.status === "approved" ? "own" : x.status === "rejected" ? "paid" : "login"}">${t("st." + x.status)}</span>${x.adminNote ? `<div class="muted tiny">${esc(x.adminNote)}</div>` : ""}</td>
      <td class="row" style="flex-wrap:nowrap">${x.status === "pending" ? `<button class="btn btn-primary btn-sm" data-ok="${esc(x.id)}">✓ ${t("top.approve")}</button><button class="btn btn-danger btn-sm" data-no="${esc(x.id)}">✕</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">${t("common.empty")}</td></tr>`;
    const act = (id, ok) => modal(`<h3>${ok ? t("top.approveQ") : t("top.rejectQ")}</h3><label class="f">${t("usr.note")}</label><input class="input" id="tn" placeholder="${t("top.notePh")}">
      <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="tok">${t("common.ok")}</button></div>`, { small: true, onMount: (m, close) => {
      $("#tok", m).onclick = async () => { await store.resolveTopup(id, ok, val(m, "#tn")); toast(t("common.saved")); close(); renderAdmin("topups"); };
    } });
    $$("[data-ok]").forEach((b) => b.onclick = () => act(b.dataset.ok, true));
    $$("[data-no]").forEach((b) => b.onclick = () => act(b.dataset.no, false));
  };
  $$("#ft button").forEach((b) => b.onclick = () => { $$("#ft button").forEach((x) => x.classList.toggle("on", x === b)); draw(b.dataset.s); });
  draw("pending");
}

// ================= TRANZAKSIYALAR =================
async function ledger(el) {
  const [list, us] = await Promise.all([store.listLedger(), store.listUsers()]);
  const nm = (id) => { const u = us.find((x) => x.uid === id); return u ? (u.name || u.email) : id; };
  const sum = (type) => list.filter((x) => x.type === type).reduce((s, x) => s + Number(x.amount), 0);
  el.innerHTML = head(t("adm.ledger"), `<button class="btn btn-ghost" id="csv">CSV</button>`) + `
    <div class="stats" style="margin-bottom:14px"><div class="card stat"><b>+${money(sum("topup"))}</b><span>${t("tx.topup")}</span></div><div class="card stat"><b>${money(sum("purchase"))}</b><span>${t("tx.purchase")}</span></div>
      <div class="card stat"><b>${money(sum("subscription"))}</b><span>${t("tx.subscription")}</span></div><div class="card stat"><b>${money(sum("admin"))}</b><span>${t("tx.admin")}</span></div><div class="card stat"><b>+${money(sum("bonus"))}</b><span>${t("tx.bonus")}</span></div></div>
    <div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>${t("common.date")}</th><th>${t("usr.name")}</th><th>${t("tar.type")}</th><th>${t("usr.amount")}</th><th>${t("ledger.after")}</th><th>${t("usr.note")}</th></tr></thead><tbody>
    ${list.slice(0, 500).map((x) => `<tr><td class="small">${fmtDate(x.at, true)}</td><td>${esc(nm(x.uid))}</td><td>${t("tx." + x.type)}</td><td><b style="color:${x.amount >= 0 ? "var(--success)" : "var(--danger)"}">${x.amount > 0 ? "+" : ""}${money(x.amount)}</b></td><td>${x.balanceAfter != null ? money(x.balanceAfter) : "—"}</td>
      <td class="small">${esc(x.note || (x.type === "purchase" ? L(state.videos.find((v) => v.id === x.ref)?.title) || x.ref : x.ref || ""))}${x.by ? ` <span class="muted">· ${esc(x.by)}</span>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">${t("common.empty")}</td></tr>`}</tbody></table></div></div>`;
  $("#csv").onclick = () => downloadCSV("bilim-ledger.csv", [["date", "user", "type", "amount", "balanceAfter", "ref", "note", "by"], ...list.map((x) => [fmtDate(x.at, true), nm(x.uid), x.type, x.amount, x.balanceAfter, x.ref, x.note, x.by])]);
}

// ================= SOZLAMALAR =================
async function settings(el) {
  await refreshAll();
  const s = state.settings; let cats = JSON.parse(JSON.stringify(state.cats));
  el.innerHTML = head(t("adm.settings")) + `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">
    <div class="card pad stack"><h3>${t("set.general")}</h3><div><label class="f">${t("set.siteName")}</label>${mlInputs("sname", s.siteName)}</div>
      <div class="form-grid"><div><label class="f">${t("set.defLang")}</label><select class="input" id="g-lang">${LANGS.map((l) => `<option ${l === s.defaultLang ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div><label class="f">${t("set.bonus")}</label><input class="input" type="number" id="g-bonus" value="${s.welcomeBonus || 0}"></div></div>
      <label class="check"><input type="checkbox" id="g-gate" ${s.parentGate !== false ? "checked" : ""}> ${t("set.gate")}</label>
      <label class="check"><input type="checkbox" id="g-auto" ${s.autoplayNext ? "checked" : ""}> ${t("set.autoplay")}</label>
      <label class="check"><input type="checkbox" id="g-maint" ${s.maintenance ? "checked" : ""}> ${t("set.maint")}</label></div>
    <div class="card pad stack"><h3>${t("set.contacts")}</h3><div><label class="f">${t("org.phone")}</label><input class="input" id="c-ph" value="${esc(s.contactPhone || "")}" placeholder="+998 90 000 00 00"></div>
      <div><label class="f">Email</label><input class="input" id="c-em" value="${esc(s.contactEmail || "")}"></div><div><label class="f">Telegram</label><input class="input" id="c-tg" value="${esc(s.contactTelegram || "")}" placeholder="@odobli_bolajonlar"></div>
      <h3 style="margin-top:12px">${t("set.cats")}</h3><div id="cats"></div><button class="btn btn-ghost btn-sm" id="cat-add">+ ${t("set.addCat")}</button></div>
    <div class="card pad stack"><h3>${t("set.data")}</h3><p class="muted small">${t("set.dataHint")}</p>
      <button class="btn btn-ghost" id="d-exp">⬇ ${t("set.export")}</button>
      <button class="btn btn-ghost" id="d-seed">⬆ ${t("set.importSeed")}</button>
      ${store.mode === "demo" ? `<button class="btn btn-ghost" id="d-sample">${t("set.sample")}</button><button class="btn btn-danger" id="d-reset">${t("set.reset")}</button>` : ""}</div></div>
    <div class="row" style="margin-top:16px"><button class="btn btn-primary" id="save">${t("common.save")}</button></div>`;
  const drawCats = () => {
    $("#cats").innerHTML = Object.entries(cats).map(([k, c]) => `<div class="row" style="margin-bottom:6px;flex-wrap:nowrap"><input type="color" value="${esc(c.color || "#888888")}" data-cc="${esc(k)}" style="width:40px;height:36px;border:0;background:none">
      ${LANGS.map((l) => `<input class="input" data-cn="${esc(k)}" data-l="${l}" value="${esc(c[l] || "")}" placeholder="${l}">`).join("")}<button class="btn btn-danger btn-sm" data-cd="${esc(k)}">✕</button></div>`).join("");
    $$("[data-cc]").forEach((i) => i.oninput = () => { cats[i.dataset.cc].color = i.value; });
    $$("[data-cn]").forEach((i) => i.oninput = () => { cats[i.dataset.cn][i.dataset.l] = i.value; });
    $$("[data-cd]").forEach((b) => b.onclick = () => { delete cats[b.dataset.cd]; drawCats(); });
  };
  drawCats();
  $("#cat-add").onclick = () => { cats[uid("c")] = { uz: "", ru: "", en: "", color: "#2A9D8F" }; drawCats(); };
  $("#save").onclick = async () => {
    await store.saveSettings({ siteName: readMl(el, "sname"), defaultLang: val(el, "#g-lang"), welcomeBonus: Math.max(0, num(el, "#g-bonus")), parentGate: chk(el, "#g-gate"), autoplayNext: chk(el, "#g-auto"),
      maintenance: chk(el, "#g-maint"), contactPhone: val(el, "#c-ph"), contactEmail: val(el, "#c-em"), contactTelegram: val(el, "#c-tg") });
    await store.saveCategories(cats); await refreshAll(); toast(t("common.saved"));
  };
  $("#d-exp").onclick = async () => {
    const data = await store.exportAll(); const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" })); a.download = `odobli-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $("#d-seed").onclick = async () => { if (!(await confirmBox(t("set.importQ")))) return; await store.importSeed(state.seed); await refreshAll(); toast(t("common.saved")); };
  $("#d-sample")?.addEventListener("click", async () => { await store.fillSample(); toast(t("common.saved")); location.hash = "#/admin/monitor"; });
  $("#d-reset")?.addEventListener("click", async () => { if (await confirmBox(t("set.resetQ"))) { await store.resetDemo(); location.hash = "#/"; location.reload(); } });
}
