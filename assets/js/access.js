// Kirish huquqini hisoblash: bepul / ro‘yxatdan o‘tganlar uchun / pullik (bilim, obuna, bog‘cha shartnomasi)
import { toMs } from "./util.js";

export function orgCovers(org, video) {
  if (!org || !org.active) return false;
  const now = Date.now();
  if (org.start && toMs(org.start) > now) return false;
  if (org.end && toMs(org.end) < now) return false;
  if (org.allAccess) return true;
  return (org.sections || []).includes(video.sectionId) || (org.videos || []).includes(video.id);
}

export function subActive(user) {
  return !!(user && user.subUntil && toMs(user.subUntil) > Date.now());
}

/** ctx = { user, owned: {videoId: {...}}, org } */
export function accessInfo(video, ctx = {}) {
  const { user, owned = {}, org } = ctx;
  const acc = video.access || "free";
  if (acc === "free") return { ok: true, reason: "free" };
  if (!user) return { ok: false, reason: "needLogin" };
  if (user.blocked) return { ok: false, reason: "blocked" };
  if (user.role === "admin") return { ok: true, reason: "admin" };
  if (acc === "login") return { ok: true, reason: "login" };
  if (owned[video.id]) return { ok: true, reason: "own" };
  if (orgCovers(org, video)) return { ok: true, reason: "org" };
  if (subActive(user) && video.inSubscription !== false) return { ok: true, reason: "sub" };
  return { ok: false, reason: "needBuy", price: Number(video.price || 0) };
}
