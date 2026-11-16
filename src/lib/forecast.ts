import type { Assignment, Brief, ContentFormat, Influencer, Platform, Weighted } from "./types";
import { tierOf } from "./constants";
import { segmentShare } from "./scoring";
import { sum } from "./utils";

/**
 * Campaign impact forecast.
 *
 * METHOD (shown to the user in the Forecast tab):
 *  - Per deliverable reach = average views (when the data source provides them and the format is video)
 *    or followers × a format reach-rate × a tier factor (larger accounts reach a smaller share of followers).
 *  - Per influencer unique reach = largest single deliverable + 35% of the remaining deliverables' reach
 *    (repeat exposure), capped at 90% of followers.
 *  - Campaign unique reach de-duplicates across influencers: within each (platform, top audience country)
 *    group, the k-th largest influencer contributes reach × (1 − overlap)^k. No measured overlap data is
 *    used, so this is an assumption (8% / 15% / 25% for optimistic / expected / conservative).
 *  - Impressions = Σ deliverable reach × frequency (1.15). Engagements = followers × ER × format factor.
 *  - Conservative = 65% and Optimistic = 135% of expected delivery.
 * Combined followers are reported separately and are never treated as reach.
 */
export type ScenarioKey = "conservative" | "expected" | "optimistic";
export const SCENARIO_FACTORS: Record<ScenarioKey, { delivery: number; overlap: number }> = {
  conservative: { delivery: 0.65, overlap: 0.25 },
  expected: { delivery: 1, overlap: 0.15 },
  optimistic: { delivery: 1.35, overlap: 0.08 },
};

const FORMAT_REACH: Record<ContentFormat, { rate: number; eng: number; video: boolean; usesViews: boolean }> = {
  reel: { rate: 0.22, eng: 1, video: true, usesViews: true },
  educational: { rate: 0.18, eng: 0.9, video: true, usesViews: true },
  product_demo: { rate: 0.18, eng: 0.85, video: true, usesViews: true },
  pre_event_promo: { rate: 0.18, eng: 0.8, video: true, usesViews: true },
  post_event_highlights: { rate: 0.2, eng: 0.9, video: true, usesViews: true },
  story_coverage: { rate: 0.07, eng: 0.12, video: false, usesViews: false },
  event_attendance: { rate: 0.06, eng: 0.1, video: false, usesViews: false },
  live: { rate: 0.04, eng: 0.3, video: true, usesViews: false },
  interview: { rate: 0.1, eng: 0.4, video: true, usesViews: false },
  podcast: { rate: 0.08, eng: 0.3, video: true, usesViews: false },
  panel: { rate: 0.04, eng: 0.1, video: false, usesViews: false },
  stage_speaker: { rate: 0.04, eng: 0.1, video: false, usesViews: false },
};
const TIER_FACTOR = { nano: 1.3, micro: 1.15, mid: 1, macro: 0.9, mega: 0.8, celebrity: 0.7 };
const ER_FALLBACK = { nano: 0.06, micro: 0.04, mid: 0.03, macro: 0.025, mega: 0.02, celebrity: 0.015 };

export interface InfluencerForecast {
  influencerId: string; reach: number; impressions: number; views: number; engagements: number;
  deliverables: number; basis: "views" | "followers"; assumedEngagement: boolean;
}
export interface Forecast {
  followers: number;
  reach: number; impressions: number; views: number; engagements: number; deliverables: number;
  byInfluencer: InfluencerForecast[];
  cpm?: number; cpe?: number;
}
export interface Distribution { countries: Weighted[]; ages: Weighted[]; genders: Weighted[]; languages: Weighted[]; platforms: Weighted[]; tiers: Weighted[]; dataShare: number }
export interface SegmentCoverage { segmentId: string; name: string; reach: number; share: number; target: number; gap: number; influencers: number; status: "ok" | "under" | "over" | "unknown" }

export function forecastInfluencer(inf: Influencer, a: Assignment): InfluencerForecast {
  const tier = tierOf(inf.followers);
  const er = inf.engagementRate ?? ER_FALLBACK[tier];
  const reaches: number[] = []; let impressions = 0, views = 0, engagements = 0, count = 0, usedViews = false;
  for (const d of a.deliverables) {
    const f = FORMAT_REACH[d.format];
    const byViews = f.usesViews && inf.avgViews != null;
    const one = byViews ? inf.avgViews! : inf.followers * f.rate * TIER_FACTOR[tier];
    if (byViews) usedViews = true;
    for (let i = 0; i < d.count; i++) {
      const r = one * Math.pow(0.9, i); // diminishing returns for repeated deliverables
      reaches.push(r); impressions += r * 1.15; if (f.video) views += r; engagements += inf.followers * er * f.eng * Math.pow(0.92, i);
    }
    count += d.count;
  }
  reaches.sort((x, y) => y - x);
  const reach = reaches.length ? Math.min(inf.followers * 0.9 || reaches[0], reaches[0] + 0.35 * sum(reaches.slice(1))) : 0;
  return { influencerId: inf.id, reach, impressions, views, engagements, deliverables: count, basis: usedViews ? "views" : "followers", assumedEngagement: inf.engagementRate == null };
}

export function forecastCampaign(assignments: Assignment[], lib: Record<string, Influencer>, scenario: ScenarioKey, spend?: number): Forecast {
  const f = SCENARIO_FACTORS[scenario];
  const per = assignments.map((a) => ({ a, inf: lib[a.influencerId] })).filter((x) => x.inf).map(({ a, inf }) => {
    const r = forecastInfluencer(inf, a);
    return { ...r, reach: r.reach * f.delivery, impressions: r.impressions * f.delivery, views: r.views * f.delivery, engagements: r.engagements * f.delivery };
  });
  const groups: Record<string, number[]> = {};
  for (const p of per) {
    const inf = lib[p.influencerId];
    const top = [...(inf.audience?.countries ?? [])].sort((x, y) => y.weight - x.weight)[0]?.name ?? inf.country ?? "?";
    (groups[`${inf.platform}|${top}`] ??= []).push(p.reach);
  }
  const reach = sum(Object.values(groups).map((g) => sum(g.sort((x, y) => y - x).map((r, k) => r * Math.pow(1 - f.overlap, k)))));
  const impressions = sum(per.map((p) => p.impressions)), engagements = sum(per.map((p) => p.engagements));
  return {
    followers: sum(assignments.map((a) => lib[a.influencerId]?.followers ?? 0)),
    reach, impressions, views: sum(per.map((p) => p.views)), engagements, deliverables: sum(per.map((p) => p.deliverables)), byInfluencer: per,
    cpm: spend && impressions ? (spend / impressions) * 1000 : undefined,
    cpe: spend && engagements ? spend / engagements : undefined,
  };
}

function blend(items: { w: number; list?: Weighted[] }[]): Weighted[] {
  const acc: Record<string, number> = {}; let total = 0;
  for (const it of items) { if (!it.list?.length) continue; total += it.w; for (const x of it.list) acc[x.name] = (acc[x.name] ?? 0) + x.weight * it.w; }
  if (!total) return [];
  const out = Object.entries(acc).map(([name, v]) => ({ name, weight: v / total })).sort((a, b) => b.weight - a.weight);
  const top = out.slice(0, 6); const rest = 1 - sum(top.map((x) => x.weight));
  return rest > 0.02 ? [...top, { name: "Other", weight: rest }] : top;
}

/** Reach-weighted audience distribution of the selected influencers (only from profiles that have data). */
export function distribution(fc: Forecast, lib: Record<string, Influencer>): Distribution {
  const rows = fc.byInfluencer.map((p) => ({ w: p.reach, inf: lib[p.influencerId] }));
  const total = sum(rows.map((r) => r.w)) || 1;
  const count = (key: (i: Influencer) => string) => {
    const acc: Record<string, number> = {};
    for (const r of rows) acc[key(r.inf)] = (acc[key(r.inf)] ?? 0) + r.w;
    return Object.entries(acc).map(([name, v]) => ({ name, weight: v / total })).sort((a, b) => b.weight - a.weight);
  };
  return {
    countries: blend(rows.map((r) => ({ w: r.w, list: r.inf.audience?.countries }))),
    ages: blend(rows.map((r) => ({ w: r.w, list: r.inf.audience?.ages }))).filter((x) => x.name !== "Other").sort((a, b) => a.name.localeCompare(b.name)),
    genders: blend(rows.map((r) => ({ w: r.w, list: r.inf.audience?.genders }))),
    languages: blend(rows.map((r) => ({ w: r.w, list: r.inf.audience?.languages }))),
    platforms: count((i) => i.platform), tiers: count((i) => tierOf(i.followers)),
    dataShare: sum(rows.filter((r) => r.inf.audience?.countries?.length).map((r) => r.w)) / total,
  };
}

/** How estimated reach splits across the brief's audience segments versus the desired coverage. */
export function segmentCoverage(brief: Brief, fc: Forecast, lib: Record<string, Influencer>): SegmentCoverage[] {
  const raw = brief.segments.map((s) => {
    let reach = 0, n = 0, known = false;
    for (const p of fc.byInfluencer) {
      const sh = segmentShare(lib[p.influencerId], s);
      if (sh == null) continue; known = true; reach += p.reach * sh; if (sh >= 0.25) n++;
    }
    return { s, reach, n, known };
  });
  const total = sum(raw.map((r) => r.reach)) || 1;
  const tsum = sum(brief.segments.map((s) => s.coverageTarget)) || 100;
  return raw.map(({ s, reach, n, known }) => {
    const share = reach / total, target = s.coverageTarget / tsum, gap = share - target;
    return { segmentId: s.id, name: s.name, reach, share, target, gap, influencers: n, status: !known ? "unknown" : gap < -0.07 ? "under" : gap > 0.12 ? "over" : "ok" };
  });
}

export const platformsUsed = (assignments: Assignment[]): Platform[] => [...new Set(assignments.flatMap((a) => a.deliverables.map((d) => d.platform)))];
