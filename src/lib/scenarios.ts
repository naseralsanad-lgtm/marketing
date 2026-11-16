import type { Assignment, Brief, Influencer } from "./types";
import { tierOf } from "./constants";
import type { ScoreResult } from "./scoring";
import { segmentShare } from "./scoring";
import { forecastCampaign, forecastInfluencer, segmentCoverage, type Forecast, type SegmentCoverage } from "./forecast";
import { defaultDeliverables } from "./content";
import { sum } from "./utils";

export const SCENARIOS = [
  { id: "balanced", name: "Balanced campaign", desc: "Match score first, with a tier mix and every segment covered." },
  { id: "reach", name: "Maximum reach", desc: "Largest estimated unique reach within budget." },
  { id: "alignment", name: "Best audience alignment", desc: "Creators whose audiences sit closest to the defined segments." },
  { id: "engagement", name: "Maximum engagement", desc: "Highest expected interactions per dirham." },
  { id: "value", name: "Best value for money", desc: "Lowest cost per estimated reach." },
  { id: "premium", name: "Premium influencer campaign", desc: "Fewer, larger and highly brand-safe names." },
  { id: "community", name: "Community-focused campaign", desc: "Micro and nano voices embedded in each community." },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]["id"];

export interface ScenarioResult {
  id: ScenarioId; name: string; desc: string;
  ids: string[]; cost: number; forecast: Forecast; coverage: SegmentCoverage[];
  avgScore: number; limitations: string[]; keptLocked: number;
}

export function draftAssignment(inf: Influencer, brief: Brief, fee: number, manual = false): Assignment {
  return {
    influencerId: inf.id, status: manual ? "Shortlisted" : "Recommended", fee, feeStatus: inf.feeHistory.some((f) => f.status === "confirmed") ? "quoted" : "estimated",
    locked: false, mandatory: false, manual, notes: "", deliverables: defaultDeliverables(inf, brief), messages: {}, ops: {},
  };
}

export function buildScenario(id: ScenarioId, pool: Influencer[], scores: Record<string, ScoreResult>, brief: Brief, current: Assignment[], lib: Record<string, Influencer>, rejected: string[]): ScenarioResult {
  const meta = SCENARIOS.find((s) => s.id === id)!;
  const keep = current.filter((a) => a.locked || a.mandatory || a.manual);
  const keepIds = new Set(keep.map((a) => a.influencerId));
  const excluded = new Set(brief.prefs.excludedHandles.map((h) => h.replace("@", "").toLowerCase()));
  const budget = brief.budget.influencer || brief.budget.total * 0.55 || Infinity;
  const target = brief.prefs.count ?? (id === "premium" ? 6 : id === "community" ? 14 : 10);
  const cand = pool.filter((i) => !keepIds.has(i.id) && !rejected.includes(i.id) && !excluded.has(i.handle.toLowerCase()) && i.approvalStatus !== "blocked"
    && i.followers >= brief.prefs.minFollowers && (i.engagementRate ?? 1) >= brief.prefs.minEngagement / 100);
  const fc = (i: Influencer) => forecastInfluencer(i, draftAssignment(i, brief, scores[i.id].estFee));
  const value: Record<ScenarioId, (i: Influencer) => number> = {
    balanced: (i) => scores[i.id].total,
    reach: (i) => fc(i).reach / 1000,
    alignment: (i) => scores[i.id].criteria.find((c) => c.key === "audience")!.score * 2 + scores[i.id].total,
    engagement: (i) => fc(i).engagements / Math.max(scores[i.id].estFee, 1) * 100,
    value: (i) => (fc(i).reach / Math.max(scores[i.id].estFee, 1)) * (scores[i.id].total / 60),
    premium: (i) => (i.followers >= 300_000 ? 100 : 0) + scores[i.id].total + (i.brandSafety ?? 60) / 2,
    community: (i) => (i.followers < 200_000 ? 80 : 0) + scores[i.id].criteria.find((c) => c.key === "audience")!.score + (i.engagementRate ?? 0) * 400,
  };
  let spent = sum(keep.map((a) => a.fee));
  const picked: Influencer[] = [];
  const pickedTier: Record<string, number> = {};
  const remaining = [...cand];
  const segAware = id === "balanced" || id === "alignment" || id === "community";
  const tsum = sum(brief.segments.map((s) => s.coverageTarget)) || 100;
  // running estimate of how reach splits across segments, so each pick can favour the most under-served one
  const segReach: Record<string, number> = Object.fromEntries(brief.segments.map((s) => [s.id, 0]));
  const addReach = (i: Influencer) => { const r = fc(i).reach; for (const s of brief.segments) segReach[s.id] += r * (segmentShare(i, s) ?? 0); };
  keep.forEach((a) => lib[a.influencerId] && addReach(lib[a.influencerId]));
  while (picked.length + keep.length < target && remaining.length) {
    let bestIdx = -1, bestV = -Infinity;
    const total = sum(Object.values(segReach)) || 1;
    remaining.forEach((i, idx) => {
      const fee = scores[i.id].estFee;
      if (spent + fee > budget) return;
      // a balanced mix never lets one creator absorb a disproportionate share of the fees
      if (id === "balanced" && isFinite(budget) && fee > budget * 0.18) return;
      let v = value[id](i);
      if (segAware) {
        let boost = 0;
        for (const s of brief.segments) { const deficit = s.coverageTarget / tsum - segReach[s.id] / total; boost += deficit * (segmentShare(i, s) ?? 0) * (picked.length + keep.length ? 6 : 1.5); }
        v *= Math.max(0.5, 1 + boost);
      }
      if (id === "balanced") v *= (pickedTier[tierOf(i.followers)] ?? 0) >= Math.ceil(target / 2) ? 0.8 : 1;
      if (v > bestV) { bestV = v; bestIdx = idx; }
    });
    if (bestIdx < 0) break;
    const [i] = remaining.splice(bestIdx, 1);
    picked.push(i); spent += scores[i.id].estFee; addReach(i);
    pickedTier[tierOf(i.followers)] = (pickedTier[tierOf(i.followers)] ?? 0) + 1;
  }
  const assignments = [...keep, ...picked.map((i) => draftAssignment(i, brief, scores[i.id].estFee))];
  const forecast = forecastCampaign(assignments, lib, "expected", spent);
  const coverage = segmentCoverage(brief, forecast, lib);
  const limitations: string[] = [];
  for (const c of coverage) if (c.status === "under") limitations.push(`“${c.name}” is under-covered (${Math.round(c.share * 100)}% vs ${Math.round(c.target * 100)}% target)`);
  if (assignments.length < target) limitations.push(`Only ${assignments.length} of ${target} creators fit the influencer budget`);
  if (id === "reach") limitations.push("Reach-led mixes typically engage less deeply per person reached");
  if (id === "premium") limitations.push("Few creators → higher dependency on each one delivering");
  if (id === "community") limitations.push("More creators to brief, approve and manage");
  if (id === "value") limitations.push("Lowest cost creators may need more production support");
  const demo = assignments.filter((a) => lib[a.influencerId]?.source === "demo").length;
  if (demo) limitations.push(`${demo} profile(s) use demonstration data — figures are illustrative`);
  const langs = new Set(assignments.flatMap((a) => lib[a.influencerId]?.languages ?? []));
  for (const l of new Set(brief.segments.flatMap((s) => s.languages))) if (!langs.has(l)) limitations.push(`No creator publishing in ${l}`);
  return { id, name: meta.name, desc: meta.desc, ids: assignments.map((a) => a.influencerId), cost: spent, forecast, coverage, avgScore: Math.round(sum(assignments.map((a) => scores[a.influencerId]?.total ?? 0)) / Math.max(assignments.length, 1)), limitations, keptLocked: keep.length };
}

/** Best unselected candidates for an under-covered segment. */
export function gapCandidates(segmentId: string, pool: Influencer[], scores: Record<string, ScoreResult>, brief: Brief, selected: string[], rejected: string[], n = 3): Influencer[] {
  const seg = brief.segments.find((s) => s.id === segmentId); if (!seg) return [];
  return pool.filter((i) => !selected.includes(i.id) && !rejected.includes(i.id))
    .map((i) => ({ i, v: (segmentShare(i, seg) ?? 0) * 100 + scores[i.id].total * 0.4 })).sort((a, b) => b.v - a.v).slice(0, n).map((x) => x.i);
}
