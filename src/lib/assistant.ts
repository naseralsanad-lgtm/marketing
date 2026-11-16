import type { Campaign, Influencer, Op, Proposal } from "./types";
import { COUNTRIES, LANGUAGES, SLIDES, tierOf } from "./constants";
import type { Model } from "./model";
import { buildScenario, gapCandidates } from "./scenarios";
import { segmentShare } from "./scoring";
import { addDays, compact, money, uid } from "./utils";

/**
 * Built-in assistant (used when no AI key is configured, and as a fallback).
 * It recognises common planning instructions and turns them into reviewable change proposals.
 * Nothing is applied until the user accepts a proposal.
 */
export interface AssistantReply { reply: string; proposals: Proposal[]; engine: "built-in" | "claude" }
const P = (title: string, rationale: string, ops: Op[], notes?: string[]): Proposal => ({ id: uid("p"), title, rationale, ops, notes });

function matchSegment(text: string, c: Campaign) {
  const t = text.toLowerCase();
  return c.brief.segments.map((s) => {
    const words = [s.name, ...s.languages, ...s.communities, ...s.countries].join(" ").toLowerCase().match(/[a-z؀-ۿ]{4,}/g) ?? [];
    return { s, hits: words.filter((w) => t.includes(w)).length };
  }).sort((a, b) => b.hits - a.hits).filter((x) => x.hits > 0)[0]?.s;
}

export function weaknesses(m: Model): string[] {
  const out: string[] = []; const cur = m.budget.currency;
  if (!m.selected.length) return ["No influencers are selected yet."];
  if (m.budget.over) out.push(`Planned spend exceeds the budget by ${money(-m.budget.remaining, cur)}.`);
  else if (m.budget.influencerOver) out.push(`Influencer fees exceed the influencer allocation by ${money(-m.budget.influencerRemaining, cur)}.`);
  for (const s of m.coverage) if (s.status === "under") out.push(`“${s.name}” receives ${Math.round(s.share * 100)}% of estimated reach against a ${Math.round(s.target * 100)}% target.`);
  const crit = m.alerts.filter((a) => a.level === "critical"); if (crit.length) out.push(`${crit.length} mandatory or high-priority message(s) are not assigned to any creator.`);
  const dup = m.alerts.filter((a) => a.level === "info").length; if (dup) out.push(`${dup} message(s) may be duplicated across too many creators.`);
  if (m.conflicts.length) out.push(`${m.conflicts.length} scheduling issue(s), including ${m.conflicts.filter((x) => x.level === "critical").length} critical.`);
  const lowCred = m.selected.filter((i) => (i.audience?.credibility ?? 1) < 0.72); if (lowCred.length) out.push(`Audience credibility is below 72% for ${lowCred.map((i) => i.name).join(", ")}.`);
  const est = m.campaign.assignments.filter((a) => a.feeStatus === "estimated").length; if (est) out.push(`${est} of ${m.selected.length} fees are still estimates — request quotations to firm up the budget.`);
  const top = [...m.forecast.expected.byInfluencer].sort((a, b) => b.reach - a.reach)[0];
  if (top && m.selected.length > 2 && top.reach / Math.max(1, m.forecast.expected.byInfluencer.reduce((s, x) => s + x.reach, 0)) > 0.45) out.push(`${m.lib[top.influencerId].name} accounts for over 45% of estimated reach — high dependency on one creator.`);
  const noPlan = m.campaign.assignments.filter((a) => !a.plan).length; if (noPlan) out.push(`${noPlan} creator(s) have no content plan yet.`);
  if (m.dataQuality.demo) out.push(`${m.dataQuality.demo} selected profile(s) use demonstration data; forecasts are illustrative until refreshed with verified analytics.`);
  const missing = m.selected.filter((i) => m.scores[i.id]?.confidence < 0.6); if (missing.length) out.push(`Limited analytics for ${missing.map((i) => i.name).join(", ")} — match scores rely on neutral defaults.`);
  return out.length ? out : ["No material weaknesses detected in the current plan."];
}

export function localAssistant(text: string, m: Model, focusId?: string): AssistantReply {
  const c = m.campaign, t = text.toLowerCase(), cur = m.budget.currency;
  const selIds = c.assignments.map((a) => a.influencerId);
  const name = (id: string) => m.lib[id]?.name ?? id;
  const R = (reply: string, proposals: Proposal[] = []): AssistantReply => ({ reply, proposals, engine: "built-in" });

  if (/weakness|risk|problem|issue|what'?s wrong|review the|audit/.test(t)) return R(`Here is what I would look at first:\n\n${weaknesses(m).map((w) => `• ${w}`).join("\n")}`);

  if (/(shorter|short|concise|brief|condense).*(presentation|deck|slides)|(presentation|deck).*(shorter|senior|leadership|executive)/.test(t)) {
    const keep = ["cover", "summary", "objectives", "audience", "influencers", "content", "impact", "budget", "timeline", "next"];
    return R("I can cut the presentation down to a 10-section leadership version.", [P("Shorter leadership presentation", "Keeps the decision-critical sections and hides detail slides (they stay available to switch back on).", [{ op: "hide_slides", slideIds: SLIDES.map((s) => s.id).filter((s) => !keep.includes(s)) }])]);
  }

  const pctM = t.match(/(\d{1,2})\s?%/);
  if (/(reduce|cut|lower|decrease|trim).*(budget|cost|spend)/.test(t)) {
    const pc = pctM ? +pctM[1] / 100 : 0.2; const b = c.brief.budget;
    const ops: Op[] = (["total", "influencer"] as const).filter((f) => b[f] > 0).map((f) => ({ op: "set_budget", field: f, value: b[f] * (1 - pc) }));
    const targetSpend = (b.influencer || m.budget.influencerSpend) * (1 - pc); let spend = m.budget.influencerSpend; const notes: string[] = [];
    const removable = c.assignments.filter((a) => !a.locked && !a.mandatory).map((a) => ({ a, v: (m.scores[a.influencerId]?.total ?? 50) / Math.max(a.fee, 1) })).sort((x, y) => x.v - y.v);
    for (const { a } of removable) { if (spend <= targetSpend) break; ops.push({ op: "remove_influencer", influencerId: a.influencerId }); spend -= a.fee; notes.push(`Remove ${name(a.influencerId)} (${money(a.fee, cur)}, match ${m.scores[a.influencerId]?.total ?? "—"})`); }
    if (spend > targetSpend) notes.push("Locked and mandatory creators are kept, so fees still exceed the reduced allocation — consider renegotiating.");
    return R(`To reduce the budget by ${Math.round(pc * 100)}% I would lower the envelope and release the creators that contribute least per dirham. Locked or mandatory creators are untouched.`, [P(`Reduce budget by ${Math.round(pc * 100)}%`, "Removes the lowest match-per-cost creators first so audience coverage is protected as far as possible.", ops, notes)]);
  }

  if (/replace|swap/.test(t)) {
    const byHandle = c.assignments.find((a) => m.lib[a.influencerId] && (t.includes(m.lib[a.influencerId].handle.toLowerCase()) || t.includes(m.lib[a.influencerId].name.toLowerCase())));
    const fromId = byHandle?.influencerId ?? focusId ?? [...c.assignments].filter((a) => !a.locked).sort((x, y) => (m.scores[x.influencerId]?.total ?? 0) - (m.scores[y.influencerId]?.total ?? 0))[0]?.influencerId;
    if (!fromId || !selIds.includes(fromId)) return R("Open an influencer’s profile or name them (for example “replace @handle…”) and I’ll suggest a replacement.");
    const from = m.lib[fromId]; const country = Object.keys(COUNTRIES).find((k) => t.includes(k.toLowerCase())) ?? (/\buae\b|emirates/.test(t) ? "United Arab Emirates" : undefined);
    const cs = (i: Influencer) => i.audience?.countries?.find((x) => x.name === country)?.weight ?? 0;
    const seg = m.scores[fromId]?.bestSegment;
    const alts = m.pool.filter((i) => !selIds.includes(i.id) && !c.rejected.includes(i.id))
      .map((i) => ({ i, v: (country ? cs(i) * 120 : 0) + (m.scores[i.id]?.total ?? 0) + (seg && m.scores[i.id]?.bestSegment?.segmentId === seg.segmentId ? 15 : 0) - Math.abs(Math.log10(i.followers / from.followers)) * 12 }))
      .filter((x) => !country || cs(x.i) > cs(from)).sort((a, b) => b.v - a.v).slice(0, 2);
    if (!alts.length) return R(`I couldn’t find a stronger alternative to ${from.name} in the current pool. Try widening discovery filters.`);
    return R(`Here ${alts.length > 1 ? "are two options" : "is an option"} to replace ${from.name}${country ? ` with a stronger ${country} audience` : ""}.`, alts.map(({ i }) => P(`Replace ${from.name} with ${i.name}`, `${i.name} (@${i.handle}) — match ${m.scores[i.id].total} vs ${m.scores[fromId]?.total}${country ? `; ${Math.round(cs(i) * 100)}% ${country} audience vs ${Math.round(cs(from) * 100)}%` : ""}. Message assignments carry over; the content plan and schedule should be regenerated.`, [{ op: "replace_influencer", influencerId: fromId, toId: i.id }])));
  }

  if (/(every|all|each).*(service|message|topic).*(cover|assign)|uncovered|cover.*(factsheet|every|all)/.test(t)) {
    const gaps = m.matrix.filter((r) => r.status === "uncovered" || r.status === "no_owner");
    if (!gaps.length) return R("Every message and service in the messaging library already has a primary owner.");
    const load: Record<string, number> = Object.fromEntries(c.assignments.map((a) => [a.influencerId, Object.values(a.messages).filter((l) => l === "primary").length]));
    const ops: Op[] = []; const notes: string[] = [];
    for (const g of gaps) {
      const best = c.assignments.filter((a) => !a.plan?.locked).sort((x, y) => load[x.influencerId] - load[y.influencerId] || (m.scores[y.influencerId]?.total ?? 0) - (m.scores[x.influencerId]?.total ?? 0))[0];
      if (!best) break; load[best.influencerId]++;
      ops.push({ op: "assign_message", messageId: g.message.id, influencerId: best.influencerId, level: "primary" });
      notes.push(`“${g.message.text.slice(0, 70)}${g.message.text.length > 70 ? "…" : ""}” → ${name(best.influencerId)}`);
    }
    return R(`${gaps.length} message(s) have no primary owner. I’d give each to the creator with the lightest message load.`, [P("Cover every message", "Assigns a primary owner to each uncovered message. Existing assignments are not changed.", ops, notes)]);
  }

  if (/educational|explainer|tutorial|how-to/.test(t) && /assign|more|add/.test(t)) {
    const tierWord = /nano/.test(t) ? ["nano"] : /macro/.test(t) ? ["macro"] : /mid/.test(t) ? ["mid"] : ["micro", "nano"];
    const targets = c.assignments.filter((a) => m.lib[a.influencerId] && tierWord.includes(tierOf(m.lib[a.influencerId].followers)));
    if (!targets.length) return R(`There are no ${tierWord[0]}-tier creators in the current selection.`);
    return R(`I can add one educational piece to each of the ${targets.length} ${tierWord.join("/")}-tier creator(s).`, [P("More educational content", "Smaller creators typically earn higher trust and saves on explainer content. Fees are not changed automatically — review them after accepting.", targets.map((a) => ({ op: "add_deliverable", influencerId: a.influencerId, format: "educational", count: 1 })), targets.map((a) => `${name(a.influencerId)}: +1 educational`))]);
  }

  if (/schedule|publishing|calendar|timeline/.test(t)) {
    if (!c.events.length) return R("There is no schedule yet. I can generate one from the content plan.", [P("Generate schedule", "Creates attendance, filming, deadlines and publishing dates from each creator’s deliverables.", [{ op: "regenerate_schedule" }])]);
    const pubs = c.events.filter((e) => ["publish", "pre_event", "post_event"].includes(e.type));
    const byDay: Record<string, typeof pubs> = {}; for (const e of pubs) (byDay[e.date] ??= []).push(e);
    const ops: Op[] = []; const notes: string[] = []; const count: Record<string, number> = Object.fromEntries(Object.entries(byDay).map(([d, l]) => [d, l.length]));
    const evSet = new Set(c.brief.eventStart ? [c.brief.eventStart, c.brief.eventEnd] : []);
    for (const [day, list] of Object.entries(byDay)) {
      if (list.length <= 3 || (c.brief.eventStart && day >= c.brief.eventStart && day <= (c.brief.eventEnd || c.brief.eventStart))) continue;
      list.slice(3).forEach((e, i) => { let d = day; for (let k = 1; k < 10; k++) { const cand = addDays(day, (i % 2 ? -1 : 1) * Math.ceil(k / 1)); if ((count[cand] ?? 0) < 3 && !evSet.has(cand)) { d = cand; break; } } if (d !== day) { count[d] = (count[d] ?? 0) + 1; count[day]--; ops.push({ op: "move_event", eventId: e.id, date: d }); notes.push(`${e.title}: ${day} → ${d}`); } });
    }
    for (const x of m.conflicts.filter((k) => k.kind === "Publishing deadline" && k.eventIds.length === 2)) { const pub = c.events.find((e) => e.id === x.eventIds[0]); const ap = c.events.find((e) => e.id === x.eventIds[1]); if (pub && ap) { ops.push({ op: "move_event", eventId: ap.id, date: addDays(pub.date, -2) }); notes.push(`${ap.title}: moved to 2 days before publishing`); } }
    if (!ops.length) return R("The publishing schedule is already well spread: no more than three posts land on any non-event day and approvals precede publishing.");
    return R("I’d spread out clustered publishing days so creators don’t compete for attention, and fix approvals that land after publishing.", [P("Smoother publishing schedule", "Caps non-event days at three posts and keeps every approval ahead of its publish date.", ops, notes)]);
  }

  if (/balanced|rebalance|better mix/.test(t)) {
    const sc = buildScenario("balanced", m.pool, m.scores, c.brief, c.assignments, m.lib, c.rejected);
    const add = sc.ids.filter((id) => !selIds.includes(id)), remove = selIds.filter((id) => !sc.ids.includes(id));
    if (!add.length && !remove.length) return R("The current selection already matches the balanced recommendation.");
    return R("Here is a more balanced mix. Locked, mandatory and manually added creators are kept.", [P("Balanced creator mix", `Estimated reach ${compact(sc.forecast.reach)} for ${money(sc.cost, cur)} with an average match of ${sc.avgScore}.`, [...remove.map((id): Op => ({ op: "remove_influencer", influencerId: id })), ...add.map((id): Op => ({ op: "add_influencer", influencerId: id }))], [...remove.map((id) => `Remove ${name(id)}`), ...add.map((id) => `Add ${name(id)}`)])]);
  }

  if (/find|more influencers|increase.*coverage|coverage among|add.*(influencer|creator)|target/.test(t)) {
    const lang = LANGUAGES.find((l) => t.includes(l.toLowerCase()));
    const seg = matchSegment(text, c) ?? (lang ? c.brief.segments.find((s) => s.languages.includes(lang)) : undefined) ?? m.coverage.filter((x) => x.status === "under").map((x) => c.brief.segments.find((s) => s.id === x.segmentId))[0];
    const youth = /youth|young|gen ?z|students?/.test(t);
    let cands: Influencer[] = seg ? gapCandidates(seg.id, m.pool, m.scores, c.brief, selIds, c.rejected, 6) : m.pool.filter((i) => !selIds.includes(i.id) && !c.rejected.includes(i.id)).sort((a, b) => m.scores[b.id].total - m.scores[a.id].total).slice(0, 6);
    if (lang && !seg) cands = m.pool.filter((i) => !selIds.includes(i.id)).sort((a, b) => (b.audience?.languages?.find((x) => x.name === lang)?.weight ?? 0) - (a.audience?.languages?.find((x) => x.name === lang)?.weight ?? 0)).slice(0, 6);
    if (youth) cands = [...cands].sort((a, b) => (b.audience?.ages?.filter((x) => x.name === "18-24" || x.name === "13-17").reduce((s, x) => s + x.weight, 0) ?? 0) - (a.audience?.ages?.filter((x) => x.name === "18-24" || x.name === "13-17").reduce((s, x) => s + x.weight, 0) ?? 0));
    cands = cands.slice(0, 3);
    if (!cands.length) return R("There are no further candidates in the discovery pool for that audience. Run a new search in Discover or import more creators.");
    const label = seg ? `“${seg.name}”` : lang ? `${lang}-speaking audiences` : "the brief";
    return R(`I found ${cands.length} unselected creator(s) who would strengthen coverage of ${label}${youth ? ", prioritising younger audiences" : ""}. Accept them together or individually.`, [
      P(`Add ${cands.length} creators for ${label}`, cands.map((i) => `${i.name} (match ${m.scores[i.id].total}${seg ? `, ~${Math.round((segmentShare(i, seg) ?? 0) * 100)}% segment share` : ""})`).join("; "), cands.map((i) => ({ op: "add_influencer", influencerId: i.id }))),
      ...cands.map((i) => P(`Add ${i.name} only`, `${compact(i.followers)} followers on ${i.platform}; est. fee ${money(m.scores[i.id].estFee, cur)}.`, [{ op: "add_influencer", influencerId: i.id }])),
    ]);
  }

  return R("I can help with the plan. Try asking me to:\n\n• Find more influencers for a specific audience\n• Reduce the campaign budget by a percentage\n• Replace an influencer with a stronger alternative\n• Make sure every service in the factsheet is covered\n• Assign more educational content to micro-influencers\n• Recommend a better publishing schedule\n• Create a more balanced mix of influencers\n• Generate a shorter presentation for senior management\n• Identify weaknesses in the current campaign\n\nConnect an Anthropic API key (see Settings) for open-ended requests.");
}
