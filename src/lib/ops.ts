import type { Campaign, Influencer, Op, Platform } from "./types";
import { formatInfo, SLIDES } from "./constants";
import { estimateFee } from "./scoring";
import { draftAssignment } from "./scenarios";
import { generateSchedule } from "./schedule";
import { computeModel, type Model } from "./model";
import { uid } from "./utils";

/** Apply change operations to a campaign draft (mutates). Locked creators are never removed. Returns skipped notes. */
export function applyOps(c: Campaign, ops: Op[], lib: Record<string, Influencer>): string[] {
  const skipped: string[] = [];
  const find = (id: string) => c.assignments.find((a) => a.influencerId === id);
  for (const o of ops) {
    switch (o.op) {
      case "add_influencer": {
        const inf = lib[o.influencerId]; if (!inf || find(inf.id)) break;
        c.assignments.push(draftAssignment(inf, c.brief, estimateFee(inf)));
        if (!c.candidates.includes(inf.id)) c.candidates.push(inf.id);
        c.rejected = c.rejected.filter((x) => x !== inf.id);
        break;
      }
      case "remove_influencer": {
        const a = find(o.influencerId); if (!a) break;
        if (a.locked || a.mandatory) { skipped.push(`${lib[a.influencerId]?.name ?? "Creator"} is locked or mandatory and was kept.`); break; }
        c.assignments = c.assignments.filter((x) => x !== a);
        c.events = c.events.filter((e) => e.influencerId !== a.influencerId);
        break;
      }
      case "replace_influencer": {
        const a = find(o.influencerId); const to = lib[o.toId]; if (!a || !to || find(to.id)) break;
        if (a.locked || a.mandatory) { skipped.push(`${lib[a.influencerId]?.name ?? "Creator"} is locked or mandatory and was not replaced.`); break; }
        const next = draftAssignment(to, c.brief, estimateFee(to));
        next.messages = { ...a.messages }; next.status = "Recommended";
        c.assignments[c.assignments.indexOf(a)] = next;
        c.events = c.events.filter((e) => e.influencerId !== a.influencerId);
        if (!c.candidates.includes(to.id)) c.candidates.push(to.id);
        break;
      }
      case "set_fee": { const a = find(o.influencerId); if (a) { a.fee = Math.max(0, Math.round(o.fee)); } break; }
      case "set_budget": { (c.brief.budget[o.field] as number) = Math.max(0, Math.round(o.value)); break; }
      case "assign_message": {
        const a = find(o.influencerId); if (!a || !c.messages.some((m) => m.id === o.messageId)) break;
        if (a.plan?.locked) { skipped.push(`${lib[a.influencerId]?.name ?? "Creator"}'s content is locked; message assignment unchanged.`); break; }
        if (o.level === "none") delete a.messages[o.messageId]; else a.messages[o.messageId] = o.level;
        break;
      }
      case "add_deliverable": {
        const a = find(o.influencerId); const inf = lib[o.influencerId]; if (!a || !inf) break;
        const ex = a.deliverables.find((d) => d.format === o.format);
        if (ex) ex.count += o.count; else a.deliverables.push({ id: uid("d"), format: o.format, platform: inf.platform as Platform, count: o.count, durationSec: formatInfo(o.format).defaultDuration });
        break;
      }
      case "remove_deliverable": { const a = find(o.influencerId); if (a) a.deliverables = a.deliverables.filter((d) => d.format !== o.format); break; }
      case "move_event": { const e = c.events.find((x) => x.id === o.eventId); if (e) { e.date = o.date; e.auto = false; } break; }
      case "hide_slides": { c.deck.hidden = [...new Set(o.slideIds.filter((s) => SLIDES.some((x) => x.id === s)))]; break; }
      case "regenerate_schedule": { c.events = generateSchedule(c, lib); break; }
    }
  }
  return skipped;
}

export interface ImpactRow { label: string; before: string; after: string; delta?: number; better?: boolean }
export function impactOf(c: Campaign, ops: Op[], lib: Record<string, Influencer>, fmt: { compact: (n: number) => string; money: (n: number) => string }): { rows: ImpactRow[]; skipped: string[]; after: Model } {
  const before = computeModel(c, lib);
  const draft: Campaign = structuredClone(c);
  const skipped = applyOps(draft, ops, lib);
  const after = computeModel(draft, lib);
  const rows: ImpactRow[] = [];
  const push = (label: string, b: number, a: number, f: (n: number) => string, higherBetter = true) => { if (Math.round(b) !== Math.round(a)) rows.push({ label, before: f(b), after: f(a), delta: b ? (a - b) / Math.abs(b) : undefined, better: higherBetter ? a > b : a < b }); };
  push("Influencers", before.selected.length, after.selected.length, String);
  push("Total budget", before.budget.total, after.budget.total, fmt.money, false);
  push("Influencer fees", before.budget.influencerSpend, after.budget.influencerSpend, fmt.money, false);
  push("Planned spend", before.budget.grand, after.budget.grand, fmt.money, false);
  push("Remaining budget", before.budget.remaining, after.budget.remaining, fmt.money);
  push("Est. unique reach", before.forecast.expected.reach, after.forecast.expected.reach, fmt.compact);
  push("Est. engagements", before.forecast.expected.engagements, after.forecast.expected.engagements, fmt.compact);
  push("Deliverables", before.forecast.expected.deliverables, after.forecast.expected.deliverables, String);
  before.coverage.forEach((s, i) => push(`Coverage — ${s.name}`, s.share * 100, (after.coverage[i]?.share ?? 0) * 100, (n) => `${Math.round(n)}%`));
  const crit = (m: Model) => m.alerts.filter((x) => x.level !== "info").length;
  push("Unassigned / ownerless messages", crit(before), crit(after), String, false);
  push("Schedule issues", before.conflicts.length, after.conflicts.length, String, false);
  if (before.campaign.deck.hidden.length !== after.campaign.deck.hidden.length) rows.push({ label: "Slides in presentation", before: String(SLIDES.length - before.campaign.deck.hidden.length), after: String(SLIDES.length - after.campaign.deck.hidden.length) });
  return { rows, skipped, after };
}
