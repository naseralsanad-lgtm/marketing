import type { Campaign, Influencer } from "./types";
import { scorePool, type HistoryStat, type ScoreResult } from "./scoring";
import { summariseBudget, type BudgetSummary } from "./budget";
import { distribution, forecastCampaign, forecastInfluencer, segmentCoverage, type Distribution, type Forecast, type ScenarioKey, type SegmentCoverage } from "./forecast";
import { matrixAlerts, matrixRows, type MatrixAlert, type MatrixRow } from "./content";
import { findConflicts, type Conflict } from "./schedule";
import { diffDays } from "./utils";

/** Everything derived from a campaign. Recomputed whenever the campaign or library changes. */
export interface Model {
  campaign: Campaign;
  lib: Record<string, Influencer>;
  pool: Influencer[];
  selected: Influencer[];
  scores: Record<string, ScoreResult>;
  budget: BudgetSummary;
  forecast: Record<ScenarioKey, Forecast>;
  dist: Distribution;
  coverage: SegmentCoverage[];
  matrix: MatrixRow[];
  alerts: MatrixAlert[];
  conflicts: Conflict[];
  durationDays: number;
  dataQuality: { demo: number; modash: number; manual: number; label: string; level: "low" | "medium" | "high" };
}

export function historyStats(campaigns: Record<string, Campaign>, lib: Record<string, Influencer>): Record<string, HistoryStat> {
  const acc: Record<string, { n: number; r: number }> = {};
  for (const c of Object.values(campaigns)) for (const a of c.assignments) {
    const inf = lib[a.influencerId]; if (!inf || !a.actuals?.reach) continue;
    const f = forecastInfluencer(inf, a).reach; if (!f) continue;
    (acc[inf.id] ??= { n: 0, r: 0 }).n++; acc[inf.id].r += a.actuals.reach / f;
  }
  return Object.fromEntries(Object.entries(acc).map(([id, v]) => [id, { campaigns: v.n, ratio: v.r / v.n }]));
}

export function computeModel(c: Campaign, lib: Record<string, Influencer>, history: Record<string, HistoryStat> = {}): Model {
  const selIds = c.assignments.map((a) => a.influencerId);
  const poolIds = [...new Set([...c.candidates, ...selIds])];
  const pool = poolIds.map((id) => lib[id]).filter(Boolean);
  const scores = scorePool(pool, c.brief, c.weights, history);
  const selected = selIds.map((id) => lib[id]).filter(Boolean);
  const live = c.assignments.filter((a) => lib[a.influencerId]);
  const budget = summariseBudget(c.brief.budget, live);
  const spend = budget.grand;
  const forecast = {
    conservative: forecastCampaign(live, lib, "conservative", spend),
    expected: forecastCampaign(live, lib, "expected", spend),
    optimistic: forecastCampaign(live, lib, "optimistic", spend),
  };
  const matrix = matrixRows({ ...c, assignments: live }, scores);
  const demo = selected.filter((i) => i.source === "demo").length, modash = selected.filter((i) => i.source === "modash").length;
  const manual = selected.length - demo - modash;
  const level = !selected.length ? "low" : modash / selected.length >= 0.7 ? "high" : modash / selected.length >= 0.3 ? "medium" : "low";
  return {
    campaign: c, lib, pool, selected, scores, budget, forecast,
    dist: distribution(forecast.expected, lib), coverage: segmentCoverage(c.brief, forecast.expected, lib),
    matrix, alerts: matrixAlerts(matrix), conflicts: findConflicts({ ...c, assignments: live }, lib),
    durationDays: c.brief.startDate && c.brief.endDate ? diffDays(c.brief.startDate, c.brief.endDate) + 1 : 0,
    dataQuality: {
      demo, modash, manual, level,
      label: !selected.length ? "No influencers selected" : demo === selected.length ? "Illustrative — demonstration data only" : level === "high" ? "Higher confidence — mostly Modash analytics" : level === "medium" ? "Medium confidence — mixed data sources" : "Low confidence — mostly manual or demonstration data",
    },
  };
}
