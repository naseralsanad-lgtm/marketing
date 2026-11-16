export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
export const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function compact(n: number | undefined | null, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(digits).replace(/\.0$/, "") + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(digits).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : digits).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}
export const num = (n: number | undefined | null) => (n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));
export const money = (n: number | undefined | null, cur = "AED") => (n == null || !isFinite(n) ? "—" : `${cur} ${Math.round(n).toLocaleString("en-US")}`);
export const moneyCompact = (n: number, cur = "AED") => `${cur} ${compact(n)}`;
export const pct = (n: number | undefined | null, digits = 1) => (n == null || !isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`);

// ---- dates (all campaign dates are plain YYYY-MM-DD strings in the campaign timezone) ----
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s: string, n: number) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
export const todayISO = () => toISO(new Date());
export function fmtDate(s?: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }, locale = "en-GB") {
  if (!s) return "—";
  return parseISO(s.slice(0, 10)).toLocaleDateString(locale, opts);
}
export const fmtShort = (s?: string, locale = "en-GB") => fmtDate(s, { day: "numeric", month: "short" }, locale);
export function dateRange(a: string, b: string): string[] {
  const out: string[] = [];
  if (!a || !b) return out;
  for (let d = a, i = 0; d <= b && i < 800; d = addDays(d, 1), i++) out.push(d);
  return out;
}
export const startOfWeek = (s: string) => { const d = parseISO(s); return addDays(s, -((d.getDay() + 6) % 7)); };

/** Small deterministic PRNG so generated demo data and creative variants are stable. */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function download(filename: string, data: Blob | string, mime = "text/plain;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCSV(rows: (string | number | undefined | null)[][]): string {
  return "﻿" + rows.map((r) => r.map((c) => {
    const s = c == null ? "" : String(c);
    // neutralise spreadsheet formula injection from user/remote content
    const safe = /^[=+\-@]/.test(s) && isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }).join(",")).join("\n");
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
