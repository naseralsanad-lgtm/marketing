import "server-only";
import type { Influencer, Platform, Weighted } from "@/lib/types";

/**
 * Server-side Modash Discovery API client.
 *
 * - The API key is read from MODASH_API_KEY and never leaves the server.
 * - Supported networks: Instagram, TikTok and YouTube (Modash Discovery does not cover Snapchat,
 *   Facebook, X or LinkedIn — those creators are added manually or by CSV).
 * - Responses are cached in memory (search 1h, reports 24h, dictionaries 7d) because reports cost credits.
 * - Outbound calls are throttled to MODASH_RPS (default 2/s) and 429s are retried once after Retry-After.
 * - Field mapping is defensive: any metric Modash does not return for your plan stays `undefined` and the
 *   scoring engine flags it as missing rather than assuming a value.
 */
const BASE = (process.env.MODASH_BASE_URL || "https://api.modash.io/v1").replace(/\/$/, "");
export const MODASH_PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube"];
export const modashConfigured = () => !!process.env.MODASH_API_KEY;

export class ModashError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

const cache = new Map<string, { at: number; ttl: number; data: unknown }>();
let queue: Promise<unknown> = Promise.resolve(); let last = 0;
const gap = () => 1000 / Math.max(0.2, Number(process.env.MODASH_RPS) || 2);
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => { const wait = last + gap() - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); return fn(); });
  queue = run.catch(() => undefined);
  return run;
}

async function call<T>(path: string, init: { method?: string; body?: unknown; ttl: number }, retry = true): Promise<T> {
  const key = `${init.method ?? "GET"} ${path} ${init.body ? JSON.stringify(init.body) : ""}`;
  const hit = cache.get(key); if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T;
  if (!modashConfigured()) throw new ModashError("Modash API key is not configured.", 503, "not_configured");
  const res = await throttle(() => fetch(`${BASE}${path}`, {
    method: init.method ?? "GET", body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(25_000),
    headers: { Authorization: `Bearer ${process.env.MODASH_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
  })).catch((e) => { throw new ModashError(`Could not reach Modash (${e?.name === "TimeoutError" ? "timed out" : "network error"}).`, 502, "network"); });
  if (res.status === 429 && retry) { await new Promise((r) => setTimeout(r, Math.min(5000, (Number(res.headers.get("retry-after")) || 1) * 1000))); return call(path, init, false); }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error === true) {
    const msg = typeof json.message === "string" ? json.message : `Modash returned HTTP ${res.status}`;
    const friendly = res.status === 401 || res.status === 403 ? "Modash rejected the API key (check MODASH_API_KEY and your plan’s access)."
      : res.status === 429 ? "Modash rate limit reached. Please retry shortly." : res.status === 402 ? "Modash credits are exhausted for this billing period." : msg;
    throw new ModashError(friendly, res.status >= 400 ? res.status : 502, typeof json.code === "string" ? json.code : undefined);
  }
  cache.set(key, { at: Date.now(), ttl: init.ttl, data: json });
  if (cache.size > 800) cache.delete(cache.keys().next().value!);
  return json as T;
}

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : undefined);
const weighted = (list: unknown): Weighted[] | undefined => Array.isArray(list) && list.length
  ? list.filter((x: Any) => typeof x?.weight === "number").map((x: Any) => ({ name: String(x.name ?? x.code ?? "?"), code: x.code ? String(x.code) : undefined, weight: x.weight as number })) : undefined;

const profileUrl = (platform: Platform, p: Any) => p.url || (platform === "instagram" ? `https://www.instagram.com/${p.username}` : platform === "tiktok" ? `https://www.tiktok.com/@${p.username}` : p.handle ? `https://www.youtube.com/@${p.handle}` : undefined);

function fromSearchItem(platform: Platform, item: Any): Influencer {
  const p = item.profile ?? item; const now = new Date().toISOString();
  return {
    id: `modash_${platform}_${item.userId ?? p.userId}`, modashUserId: String(item.userId ?? p.userId), platform,
    name: p.fullname || p.username || p.handle || "Unknown", handle: p.username || p.handle || String(item.userId), profileUrl: profileUrl(platform, p), avatarUrl: p.picture,
    followers: n(p.followers) ?? 0, engagementRate: n(p.engagementRate), avgViews: n(p.averageViews), avgLikes: n(p.engagements),
    languages: [], categories: [], source: "modash", fetchedAt: now, feeHistory: [], addedAt: now,
  };
}

function fromReport(platform: Platform, report: Any): Influencer {
  const r = report.profile ?? report; const base = fromSearchItem(platform, { userId: r.userId, profile: r.profile ?? r });
  const a = r.audience ?? {};
  const paid = n(r.paidPostPerformance);
  return {
    ...base,
    avgViews: n(r.avgReelsPlays) ?? n(r.avgViews) ?? base.avgViews, avgLikes: n(r.avgLikes) ?? base.avgLikes, avgComments: n(r.avgComments),
    country: r.country, city: r.city, bio: r.bio ?? r.description,
    languages: r.language?.name ? [r.language.name] : [],
    categories: Array.isArray(r.interests) ? r.interests.map((x: Any) => String(x.name)).slice(0, 6) : [],
    audience: {
      countries: weighted(a.geoCountries), cities: weighted(a.geoCities), ages: weighted(a.ages)?.map((x) => ({ ...x, name: x.code ?? x.name })),
      genders: weighted(a.genders)?.map((x) => ({ ...x, name: (x.code ?? x.name).toLowerCase() === "female" ? "Female" : (x.code ?? x.name).toLowerCase() === "male" ? "Male" : x.name })),
      languages: weighted(a.languages), interests: weighted(a.interests), credibility: n(a.credibility),
      // NOTE: Modash can return audience "ethnicities"; this application deliberately does not ingest it.
    },
    growth: Array.isArray(r.statHistory) ? r.statHistory.filter((x: Any) => x.month && n(x.followers)).map((x: Any) => ({ month: String(x.month), followers: x.followers })).slice(-12) : undefined,
    sponsoredPerformance: paid,
    recentPosts: Array.isArray(r.recentPosts) ? r.recentPosts.slice(0, 6).map((x: Any) => ({ url: x.url, caption: String(x.text ?? x.title ?? "").slice(0, 280), likes: n(x.likes), views: n(x.views) ?? n(x.plays), date: x.created, type: x.type })) : undefined,
    contact: Array.isArray(r.contacts) && r.contacts.length ? { email: r.contacts.find((c: Any) => c.type === "email")?.value } : undefined,
  };
}

export interface SearchInput {
  platform: Platform; page?: number;
  minFollowers?: number; maxFollowers?: number; minEngagement?: number;
  keywords?: string; languageCode?: string; countries?: string[]; audienceCountries?: string[]; audienceLanguageCode?: string;
  minCredibility?: number;
}

async function locationIds(platform: Platform, names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names.slice(0, 4)) {
    try {
      const d = await call<Any>(`/${platform}/locations?query=${encodeURIComponent(name)}&limit=5`, { ttl: 7 * 864e5 });
      const hit = (d.locations ?? []).find((l: Any) => String(l.name).toLowerCase() === name.toLowerCase()) ?? d.locations?.[0];
      if (hit?.id != null) ids.push(hit.id);
    } catch { /* dictionary lookups are best-effort */ }
  }
  return ids;
}

export async function searchInfluencers(input: SearchInput): Promise<{ influencers: Influencer[]; total?: number; exact?: boolean }> {
  if (!MODASH_PLATFORMS.includes(input.platform)) throw new ModashError(`Modash Discovery does not cover ${input.platform}. Add these creators manually or by CSV.`, 400, "unsupported_platform");
  const influencer: Any = {}; const audience: Any = {};
  if (input.minFollowers || input.maxFollowers) influencer.followers = { ...(input.minFollowers ? { min: input.minFollowers } : {}), ...(input.maxFollowers ? { max: input.maxFollowers } : {}) };
  if (input.minEngagement) influencer.engagementRate = input.minEngagement;
  if (input.keywords) influencer.keywords = input.keywords;
  if (input.languageCode) influencer.language = input.languageCode;
  if (input.countries?.length) { const ids = await locationIds(input.platform, input.countries); if (ids.length) influencer.location = ids; }
  if (input.audienceCountries?.length) { const ids = await locationIds(input.platform, input.audienceCountries); if (ids.length) audience.location = ids.map((id) => ({ id, weight: 0.2 })); }
  if (input.audienceLanguageCode) audience.language = { id: input.audienceLanguageCode, weight: 0.2 };
  if (input.minCredibility && input.platform === "instagram") audience.credibility = input.minCredibility;
  const body = { page: input.page ?? 0, sort: { field: "followers", direction: "desc" }, filter: { influencer, audience } };
  const d = await call<Any>(`/${input.platform}/search`, { method: "POST", body, ttl: 36e5 });
  const items = [...(d.directs ?? []), ...(d.lookalikes ?? [])];
  return { influencers: items.map((x: Any) => fromSearchItem(input.platform, x)), total: n(d.total), exact: d.isExactMatch };
}

/** Full profile report (uses Modash credits). `id` is a Modash userId or a username. */
export async function getReport(platform: Platform, id: string): Promise<Influencer> {
  if (!MODASH_PLATFORMS.includes(platform)) throw new ModashError(`Modash Discovery does not cover ${platform}.`, 400, "unsupported_platform");
  const d = await call<Any>(`/${platform}/profile/${encodeURIComponent(id.replace(/^@/, ""))}/report`, { ttl: 864e5 });
  return fromReport(platform, d);
}

export async function dictionary(platform: Platform, kind: "locations" | "languages" | "interests" | "brands", query = ""): Promise<unknown> {
  return call(`/${platform}/${kind}?query=${encodeURIComponent(query)}&limit=20`, { ttl: 7 * 864e5 });
}

export async function accountInfo(): Promise<{ credits?: number; plan?: string } | null> {
  if (!modashConfigured()) return null;
  try { const d = await call<Any>("/user/info", { ttl: 6e4 }); return { credits: n(d.billing?.credits), plan: d.billing?.name ?? d.plan }; } catch { return null; }
}
