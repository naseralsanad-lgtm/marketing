import type { Assignment, Brief, Budget } from "./types";
import { sum } from "./utils";

export interface BudgetSummary {
  currency: string;
  total: number;
  influencerAllocated: number;
  confirmed: number; quoted: number; estimated: number; influencerSpend: number;
  production: number; travel: number; amplification: number; additional: number; contingency: number;
  subtotal: number; taxes: number; grand: number;
  remaining: number; utilisation: number;
  influencerRemaining: number;
  over: boolean; influencerOver: boolean;
}

export const allocationsTotal = (b: Budget) => b.influencer + b.production + b.amplification + b.travel + b.additional + b.contingency;
/** Total envelope: fixed total, or allocations + tax when the user budgets line by line. */
export const budgetTotal = (b: Budget) => (b.mode === "total" ? b.total : Math.round(allocationsTotal(b) * (1 + b.taxRate / 100)));

export function summariseBudget(b: Budget, assignments: Assignment[]): BudgetSummary {
  const by = (s: Assignment["feeStatus"]) => sum(assignments.filter((a) => a.feeStatus === s).map((a) => a.fee));
  const confirmed = by("confirmed"), quoted = by("quoted"), estimated = by("estimated");
  const influencerSpend = confirmed + quoted + estimated;
  // contingency is a reserve: it is part of the plan but only "spent" if drawn on
  const subtotal = influencerSpend + b.production + b.travel + b.amplification + b.additional;
  const taxes = subtotal * (b.taxRate / 100);
  const grand = subtotal + taxes;
  const total = budgetTotal(b);
  return {
    currency: b.currency, total, influencerAllocated: b.influencer, confirmed, quoted, estimated, influencerSpend,
    production: b.production, travel: b.travel, amplification: b.amplification, additional: b.additional, contingency: b.contingency,
    subtotal, taxes, grand, remaining: total - grand, utilisation: total ? grand / total : 0,
    influencerRemaining: b.influencer - influencerSpend, over: total > 0 && grand > total, influencerOver: b.influencer > 0 && influencerSpend > b.influencer,
  };
}

/** Recommended split of a total budget, driven by objectives, audience complexity and campaign type. */
export function recommendAllocation(brief: Brief): { budget: Budget; rationale: string[] } {
  const b = brief.budget; const total = b.total; const why: string[] = [];
  const net = total / (1 + b.taxRate / 100);
  let inf = 0.58, prod = 0.12, amp = 0.12, travel = 0.05, add = 0.03, cont = 0.1;
  const obj = brief.objectives.slice(0, 4).join(" ");
  if (/reach|awareness/i.test(obj)) { amp += 0.05; inf -= 0.03; prod -= 0.02; why.push("Reach and awareness objectives → more paid amplification to extend the best-performing creator content."); }
  if (/Educate|adoption|download|behaviour/i.test(obj)) { prod += 0.04; inf -= 0.02; amp -= 0.02; why.push("Education / adoption objectives → more production budget for explainer-quality content."); }
  if (/engagement|communities/i.test(obj)) { inf += 0.04; amp -= 0.04; why.push("Engagement and community objectives → more of the budget goes directly to creators."); }
  if (brief.segments.length >= 3) { inf += 0.03; cont -= 0.02; add -= 0.01; why.push(`${brief.segments.length} audience segments → a wider creator mix is needed to cover each one.`); }
  if (/Event/i.test(brief.type) || brief.eventStart) { travel += 0.03; prod += 0.02; inf -= 0.05; why.push("On-ground event → travel, accommodation and on-site production crews."); }
  const parts = [inf, prod, amp, travel, add, cont].map((x) => Math.max(0.01, x)); const s = sum(parts);
  const r = (x: number) => Math.round((net * x) / s / 500) * 500;
  why.push(`${b.taxRate}% tax is reserved first; a ${Math.round((parts[5] / s) * 100)}% contingency covers late changes.`);
  return { budget: { ...b, influencer: r(parts[0]), production: r(parts[1]), amplification: r(parts[2]), travel: r(parts[3]), additional: r(parts[4]), contingency: r(parts[5]) }, rationale: why };
}
