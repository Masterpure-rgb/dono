// FIREBASE rejimi: Google (Gmail) orqali kirish + Cloud Firestore ma’lumotlar bazasi.
// Xavfsizlik qoidalari firestore.rules faylida (Firebase konsoliga joylanadi).
import { t } from "./i18n.js";
import { toMs, uid as mkid } from "./util.js";

const V = "10.12.2";
let fa, fs, app, auth, db, seed, listeners = [], current = null, unsubMe = null;
const SID = "ob_sid";
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

function d(path, ...rest) { return fs.doc(db, path, ...rest); }
function c(path, ...rest) { return fs.collection(db, path, ...rest); }
function plain(snap) { const x = snap.data(); if (!x) return null; for (const k of Object.keys(x)) if (x[k] && typeof x[k].toMillis === "function") x[k] = x[k].toMillis(); return x; }
async function all(q) { const s = await fs.getDocs(q); return s.docs.map((x) => ({ id: x.id, ...plain(x) })); }
function needUser() { if (!current) throw new Error(t("err.needLogin")); if (current.blocked) throw new Error(t("err.blocked")); return current; }
function needAdmin() { if (!current || current.role !== "admin") throw new Error(t("err.noAdmin")); }
const ts = (ms) => (ms ? fs.Timestamp.fromMillis(ms) : null);
function emit() { listeners.forEach((f) => f(current ? { ...current } : null)); }

async function ensureUser(u) {
  const ref = d("users", u.uid);
  const snap = await fs.getDoc(ref);
  if (!snap.exists()) {
    // bonus faqat admin sozlamalari bazada bo‘lsa beriladi (xavfsizlik qoidasi shuni tekshiradi)
    const st = await fs.getDoc(d("settings", "site")).catch(() => null);
    const bonus = st?.exists() ? Number(st.data().welcomeBonus || 0) : 0;
    const batch = fs.writeBatch(db);
    batch.set(ref, { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL || "", role: "user", bilim: bonus,
      orgId: null, joinCode: null, subUntil: null, blocked: false, createdAt: fs.serverTimestamp(), lastSeen: fs.serverTimestamp(), lastTx: null });
    if (bonus > 0) batch.set(d("ledger", "bonus_" + u.uid), { uid: u.uid, amount: bonus, type: "bonus", note: "welcome", balanceAfter: bonus, at: fs.serverTimestamp() });
    await batch.commit();
  }
}

export const store = {
  mode: "firebase",
  async init(seedData, config) {
    seed = seedData;
    [fa, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const core = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
    app = core.initializeApp(config);
    auth = fa.getAuth(app); db = fs.getFirestore(app);
    if (!sessionStorage.getItem(SID)) sessionStorage.setItem(SID, mkid("s_"));
    try { await fa.getRedirectResult(auth); } catch (e) { console.warn(e); }
    fa.onAuthStateChanged(auth, async (u) => {
      if (unsubMe) { unsubMe(); unsubMe = null; }
      if (!u) { current = null; emit(); return; }
      try { await ensureUser(u); } catch (e) { console.error("ensureUser", e); }
      unsubMe = fs.onSnapshot(d("users", u.uid), (snap) => { current = snap.exists() ? { uid: u.uid, ...plain(snap) } : null; emit(); },
        (e) => { console.error(e); current = null; emit(); });
    });
  },
  onAuth(cb) { listeners.push(cb); },
  async signIn() {
    const p = new fa.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await fa.signInWithPopup(auth, p); }
    catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) return fa.signInWithRedirect(auth, p);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") throw new Error("cancel");
      throw e;
    }
  },
  async signOut() { await fa.signOut(auth); },
  async me() { return current ? { ...current } : null; },
  async updateMe(patch) { const u = needUser(); const p = {}; for (const k of ["name", "lang", "theme"]) if (k in patch) p[k] = patch[k]; await fs.updateDoc(d("users", u.uid), p); },

  // ---- sozlamalar va katalog (baza bo‘sh bo‘lsa seed ko‘rsatiladi) ----
  async getSettings() { const s = await fs.getDoc(d("settings", "site")).catch(() => null); return s?.exists() ? { ...seed.settings, ...plain(s) } : { ...seed.settings }; },
  async saveSettings(patch) { needAdmin(); await fs.setDoc(d("settings", "site"), patch, { merge: true }); },
  async getCategories() { const s = await fs.getDoc(d("settings", "categories")).catch(() => null); return s?.exists() ? plain(s).items || {} : seed.categories; },
  async saveCategories(items) { needAdmin(); await fs.setDoc(d("settings", "categories"), { items }); },
  async listSections() { const l = await all(c("sections")); return (l.length ? l : seed.sections).sort(byOrder); },
  async saveSection(s) { needAdmin(); const id = s.id || mkid("sec-"); await fs.setDoc(d("sections", id), { ...s, id }); return id; },
  async deleteSection(id) { needAdmin(); await fs.deleteDoc(d("sections", id)); },
  async listVideos() {
    const l = await all(c("videos"));
    if (l.length) return l.sort(byOrder);
    return seed.videos.map((v) => ({ ...v, _seed: true })).sort(byOrder);
  },
  async saveVideo(v) {
    needAdmin(); const id = v.id || mkid("v-"); const { sources = {}, _seed, ...meta } = v;
    const b = fs.writeBatch(db);
    b.set(d("videos", id), { ...meta, id, langs: Object.keys(sources) }); b.set(d("sources", id), sources);
    await b.commit(); return id;
  },
  async deleteVideo(id) { needAdmin(); const b = fs.writeBatch(db); b.delete(d("videos", id)); b.delete(d("sources", id)); await b.commit(); },
  async getSources(video) {
    if (video._seed) { // baza hali to‘ldirilmagan: faqat bepul videolar ko‘rsatiladi
      return video.access === "free" || current ? video.sources : null;
    }
    try { const s = await fs.getDoc(d("sources", video.id)); return s.exists() ? plain(s) : null; }
    catch (e) { if (e.code === "permission-denied") return null; throw e; }
  },

  // ---- tariflar va bilim ----
  async listTariffs() { const l = await all(c("tariffs")); return (l.length ? l : seed.tariffs).sort(byOrder); },
  async saveTariff(x) { needAdmin(); const id = x.id || mkid("tr-"); await fs.setDoc(d("tariffs", id), { ...x, id }); return id; },
  async deleteTariff(id) { needAdmin(); await fs.deleteDoc(d("tariffs", id)); },
  async myOwned() {
    if (!current) return {};
    const l = await all(c("users", current.uid, "owned")).catch(() => []);
    return Object.fromEntries(l.map((x) => [x.id, x]));
  },
  async purchaseVideo(vid) {
    const u = needUser();
    await fs.runTransaction(db, async (tx) => {
      const uref = d("users", u.uid), vref = d("videos", vid), oref = d("users", u.uid, "owned", vid);
      const [us, vs, os] = [await tx.get(uref), await tx.get(vref), await tx.get(oref)];
      if (os.exists()) return;
      if (!vs.exists()) throw new Error("404");
      const price = Number(vs.data().price || 0), bal = Number(us.data().bilim || 0);
      if (bal < price) throw new Error(t("err.notEnough"));
      tx.update(uref, { bilim: bal - price, lastTx: { kind: "video", id: vid } });
      tx.set(oref, { at: fs.serverTimestamp(), price });
      tx.set(fs.doc(c("ledger")), { uid: u.uid, amount: -price, type: "purchase", ref: vid, balanceAfter: bal - price, at: fs.serverTimestamp() });
    });
  },
  async buySubscription(tid) {
    const u = needUser();
    await fs.runTransaction(db, async (tx) => {
      const uref = d("users", u.uid), tref = d("tariffs", tid);
      const [us, tsnap] = [await tx.get(uref), await tx.get(tref)];
      const tr = tsnap.data(); if (!tr || tr.type !== "subscription" || tr.active === false) throw new Error("404");
      const bal = Number(us.data().bilim || 0); if (bal < tr.bilim) throw new Error(t("err.notEnough"));
      const base = Math.max(Date.now(), toMs(us.data().subUntil));
      tx.update(uref, { bilim: bal - tr.bilim, subUntil: ts(base + tr.days * 86400000), lastTx: { kind: "sub", id: tid } });
      tx.set(fs.doc(c("ledger")), { uid: u.uid, amount: -tr.bilim, type: "subscription", ref: tid, balanceAfter: bal - tr.bilim, at: fs.serverTimestamp() });
    });
  },
  async requestTopup(tid, note = "") {
    const u = needUser(); const tr = (await this.listTariffs()).find((x) => x.id === tid);
    if (!tr || tr.type !== "package") throw new Error("404");
    await fs.addDoc(c("topups"), { uid: u.uid, name: u.name, email: u.email, tariffId: tid, bilim: Number(tr.bilim) + Number(tr.bonus || 0), priceUZS: Number(tr.priceUZS || 0), note, status: "pending", at: fs.serverTimestamp() });
  },
  async myTopups() { if (!current) return []; const l = await all(fs.query(c("topups"), fs.where("uid", "==", current.uid))); return l.sort((a, b) => b.at - a.at); },
  async listTopups() { needAdmin(); return (await all(c("topups"))).sort((a, b) => b.at - a.at); },
  async resolveTopup(id, approve, note = "") {
    needAdmin();
    await fs.runTransaction(db, async (tx) => {
      const tref = d("topups", id); const tp = await tx.get(tref);
      if (!tp.exists() || tp.data().status !== "pending") return;
      const uref = d("users", tp.data().uid); const us = await tx.get(uref);
      tx.update(tref, { status: approve ? "approved" : "rejected", resolvedAt: fs.serverTimestamp(), by: current.email, adminNote: note });
      if (approve && us.exists()) {
        const nb = Number(us.data().bilim || 0) + Number(tp.data().bilim);
        tx.update(uref, { bilim: nb });
        tx.set(fs.doc(c("ledger")), { uid: tp.data().uid, amount: Number(tp.data().bilim), type: "topup", ref: id, by: current.email, balanceAfter: nb, at: fs.serverTimestamp() });
      }
    });
  },

  // ---- foydalanuvchilar ----
  async listUsers() { needAdmin(); return (await all(c("users"))).map((x) => ({ uid: x.id, ...x })).sort((a, b) => b.createdAt - a.createdAt); },
  async updateUser(id, patch) {
    needAdmin(); const p = {};
    for (const k of ["role", "blocked", "orgId", "name"]) if (k in patch) p[k] = patch[k];
    if ("subUntil" in patch) p.subUntil = ts(patch.subUntil);
    await fs.updateDoc(d("users", id), p);
  },
  async adjustBilim(id, amount, note) {
    needAdmin(); amount = Math.trunc(Number(amount)); if (!amount) return;
    await fs.runTransaction(db, async (tx) => {
      const uref = d("users", id); const us = await tx.get(uref);
      const nb = Math.max(0, Number(us.data().bilim || 0) + amount);
      tx.update(uref, { bilim: nb });
      tx.set(fs.doc(c("ledger")), { uid: id, amount, type: "admin", note: note || "", by: current.email, balanceAfter: nb, at: fs.serverTimestamp() });
    });
  },
  async listLedger(forUid) {
    if (!current) return [];
    if (forUid && forUid !== current.uid) needAdmin();
    if (!forUid && current.role !== "admin") forUid = current.uid;
    const q = forUid ? fs.query(c("ledger"), fs.where("uid", "==", forUid)) : fs.query(c("ledger"), fs.orderBy("at", "desc"), fs.limit(1000));
    return (await all(q)).sort((a, b) => b.at - a.at);
  },
  async userOwned(id) { needAdmin(); const l = await all(c("users", id, "owned")); return Object.fromEntries(l.map((x) => [x.id, x])); },

  // ---- bog‘chalar ----
  async listOrgs() { needAdmin(); return (await all(c("orgs"))).sort((a, b) => (a.name || "").localeCompare(b.name || "")); },
  async getOrg(id) { if (!id) return null; try { const s = await fs.getDoc(d("orgs", id)); return s.exists() ? { id, ...plain(s) } : null; } catch { return null; } },
  async saveOrg(o) {
    needAdmin(); const id = o.id || mkid("org-");
    const old = o.id ? await this.getOrg(o.id) : null;
    const b = fs.writeBatch(db);
    if (old?.joinCode && old.joinCode !== o.joinCode) b.delete(d("joinCodes", old.joinCode));
    if (o.joinCode) b.set(d("joinCodes", o.joinCode), { orgId: id });
    b.set(d("orgs", id), { ...o, id, start: ts(o.start), end: ts(o.end) });
    await b.commit(); return id;
  },
  async deleteOrg(id) { needAdmin(); const o = await this.getOrg(id); const b = fs.writeBatch(db); if (o?.joinCode) b.delete(d("joinCodes", o.joinCode)); b.delete(d("orgs", id)); await b.commit(); },
  async joinOrg(code) {
    const u = needUser(); code = String(code || "").trim().toUpperCase();
    const s = await fs.getDoc(d("joinCodes", code)).catch(() => null);
    if (!s?.exists()) throw new Error(t("err.badCode"));
    await fs.updateDoc(d("users", u.uid), { orgId: s.data().orgId, joinCode: code });
    return this.getOrg(s.data().orgId);
  },
  async leaveOrg() { const u = needUser(); await fs.updateDoc(d("users", u.uid), { orgId: null, joinCode: null }); },
  async orgMembers(oid) { needAdmin(); return (await all(fs.query(c("users"), fs.where("orgId", "==", oid)))).map((x) => ({ uid: x.id, ...x })); },

  // ---- monitoring ----
  async logView(e) { await fs.addDoc(c("views"), { videoId: e.videoId, lang: e.lang || "", sec: Number(e.sec || 0), completed: !!e.completed, device: e.device || "", kind: e.kind || "start", uid: current?.uid || null, at: fs.serverTimestamp() }); },
  async listViews(sinceMs = 0) { needAdmin(); return all(fs.query(c("views"), fs.where("at", ">=", fs.Timestamp.fromMillis(sinceMs)))); },
  async logError(e) { await fs.addDoc(c("errors"), { msg: e.msg || "", where: e.where || "", url: e.url || "", ua: e.ua || "", uid: current?.uid || null, at: fs.serverTimestamp() }); },
  async listErrors() { needAdmin(); return all(fs.query(c("errors"), fs.orderBy("at", "desc"), fs.limit(200))); },
  async clearErrors() { needAdmin(); const l = await all(fs.query(c("errors"), fs.limit(400))); const b = fs.writeBatch(db); l.forEach((x) => b.delete(d("errors", x.id))); await b.commit(); },
  async heartbeat(page) {
    const sid = sessionStorage.getItem(SID);
    await fs.setDoc(d("presence", sid), { at: fs.serverTimestamp(), page: String(page).slice(0, 80), uid: current?.uid || null });
    if (current) await fs.updateDoc(d("users", current.uid), { lastSeen: fs.serverTimestamp() }).catch(() => {});
  },
  async listPresence() { needAdmin(); return all(fs.query(c("presence"), fs.where("at", ">=", fs.Timestamp.fromMillis(Date.now() - 10 * 60000)))); },

  // ---- zaxira va boshlang‘ich ma’lumot ----
  async exportAll() {
    needAdmin(); const out = {};
    for (const k of ["settings", "sections", "videos", "sources", "tariffs", "users", "orgs", "joinCodes", "topups", "ledger"]) out[k] = await all(c(k));
    return out;
  },
  async importSeed(s) {
    needAdmin(); const b = fs.writeBatch(db);
    b.set(d("settings", "site"), s.settings); b.set(d("settings", "categories"), { items: s.categories });
    s.sections.forEach((x) => b.set(d("sections", x.id), x));
    s.tariffs.forEach((x) => b.set(d("tariffs", x.id), x));
    s.videos.forEach((v) => { const { sources = {}, ...meta } = v; b.set(d("videos", v.id), { ...meta, langs: Object.keys(sources) }); b.set(d("sources", v.id), sources); });
    await b.commit();
  },
};
export default store;
