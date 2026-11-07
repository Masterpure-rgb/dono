// Umumiy yordamchi funksiyalar
import { t, getLang } from "./i18n.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Ko‘p tilli maydondan joriy tildagi qiymatni olish ({uz, ru, en})
export function L(obj, lang = getLang()) {
  if (obj == null) return "";
  if (typeof obj === "string" || Array.isArray(obj)) return obj;
  return obj[lang] ?? obj.uz ?? obj.ru ?? obj.en ?? "";
}

export function uid(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function toMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const n = Date.parse(v); return isNaN(n) ? 0 : n;
}

export function fmtDate(v, withTime = false) {
  const ms = toMs(v); if (!ms) return "—";
  const d = new Date(ms);
  const loc = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" }[getLang()] || "uz-UZ";
  try {
    return d.toLocaleDateString(loc, { year: "numeric", month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
  } catch { return d.toISOString().slice(0, withTime ? 16 : 10).replace("T", " "); }
}

export function ago(v) {
  const ms = toMs(v); if (!ms) return "—";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return t("time.now");
  if (s < 3600) return t("time.min", { n: Math.floor(s / 60) });
  if (s < 86400) return t("time.hour", { n: Math.floor(s / 3600) });
  return t("time.day", { n: Math.floor(s / 86400) });
}

export function money(n) {
  return Number(n || 0).toLocaleString("ru-RU").replace(/,/g, " ");
}

export function toast(msg, err = false) {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.append(box); }
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : ""); el.textContent = msg;
  box.append(el); setTimeout(() => el.remove(), 3200);
}

// Modal oyna: html — ichki tarkib, onMount(el, close)
export function modal(html, { small = false, onMount } = {}) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal ${small ? "sm" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(bg);
  bg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  onMount?.(bg.querySelector(".modal"), close);
  const first = bg.querySelector("input, select, textarea, button.btn-primary");
  first?.focus();
  return close;
}

export function confirmBox(text) {
  return new Promise((res) => {
    modal(`<h3>${esc(text)}</h3><div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="cf-ok">${t("common.ok")}</button></div>`,
      { small: true, onMount: (m, close) => { m.querySelector("#cf-ok").onclick = () => { close(); res(true); }; m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => res(false))); } });
  });
}

// Ota-ona darvozasi: bolalar tasodifan xarid qilmasligi uchun oddiy hisob
export function parentGate(enabled = true) {
  if (!enabled) return Promise.resolve(true);
  const a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 6);
  return new Promise((res) => {
    let ok = false;
    modal(`<h3>${t("gate.title")}</h3><p class="muted">${t("gate.text")}</p>
      <label class="f">${a} × ${b} = ?</label><input class="input" id="pg-in" inputmode="numeric" autocomplete="off">
      <p class="small" id="pg-err" style="color:var(--danger);min-height:1.4em"></p>
      <div class="modal-foot"><button class="btn btn-ghost" data-close>${t("common.cancel")}</button><button class="btn btn-primary" id="pg-ok">${t("common.continue")}</button></div>`,
      { small: true, onMount: (m, close) => {
        const go = () => { if (Number(m.querySelector("#pg-in").value) === a * b) { ok = true; close(); res(true); } else m.querySelector("#pg-err").textContent = t("gate.wrong"); };
        m.querySelector("#pg-ok").onclick = go;
        m.querySelector("#pg-in").onkeydown = (e) => { if (e.key === "Enter") go(); };
        m.querySelectorAll("[data-close]").forEach((x) => x.addEventListener("click", () => { if (!ok) res(false); }));
      } });
  });
}

export function deviceType() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

export function downloadCSV(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const ICON = {
  lock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
  google: '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  logo: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6.5" fill="#FBF7EE"/><path d="M12 5.5 13.6 9.9 18 12l-4.4 2.1L12 18.5l-1.6-4.4L6 12l4.4-2.1Z" fill="#E9A23B"/></svg>',
};
