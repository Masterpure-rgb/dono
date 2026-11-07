// DEMO rejim: hamma ma’lumot shu brauzerning localStorage’ida saqlanadi.
// Firebase sozlanmaguncha platformani to‘liq sinab ko‘rish uchun.
import { uid, toMs, modal, esc } from "./util.js";
import { t } from "./i18n.js";
import { accessInfo } from "./access.js";

const KEY = "ob_demo_db_v1", SKEY = "ob_demo_uid", SID = "ob_sid";
let db = null, listeners = [], seedCache = null;

function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn(e); } }
function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
const clone = (x) => JSON.parse(JSON.stringify(x));
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const now = () => Date.now();

function fresh(seed) {
  const m = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  return {
    settings: clone(seed.settings), categories: clone(seed.categories),
    sections: m(clone(seed.sections)), videos: m(clone(seed.videos)), tariffs: m(clone(seed.tariffs)),
    users: {}, owned: {}, ledger: [], topups: {}, orgs: {}, joinCodes: {}, views: [], errors: [], presence: {},
  };
}
function curUid() { return localStorage.getItem(SKEY); }
function me() { const u = curUid(); return u && db.users[u] ? db.users[u] : null; }
function emit() { const u = me(); listeners.forEach((f) => f(u ? clone(u) : null)); }
function needAdmin() { const u = me(); if (!u || u.role !== "admin") throw new Error(t("err.noAdmin")); }
function needUser() { const u = me(); if (!u) throw new Error(t("err.needLogin")); if (u.blocked) throw new Error(t("err.blocked")); return u; }
function ledgerAdd(e) { db.ledger.unshift({ id: uid("tx_"), at: now(), ...e }); }

export const store = {
  mode: "demo",
  async init(seed) {
    seedCache = seed;
    db = load();
    if (!db || !db.settings) { db = fresh(seed); save(); }
    if (!sessionStorage.getItem(SID)) sessionStorage.setItem(SID, uid("s_"));
    // boshqa varaqda o‘zgarsa — yangilash
    window.addEventListener("storage", (e) => { if (e.key === KEY) { db = load() || db; emit(); } });
  },
  onAuth(cb) { listeners.push(cb); const u = me(); cb(u ? clone(u) : null); },
  async signIn() {
    return new Promise((res, rej) => {
      modal(`<h3>${t("login.demoTitle")}</h3><p class="muted small">${t("login.demoText")}</p>
        <label class="f">${t("login.name")}</label><input class="input" id="dm-name" placeholder="Dilnoza">
        <div style="height:10px"></div><label class="f">Email</label><input class="input" id="dm-mail" type="email" placeholder="ism@gmail.com">
        <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="dm-ok">${t("login.enter")}</button></div>`,
        { small: true, onMount: (m, close) => {
          m.querySelector("#dm-ok").onclick = () => {
            const name = m.querySelector("#dm-name").value.trim() || "Mehmon";
            const email = m.querySelector("#dm-mail").value.trim().toLowerCase() || `demo${Math.floor(Math.random() * 1e4)}@example.com`;
            let u = Object.values(db.users).find((x) => x.email === email);
            if (!u) {
              const first = Object.keys(db.users).length === 0;
              u = { uid: uid("u_"), name, email, photo: "", role: first ? "admin" : "user", bilim: Number(db.settings.welcomeBonus || 0),
                orgId: null, subUntil: null, blocked: false, createdAt: now(), lastSeen: now(), lang: null };
              db.users[u.uid] = u;
              if (u.bilim) ledgerAdd({ uid: u.uid, amount: u.bilim, type: "bonus", note: "welcome", balanceAfter: u.bilim });
            }
            localStorage.setItem(SKEY, u.uid); save(); close(); emit(); res(clone(u));
          };
          m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => rej(new Error("cancel"))));
        } });
    });
  },
  async signOut() { localStorage.removeItem(SKEY); emit(); },
  async me() { const u = me(); return u ? clone(u) : null; },
  async updateMe(patch) {
    const u = needUser(); const allowed = ["name", "lang", "theme"];
    for (const k of allowed) if (k in patch) u[k] = patch[k];
    save(); emit();
  },

  // ---- sozlamalar va katalog ----
  async getSettings() { return clone(db.settings); },
  async saveSettings(patch) { needAdmin(); db.settings = { ...db.settings, ...clone(patch) }; save(); },
  async getCategories() { return clone(db.categories || {}); },
  async saveCategories(c) { needAdmin(); db.categories = clone(c); save(); },
  async listSections() { return Object.values(clone(db.sections)).sort(byOrder); },
  async saveSection(s) { needAdmin(); s.id = s.id || uid("sec_"); db.sections[s.id] = clone(s); save(); return s.id; },
  async deleteSection(id) { needAdmin(); delete db.sections[id]; save(); },
  async listVideos() { return Object.values(clone(db.videos)).sort(byOrder); },
  async saveVideo(v) { needAdmin(); v.id = v.id || uid("v_"); db.videos[v.id] = clone(v); save(); return v.id; },
  async deleteVideo(id) { needAdmin(); delete db.videos[id]; save(); },
  async getSources(video) {
    const u = me(); const owned = u ? db.owned[u.uid] || {} : {}; const org = u?.orgId ? db.orgs[u.orgId] : null;
    if (!accessInfo(video, { user: u, owned, org }).ok) return null;
    return clone(db.videos[video.id]?.sources || video.sources || {});
  },

  // ---- tariflar va bilim ----
  async listTariffs() { return Object.values(clone(db.tariffs)).sort(byOrder); },
  async saveTariff(x) { needAdmin(); x.id = x.id || uid("tr_"); db.tariffs[x.id] = clone(x); save(); return x.id; },
  async deleteTariff(id) { needAdmin(); delete db.tariffs[id]; save(); },
  async myOwned() { const u = me(); return u ? clone(db.owned[u.uid] || {}) : {}; },
  async purchaseVideo(vid) {
    const u = needUser(); const v = db.videos[vid]; if (!v) throw new Error("404");
    db.owned[u.uid] = db.owned[u.uid] || {};
    if (db.owned[u.uid][vid]) return;
    const price = Number(v.price || 0);
    if (u.bilim < price) throw new Error(t("err.notEnough"));
    u.bilim -= price; db.owned[u.uid][vid] = { at: now(), price };
    ledgerAdd({ uid: u.uid, amount: -price, type: "purchase", ref: vid, balanceAfter: u.bilim });
    save(); emit();
  },
  async buySubscription(tid) {
    const u = needUser(); const tr = db.tariffs[tid];
    if (!tr || tr.type !== "subscription" || !tr.active) throw new Error("404");
    if (u.bilim < tr.bilim) throw new Error(t("err.notEnough"));
    const base = Math.max(now(), toMs(u.subUntil));
    u.bilim -= tr.bilim; u.subUntil = base + tr.days * 86400000;
    ledgerAdd({ uid: u.uid, amount: -tr.bilim, type: "subscription", ref: tid, balanceAfter: u.bilim });
    save(); emit();
  },
  async requestTopup(tid, note = "") {
    const u = needUser(); const tr = db.tariffs[tid];
    if (!tr || tr.type !== "package" || !tr.active) throw new Error("404");
    const id = uid("tp_");
    db.topups[id] = { id, uid: u.uid, name: u.name, email: u.email, tariffId: tid, bilim: Number(tr.bilim) + Number(tr.bonus || 0), priceUZS: tr.priceUZS, note, status: "pending", at: now() };
    save(); return id;
  },
  async myTopups() { const u = me(); return u ? Object.values(clone(db.topups)).filter((x) => x.uid === u.uid).sort((a, b) => b.at - a.at) : []; },
  async listTopups() { needAdmin(); return Object.values(clone(db.topups)).sort((a, b) => b.at - a.at); },
  async resolveTopup(id, approve, note = "") {
    needAdmin(); const tp = db.topups[id]; if (!tp || tp.status !== "pending") return;
    tp.status = approve ? "approved" : "rejected"; tp.resolvedAt = now(); tp.by = me().email; tp.adminNote = note;
    if (approve) { const u = db.users[tp.uid]; if (u) { u.bilim += tp.bilim; ledgerAdd({ uid: u.uid, amount: tp.bilim, type: "topup", ref: id, by: me().email, balanceAfter: u.bilim }); } }
    save(); emit();
  },

  // ---- foydalanuvchilar ----
  async listUsers() { needAdmin(); return Object.values(clone(db.users)).sort((a, b) => b.createdAt - a.createdAt); },
  async updateUser(id, patch) {
    needAdmin(); const u = db.users[id]; if (!u) return;
    for (const k of ["role", "blocked", "orgId", "subUntil", "name"]) if (k in patch) u[k] = patch[k];
    save(); emit();
  },
  async adjustBilim(id, amount, note) {
    needAdmin(); const u = db.users[id]; if (!u) return;
    amount = Math.trunc(Number(amount)); if (!amount) return;
    u.bilim = Math.max(0, u.bilim + amount);
    ledgerAdd({ uid: id, amount, type: "admin", note, by: me().email, balanceAfter: u.bilim });
    save(); emit();
  },
  async listLedger(forUid) {
    const u = me(); if (!u) return [];
    if (forUid && forUid !== u.uid) needAdmin();
    if (!forUid && u.role !== "admin") forUid = u.uid;
    return clone(db.ledger.filter((x) => !forUid || x.uid === forUid));
  },
  async userOwned(id) { needAdmin(); return clone(db.owned[id] || {}); },

  // ---- bog‘chalar (tashkilotlar) ----
  async listOrgs() { needAdmin(); return Object.values(clone(db.orgs)).sort((a, b) => (a.name || "").localeCompare(b.name || "")); },
  async getOrg(id) { return id && db.orgs[id] ? clone(db.orgs[id]) : null; },
  async saveOrg(o) {
    needAdmin(); o.id = o.id || uid("org_");
    const old = db.orgs[o.id]; if (old?.joinCode && old.joinCode !== o.joinCode) delete db.joinCodes[old.joinCode];
    if (o.joinCode) db.joinCodes[o.joinCode] = o.id;
    db.orgs[o.id] = clone(o); save(); return o.id;
  },
  async deleteOrg(id) { needAdmin(); const o = db.orgs[id]; if (o?.joinCode) delete db.joinCodes[o.joinCode]; delete db.orgs[id]; save(); },
  async joinOrg(code) {
    const u = needUser(); code = String(code || "").trim().toUpperCase();
    const oid = db.joinCodes[code]; if (!oid) throw new Error(t("err.badCode"));
    const o = db.orgs[oid];
    const members = Object.values(db.users).filter((x) => x.orgId === oid).length;
    if (o.maxMembers && members >= o.maxMembers) throw new Error(t("err.orgFull"));
    u.orgId = oid; save(); emit(); return clone(o);
  },
  async leaveOrg() { const u = needUser(); u.orgId = null; save(); emit(); },
  async orgMembers(oid) { needAdmin(); return Object.values(clone(db.users)).filter((x) => x.orgId === oid); },

  // ---- monitoring ----
  async logView(e) { db.views.push({ id: uid("vw_"), at: now(), uid: curUid() || null, ...e }); if (db.views.length > 5000) db.views.splice(0, 1000); save(); },
  async listViews(sinceMs = 0) { needAdmin(); return clone(db.views.filter((v) => v.at >= sinceMs)); },
  async logError(e) { db.errors.unshift({ id: uid("er_"), at: now(), uid: curUid() || null, ...e }); db.errors = db.errors.slice(0, 200); save(); },
  async listErrors() { needAdmin(); return clone(db.errors); },
  async clearErrors() { needAdmin(); db.errors = []; save(); },
  async heartbeat(page) {
    const sid = sessionStorage.getItem(SID); db.presence[sid] = { at: now(), page, uid: curUid() || null };
    const u = me(); if (u) u.lastSeen = now();
    save();
  },
  async listPresence() { needAdmin(); return Object.entries(clone(db.presence)).map(([id, p]) => ({ id, ...p })); },

  // ---- zaxira ----
  async exportAll() { needAdmin(); return clone(db); },
  async resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); db = fresh(seedCache); save(); emit(); },
  async importSeed(seed) { needAdmin(); const keep = { users: db.users, owned: db.owned, ledger: db.ledger, topups: db.topups, orgs: db.orgs, joinCodes: db.joinCodes, views: db.views, errors: db.errors, presence: db.presence }; db = { ...fresh(seed), ...keep }; save(); },
  // Faqat demo: monitoringni ko‘rish uchun namuna ma’lumot (aniq belgilangan)
  async fillSample() {
    needAdmin(); const vids = Object.keys(db.videos); const names = ["Namuna: Aziza", "Namuna: Sardor", "Namuna: Malika", "Namuna: Jasur", "Namuna: Nodira"];
    names.forEach((n, i) => { const id = uid("u_"); db.users[id] = { uid: id, name: n, email: `sample${i}@example.com`, role: "user", bilim: 20 + i * 10, orgId: null, subUntil: null, blocked: false, createdAt: now() - i * 86400000 * 2, lastSeen: now() - i * 600000, sample: true }; });
    for (let d = 0; d < 14; d++) for (let k = 0; k < 3 + ((d * 7) % 9); k++) {
      db.views.push({ id: uid("vw_"), at: now() - d * 86400000 - k * 3600000, uid: null, videoId: vids[(d + k) % vids.length], lang: ["uz", "uz", "ru", "en"][k % 4], sec: 40 + ((d * k) % 60), completed: k % 3 !== 0, device: k % 2 ? "mobile" : "desktop", sample: true });
    }
    save();
  },
};
export default store;
