import type { AudienceSegment, Brief, Influencer, Weights, Weighted } from "./types";
import { COUNTRIES, LANGUAGE_CODES, tierOf } from "./constants";
import { clamp } from "./utils";

/**
 * Campaign Match Score — explainable, weight-driven and tolerant of missing data.
 * Each criterion returns 0..100 plus an explanation; a criterion with no supporting data
 * returns a neutral 50 and is flagged so the user can see what the score is (not) based on.
 * Only audience attributes backed by analytics data are used. Communities are matched through
 * audience language and geography — never inferred from an influencer's own profile.
 */
export interface Criterion { key: keyof Weights; score: number; note: string; missing?: boolean }
export interface SegmentFit { segmentId: string; name: string; fit: number; share: number }
export interface ScoreResult {
  total: number;
  criteria: Criterion[];
  segments: SegmentFit[];
  bestSegment?: SegmentFit;
  reasons: string[];
  concerns: string[];
  missing: string[];
  /** 0..1 share of criteria weight backed by real data */
  confidence: number;
  estFee: number;
  historyNote?: string;
}

const share = (list: Weighted[] | undefined, names: string[], codes: string[] = []) => {
  if (!list?.length) return undefined;
  const n = names.map((x) => x.toLowerCase());
  const c = codes.map((x) => x.toLowerCase());
  return list.filter((w) => n.includes(w.name.toLowerCase()) || (w.code && c.includes(w.code.toLowerCase()))).reduce((s, w) => s + w.weight, 0);
};

const AGE_BUCKETS: Record<string, string[]> = {
  "13-17": ["13-17"], "18-24": ["18-24"], "25-34": ["25-34"], "35-44": ["35-44"], "45-64": ["45-64"], "65+": ["65+", "65-"],
};

/** Share of an influencer's audience estimated to belong to a segment (0..1), or undefined without data. */
export function segmentShare(inf: Influencer, seg: AudienceSegment): number | undefined {
  const a = inf.audience;
  if (!a) return undefined;
  const parts: number[] = [];
  if (seg.countries.length) { const s = share(a.countries, seg.countries, seg.countries.map((c) => COUNTRIES[c] ?? c)); if (s != null) parts.push(s); }
  if (seg.languages.length) { const s = share(a.languages, seg.languages, seg.languages.map((l) => LANGUAGE_CODES[l] ?? l)); if (s != null) parts.push(s); }
  if (seg.ageGroups.length && seg.ageGroups.length < 6) { const s = share(a.ages, seg.ageGroups.flatMap((g) => AGE_BUCKETS[g] ?? [g])); if (s != null) parts.push(Math.min(1, s * 1.15)); }
  if (seg.gender !== "all") { const s = share(a.genders, [seg.gender], [seg.gender.toUpperCase()]); if (s != null) parts.push(Math.min(1, s * 1.3)); }
  if (!parts.length) return undefined;
  // Attributes are treated as roughly independent filters; a geometric blend avoids over-penalising.
  const product = parts.reduce((x, y) => x * y, 1);
  return Math.pow(product, 1 / Math.max(1, parts.length - 0.5 * (parts.length - 1)));
}

export function estimateFee(inf: Influencer): number {
  const confirmed = [...inf.feeHistory].reverse().find((f) => f.status === "confirmed") ?? [...inf.feeHistory].reverse()[0];
  if (confirmed) return confirmed.amount;
  const pf: Record<string, number> = { youtube: 1.35, instagram: 1, tiktok: 0.85, snapchat: 0.9, facebook: 0.7, x: 0.6, linkedin: 0.8 };
  const base = 12 * Math.pow(Math.max(inf.followers, 500), 0.62) * (pf[inf.platform] ?? 1);
  const erBoost = inf.engagementRate ? clamp(0.85 + inf.engagementRate * 4, 0.85, 1.25) : 1;
  return Math.max(500, Math.round((base * erBoost) / 100) * 100);
}

const ER_BENCH: Record<string, number> = { nano: 0.08, micro: 0.055, mid: 0.04, macro: 0.032, mega: 0.026, celebrity: 0.02 };
const TYPE_KEYWORDS: Record<string, string[]> = {
  "Government initiative": ["Government & civic", "Education", "Technology", "News & media"],
  "Event coverage": ["Lifestyle", "Technology", "Culture & heritage"],
  "Educational campaign": ["Education", "Parenting", "Youth"],
  "Product or service launch": ["Technology", "Lifestyle", "Business"],
  "Behavioural change campaign": ["Education", "Family", "Fitness", "Youth"],
  "Awareness campaign": ["Lifestyle", "News & media", "Family"],
  "Brand awareness": ["Lifestyle", "Fashion", "Travel"],
};

export interface HistoryStat { campaigns: number; ratio: number }

export function scoreInfluencer(inf: Influencer, brief: Brief, weights: Weights, ctx: { medianCpm?: number; history?: HistoryStat } = {}): ScoreResult {
  const crit: Criterion[] = [];
  const reasons: string[] = []; const concerns: string[] = []; const missing: string[] = [];

  // 1. audience alignment
  const segs: SegmentFit[] = brief.segments.map((s) => {
    const sh = segmentShare(inf, s);
    return { segmentId: s.id, name: s.name, share: sh ?? 0, fit: sh == null ? 50 : clamp(Math.round(Math.pow(sh, 0.6) * 118)) };
  });
  const hasAud = !!inf.audience && (inf.audience.countries?.length || inf.audience.languages?.length);
  let best: SegmentFit | undefined;
  if (!brief.segments.length) crit.push({ key: "audience", score: 50, note: "No audience segments defined in the brief yet.", missing: true });
  else if (!hasAud) { crit.push({ key: "audience", score: 50, note: "No audience analytics available — alignment cannot be verified.", missing: true }); missing.push("Audience demographics"); }
  else {
    const pw = (s: AudienceSegment) => 6 - clamp(s.priority, 1, 5);
    const wsum = brief.segments.reduce((t, s) => t + pw(s), 0);
    const mean = brief.segments.reduce((t, s, i) => t + segs[i].fit * pw(s), 0) / wsum;
    // weight "best" by segment priority so a specialist for a top-priority segment ranks above one for a minor segment
    best = segs.map((s, i) => ({ s, v: s.fit * (0.82 + 0.18 * (pw(brief.segments[i]) / 5)) })).sort((a, b) => b.v - a.v)[0].s;
    const score = Math.round(0.65 * best.fit + 0.35 * mean);
    crit.push({ key: "audience", score, note: `Strongest with “${best.name}” (~${Math.round(best.share * 100)}% of audience); blended across ${segs.length} segment(s).` });
    if (best.fit >= 70) reasons.push(`~${Math.round(best.share * 100)}% of audience matches “${best.name}”`);
    if (score < 45) concerns.push("Limited overlap with the defined audience segments");
  }

  // 2. content relevance
  const wanted = new Set([...brief.prefs.categories, ...(TYPE_KEYWORDS[brief.type] ?? [])].map((x) => x.toLowerCase()));
  const segInterests = new Set(brief.segments.flatMap((s) => s.interests).map((x) => x.toLowerCase()));
  if (!inf.categories.length) { crit.push({ key: "content", score: 50, note: "No content categories recorded.", missing: true }); missing.push("Content categories"); }
  else {
    const hits = inf.categories.filter((c) => wanted.has(c.toLowerCase()));
    const prefHits = inf.categories.filter((c) => brief.prefs.categories.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
    const interestHits = inf.categories.filter((c) => segInterests.has(c.toLowerCase()));
    const langOk = !brief.prefs.languages.length || inf.languages.some((l) => brief.prefs.languages.includes(l));
    let score = wanted.size ? 38 + Math.min(2, hits.length) * 20 + Math.min(1, prefHits.length) * 10 + Math.min(1, interestHits.length) * 8 : 60;
    if (!langOk) { score -= 18; concerns.push(`Content language (${inf.languages.join(", ")}) is outside the preferred languages`); }
    crit.push({ key: "content", score: clamp(score), note: hits.length ? `Creates ${hits.join(", ")} content relevant to this ${brief.type.toLowerCase() || "campaign"}.` : `Categories (${inf.categories.join(", ")}) are not a direct match for the brief.` });
    if (hits.length) reasons.push(`Relevant content: ${hits.slice(0, 2).join(", ")}`);
  }

  // 3. engagement & performance
  const tier = tierOf(inf.followers);
  if (inf.engagementRate == null) { crit.push({ key: "engagement", score: 50, note: "Engagement rate unavailable.", missing: true }); missing.push("Engagement rate"); }
  else {
    const rel = inf.engagementRate / ER_BENCH[tier];
    let score = clamp(Math.round(50 + (rel - 1) * 45), 5, 100);
    let note = `${(inf.engagementRate * 100).toFixed(1)}% engagement vs ~${(ER_BENCH[tier] * 100).toFixed(1)}% typical for the ${tier} tier.`;
    if (inf.sponsoredPerformance != null) { score = clamp(Math.round(score + (inf.sponsoredPerformance - 0.9) * 20)); note += ` Sponsored posts perform at ${(inf.sponsoredPerformance * 100).toFixed(0)}% of organic.`; }
    if (ctx.history && ctx.history.campaigns >= 2) {
      const adj = clamp((ctx.history.ratio - 1) * 30, -15, 15);
      score = clamp(Math.round(score + adj));
      note += ` Adjusted ${adj >= 0 ? "+" : ""}${adj.toFixed(0)} from ${ctx.history.campaigns} past campaigns (actual ÷ forecast = ${ctx.history.ratio.toFixed(2)}).`;
    }
    if (inf.engagementRate < brief.prefs.minEngagement / 100) concerns.push(`Engagement is below the ${brief.prefs.minEngagement}% minimum in the brief`);
    crit.push({ key: "engagement", score, note });
    if (rel >= 1.2) reasons.push(`Engagement ${(rel * 100 - 100).toFixed(0)}% above tier benchmark`);
    if (rel < 0.7) concerns.push("Engagement is below the typical range for this tier");
  }

  // 4. geographic relevance
  const targetCountries = [...new Set(brief.segments.flatMap((s) => s.countries))];
  const geoShare = share(inf.audience?.countries, targetCountries, targetCountries.map((c) => COUNTRIES[c] ?? c));
  const loc = brief.location.toLowerCase();
  const local = !!inf.city && loc.includes(inf.city.toLowerCase());
  const sameCountry = !!inf.country && (targetCountries.includes(inf.country) || loc.includes(inf.country.toLowerCase()));
  if (geoShare == null && !inf.country) { crit.push({ key: "geo", score: 50, note: "No location data available.", missing: true }); missing.push("Audience location"); }
  else {
    const score = clamp(Math.round((geoShare != null ? Math.pow(geoShare, 0.7) * 85 : 45) + (local ? 15 : sameCountry ? 8 : 0)));
    crit.push({ key: "geo", score, note: `${geoShare != null ? `${Math.round(geoShare * 100)}% of audience in target countries` : "Audience geography unknown"}${inf.city ? `; based in ${inf.city}` : ""}.` });
    if (geoShare != null && geoShare < 0.3) concerns.push(`Only ${Math.round(geoShare * 100)}% of the audience is in the target countries`);
    if (local) reasons.push(`Based in ${inf.city} — available on the ground`);
  }

  // 5. authenticity
  const cred = inf.audience?.credibility;
  if (cred == null) { crit.push({ key: "authenticity", score: 50, note: "Audience credibility data unavailable.", missing: true }); missing.push("Audience authenticity"); }
  else {
    crit.push({ key: "authenticity", score: clamp(Math.round((cred - 0.5) * 220)), note: `${Math.round(cred * 100)}% of followers estimated to be real accounts.` });
    if (cred < 0.72) concerns.push(`Audience credibility is ${Math.round(cred * 100)}% — review before confirming`);
    if (cred >= 0.88) reasons.push("High audience credibility");
  }

  // 6. cost efficiency (relative to the discovery pool)
  const estFee = estimateFee(inf);
  const reachProxy = inf.avgViews ?? inf.followers * 0.12;
  const cpm = (estFee / Math.max(reachProxy, 1)) * 1000;
  if (!ctx.medianCpm) crit.push({ key: "cost", score: 55, note: `Estimated fee ${estFee.toLocaleString()} (~${cpm.toFixed(0)} per 1,000 est. views).` });
  else {
    const score = clamp(Math.round(55 + (1 - cpm / ctx.medianCpm) * 55), 5, 100);
    crit.push({ key: "cost", score, note: `Estimated cost per 1,000 views is ${cpm < ctx.medianCpm ? "below" : "above"} the pool median (${cpm.toFixed(0)} vs ${ctx.medianCpm.toFixed(0)}).` });
    if (score >= 75) reasons.push("Cost-efficient relative to the pool");
    if (score < 30) concerns.push("Estimated cost per view is high relative to alternatives");
  }

  // 7. brand suitability
  const handle = inf.handle.toLowerCase();
  const approved = brief.prefs.approvedHandles.some((h) => h.replace("@", "").toLowerCase() === handle);
  const competitor = brief.prefs.competitors.find((c) => c && (inf.bio ?? "").toLowerCase().includes(c.toLowerCase()));
  if (inf.brandSafety == null && !approved && inf.approvalStatus !== "approved") {
    crit.push({ key: "brand", score: competitor ? 20 : 50, note: competitor ? `Profile mentions competitor “${competitor}”.` : "Not yet reviewed for brand suitability — manual review recommended.", missing: !competitor });
    if (!competitor) missing.push("Brand suitability review");
  } else {
    let score = inf.brandSafety ?? 80;
    if (approved || inf.approvalStatus === "approved") { score = Math.max(score, 90); reasons.push("Previously approved"); }
    if (inf.approvalStatus === "blocked") { score = 5; concerns.push("Marked as blocked in the Influencer Library"); }
    if (competitor) { score = Math.min(score, 25); }
    crit.push({ key: "brand", score: clamp(score), note: approved ? "On the previously-approved list." : `Internal brand-suitability review: ${score}/100.` });
  }
  if (competitor) concerns.push(`Possible competitor affiliation: ${competitor}`);
  if (inf.followers < brief.prefs.minFollowers) concerns.push(`Below the minimum follower count (${brief.prefs.minFollowers.toLocaleString()})`);
  if (brief.prefs.tiers.length && !brief.prefs.tiers.includes(tier)) concerns.push(`Tier (${tier}) is outside the preferred tiers`);
  if (inf.source === "demo") missing.push("Verified analytics (demonstration profile)");

  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const total = Math.round(crit.reduce((t, c) => t + c.score * (weights[c.key] ?? 0), 0) / wsum);
  const confidence = crit.reduce((t, c) => t + (c.missing ? 0 : weights[c.key] ?? 0), 0) / wsum;
  return {
    total, criteria: crit, segments: segs, bestSegment: best, reasons: reasons.slice(0, 4), concerns, missing, confidence, estFee,
    historyNote: ctx.history && ctx.history.campaigns >= 2 ? `Based on ${ctx.history.campaigns} past campaigns` : undefined,
  };
}

export function medianCpmOf(pool: Influencer[]): number | undefined {
  const v = pool.map((i) => (estimateFee(i) / Math.max(i.avgViews ?? i.followers * 0.12, 1)) * 1000).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : undefined;
}

export function scorePool(pool: Influencer[], brief: Brief, weights: Weights, history: Record<string, HistoryStat> = {}): Record<string, ScoreResult> {
  const medianCpm = medianCpmOf(pool);
  return Object.fromEntries(pool.map((i) => [i.id, scoreInfluencer(i, brief, weights, { medianCpm, history: history[i.id] })]));
}

/** Platform recommendation from objectives + audience (transparent heuristic). */
export function recommendPlatforms(brief: Brief): { platform: string; score: number; why: string }[] {
  const s: Record<string, { score: number; why: string[] }> = {};
  const add = (p: string, n: number, why: string) => { s[p] ??= { score: 0, why: [] }; s[p].score += n; if (!s[p].why.includes(why)) s[p].why.push(why); };
  const ages = new Set(brief.segments.flatMap((x) => x.ageGroups));
  const langs = new Set(brief.segments.flatMap((x) => x.languages));
  const obj = brief.objectives;
  add("instagram", 3, "broad reach across UAE residents");
  if (ages.has("13-17") || ages.has("18-24")) { add("tiktok", 4, "strong with under-25s"); add("snapchat", 2, "popular with GCC youth"); }
  if (langs.has("Arabic")) add("snapchat", 2, "high Arabic-speaking usage in the Gulf");
  if (langs.has("Hindi") || langs.has("Urdu") || langs.has("Tagalog")) { add("youtube", 2, "long-form guides in community languages"); add("facebook", 2, "active resident community groups"); add("tiktok", 1, "community-language short video"); }
  if (obj.some((o) => /Educate|adoption|download|behaviour/i.test(o))) add("youtube", 3, "explainers and how-to content");
  if (obj.some((o) => /reach|awareness/i.test(o))) { add("tiktok", 2, "efficient reach"); add("instagram", 1, "awareness formats (Reels, Stories)"); }
  if (obj.some((o) => /engagement/i.test(o))) add("tiktok", 1, "high engagement rates");
  if (obj.some((o) => /perception|brand/i.test(o)) || brief.segments.some((x) => x.professions.length)) add("linkedin", 3, "professional and stakeholder audiences");
  if (/Government/i.test(brief.type)) add("x", 2, "official announcements and news commentary");
  if (ages.has("45-64") || ages.has("65+")) add("facebook", 2, "older demographics");
  return Object.entries(s).map(([platform, v]) => ({ platform, score: v.score, why: v.why.join("; ") })).sort((a, b) => b.score - a.score);
}

/** Suggested tier mix when the user has not specified one. */
export function recommendTierMix(brief: Brief): { tier: string; share: number; why: string }[] {
  const reach = brief.objectives.slice(0, 3).some((o) => /reach|awareness|attendance/i.test(o));
  const community = brief.objectives.some((o) => /communities|behaviour|Educate|adoption/i.test(o)) || brief.segments.length >= 3;
  if (reach && !community) return [{ tier: "Macro / Mega", share: 45, why: "headline reach" }, { tier: "Mid-tier", share: 35, why: "efficient scale" }, { tier: "Micro", share: 20, why: "credibility and engagement" }];
  if (community && !reach) return [{ tier: "Micro", share: 45, why: "trusted voices inside each community" }, { tier: "Mid-tier", share: 35, why: "scale within segments" }, { tier: "Nano", share: 10, why: "authentic peer advocacy" }, { tier: "Macro", share: 10, why: "one anchor name" }];
  return [{ tier: "Macro / Mega", share: 25, why: "anchor reach" }, { tier: "Mid-tier", share: 40, why: "balanced scale and relevance" }, { tier: "Micro / Nano", share: 35, why: "segment depth and engagement" }];
}
