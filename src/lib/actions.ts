"use client";
import type { Influencer, Platform } from "./types";
import { useStore } from "./store";
import { estimateFee } from "./scoring";
import { draftAssignment } from "./scenarios";
import { parseCSV, uid } from "./utils";

/** Campaign mutations shared across the Build screens. Every one is a single undoable step. */
export function buildActions(id: string) {
  const { update, library } = useStore.getState();
  const lib = () => useStore.getState().library;
  return {
    select: (infId: string, manual = true) => update(id, (c) => {
      const inf = lib()[infId]; if (!inf || c.assignments.some((a) => a.influencerId === infId)) return;
      c.assignments.push(draftAssignment(inf, c.brief, estimateFee(inf), manual));
      if (!c.candidates.includes(infId)) c.candidates.push(infId);
      c.rejected = c.rejected.filter((x) => x !== infId);
    }),
    remove: (infId: string) => update(id, (c) => { c.assignments = c.assignments.filter((a) => a.influencerId !== infId); c.events = c.events.filter((e) => e.influencerId !== infId); }),
    reject: (infId: string) => update(id, (c) => { if (!c.rejected.includes(infId)) c.rejected.push(infId); }),
    unreject: (infId: string) => update(id, (c) => { c.rejected = c.rejected.filter((x) => x !== infId); }),
    favourite: (infId: string) => update(id, (c) => { c.favourites = c.favourites.includes(infId) ? c.favourites.filter((x) => x !== infId) : [...c.favourites, infId]; }),
    patch: (infId: string, fn: (a: import("./types").Assignment) => void, label?: string) => update(id, (c) => { const a = c.assignments.find((x) => x.influencerId === infId); if (a) fn(a); }, label),
    addCandidates: (ids: string[]) => update(id, (c) => { for (const i of ids) if (!c.candidates.includes(i)) c.candidates.push(i); }),
    library,
  };
}

export function parseProfileUrl(raw: string): { platform?: Platform; handle?: string } {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`); const host = u.hostname.replace(/^www\.|^m\./, ""); const seg = u.pathname.split("/").filter(Boolean);
    const map: [RegExp, Platform][] = [[/instagram\.com$/, "instagram"], [/tiktok\.com$/, "tiktok"], [/youtube\.com$|youtu\.be$/, "youtube"], [/snapchat\.com$/, "snapchat"], [/facebook\.com$|fb\.com$/, "facebook"], [/^x\.com$|twitter\.com$/, "x"], [/linkedin\.com$/, "linkedin"]];
    const platform = map.find(([re]) => re.test(host))?.[1]; if (!platform) return {};
    let handle = seg[0] ?? "";
    if (platform === "snapchat" && seg[0] === "add") handle = seg[1] ?? "";
    if (platform === "linkedin" && (seg[0] === "in" || seg[0] === "company")) handle = seg[1] ?? "";
    if (platform === "youtube" && ["c", "channel", "user"].includes(seg[0])) handle = seg[1] ?? "";
    return { platform, handle: handle.replace(/^@/, "") };
  } catch { return {}; }
}

export function manualInfluencer(p: Partial<Influencer> & { name: string; handle: string; platform: Platform }, source: "manual" | "csv" = "manual"): Influencer {
  const now = new Date().toISOString();
  return { id: uid(source === "csv" ? "csv" : "man"), followers: 0, languages: [], categories: [], feeHistory: [], source, fetchedAt: now, addedAt: now, ...p };
}

export const CSV_TEMPLATE = "name,handle,platform,followers,engagement_rate,avg_views,country,city,languages,categories,fee,email,profile_url\nExample Creator,example.handle,instagram,125000,3.4,28000,United Arab Emirates,Dubai,Arabic;English,Lifestyle;Family,18000,agent@example.com,https://www.instagram.com/example.handle\n";

export function influencersFromCSV(text: string): { list: Influencer[]; errors: string[] } {
  const rows = parseCSV(text); const errors: string[] = []; const list: Influencer[] = [];
  if (rows.length < 2) return { list, errors: ["The file has no data rows."] };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (r: string[], ...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0 && r[i]?.trim()) return r[i].trim(); } return ""; };
  const n = (s: string) => { const v = Number(s.replace(/[, %]/g, "").replace(/k$/i, "e3").replace(/m$/i, "e6")); return isFinite(v) && s ? v : undefined; };
  const platforms = ["instagram", "tiktok", "youtube", "snapchat", "facebook", "x", "linkedin"];
  rows.slice(1, 1001).forEach((r, i) => {
    const url = col(r, "profile_url", "url", "link"); const fromUrl = url ? parseProfileUrl(url) : {};
    const handle = (col(r, "handle", "username") || fromUrl.handle || "").replace(/^@/, ""); const name = col(r, "name", "full_name", "fullname") || handle;
    let platform = (col(r, "platform", "network") || fromUrl.platform || "").toLowerCase(); if (platform === "twitter") platform = "x";
    if (!handle || !platforms.includes(platform)) { errors.push(`Row ${i + 2}: needs a handle and a valid platform.`); return; }
    const er = n(col(r, "engagement_rate", "er", "engagement")); const fee = n(col(r, "fee", "rate", "quote"));
    const split = (s: string) => s.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
    list.push(manualInfluencer({
      name, handle, platform: platform as Platform, profileUrl: url || undefined, followers: n(col(r, "followers", "follower_count")) ?? 0,
      engagementRate: er == null ? undefined : er > 1 ? er / 100 : er, avgViews: n(col(r, "avg_views", "average_views", "views")),
      country: col(r, "country") || undefined, city: col(r, "city") || undefined, languages: split(col(r, "languages", "language")), categories: split(col(r, "categories", "category")),
      contact: col(r, "email") ? { email: col(r, "email") } : undefined,
      feeHistory: fee ? [{ date: new Date().toISOString().slice(0, 10), amount: fee, currency: col(r, "currency") || "AED", status: "quoted", note: "Imported from CSV" }] : [],
    }, "csv"));
  });
  return { list, errors };
}
