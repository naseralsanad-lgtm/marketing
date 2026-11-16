import type { DeckConfig } from "../types";
import type { Model } from "../model";
import { COLLAB_STATUSES } from "../types";
import { formatInfo, platformLabel, SLIDES, tierLabel, tierOf, WEIGHT_LABELS } from "../constants";
import { MESSAGE_TYPE_LABEL } from "../analysis";
import { weaknesses } from "../assistant";
import { recommendTierMix } from "../scoring";
import { AR } from "../i18n-ar";
import { compact, fmtDate, fmtShort, money, pct } from "../utils";

export type Block =
  | { t: "kpis"; items: { label: string; value: string; sub?: string }[] }
  | { t: "bullets"; heading?: string; items: string[] }
  | { t: "text"; heading?: string; text: string }
  | { t: "table"; heading?: string; head: string[]; rows: string[][]; widths?: number[]; matrix?: boolean }
  | { t: "chart"; kind: "bar" | "pie"; heading?: string; labels: string[]; values: number[]; unit: "pct" | "num" };
export interface Slide { id: string; base: string; kind: "cover" | "content"; title: string; subtitle?: string; left: Block[]; right?: Block[]; note?: string; meta?: string[] }

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/**
 * One slide model feeds the on-screen preview, the PDF/print view and the editable PowerPoint export,
 * so every change to the campaign flows into all three.
 */
export function buildDeck(m: Model, opts: { all?: boolean; collect?: Set<string> } = {}): Slide[] {
  const c = m.campaign, b = c.brief, d: DeckConfig = c.deck, cur = m.budget.currency; const fc = m.forecast.expected; const B = m.budget;
  const lang = d.language; const loc = lang === "ar" ? "ar-AE" : "en-GB";
  /** fixed UI label */
  const L = (s: string, short = false) => lang === "en" ? s : lang === "ar" ? AR[s] ?? s : short || !AR[s] ? s : `${s}  ·  ${AR[s]}`;
  /** campaign content (user/AI text): translated only when an AI translation exists */
  const C = (s: string) => { if (!s) return s; opts.collect?.add(s); return lang === "ar" ? d.translations?.[s] ?? s : s; };
  const D = (s?: string) => fmtDate(s, { day: "numeric", month: "short", year: "numeric" }, loc);
  const sel = c.assignments.filter((a) => m.lib[a.influencerId]);
  const inf = (id: string) => m.lib[id];
  const byMsg = Object.fromEntries(c.messages.map((x) => [x.id, x]));
  const est = L("Estimates, not guaranteed outcomes.");
  const out: Slide[] = [];
  const S = (base: string, s: Omit<Slide, "id" | "base" | "kind" | "title"> & { title?: string; kind?: Slide["kind"] }, n = 0) => out.push({ id: n ? `${base}-${n + 1}` : base, base, kind: "content", title: L(SLIDES.find((x) => x.id === base)!.title) + (n ? ` (${n + 1})` : ""), ...s } as Slide);

  const builders: Record<string, () => void> = {
    cover: () => S("cover", { kind: "cover", title: C(d.title || b.name || "Campaign"), subtitle: L(d.subtitle) , left: [], meta: [C(b.organisation), b.startDate ? `${D(b.startDate)} – ${D(b.endDate)}` : "", C(b.location)].filter(Boolean) }),
    summary: () => S("summary", {
      left: [{ t: "text", text: C(b.summary || b.description || b.mainMessage) }],
      right: [{ t: "kpis", items: [
        { label: L("Total campaign budget"), value: money(B.total, cur) }, { label: L("Selected influencers"), value: String(sel.length) },
        { label: L("Estimated unique reach"), value: compact(fc.reach) }, { label: L("Estimated engagements"), value: compact(fc.engagements) },
        { label: L("Content deliverables"), value: String(fc.deliverables) }, { label: L("Campaign duration"), value: `${m.durationDays} ${L("days", true)}` } ] }],
      note: est,
    }),
    background: () => S("background", {
      left: [{ t: "text", heading: L("Campaign Background"), text: C(b.background || b.description) }, ...(b.mainMessage ? [{ t: "text" as const, heading: L("Main campaign message"), text: C(b.mainMessage) }] : [])],
      right: [{ t: "table", head: [L("Item", true), L("Detail", true)], rows: [[L("Campaign type", true), C(b.type)], [L("Organisation", true), C(b.organisation)], [L("Location", true), C(b.location)], [L("Campaign dates", true), `${D(b.startDate)} – ${D(b.endDate)}`], ...(b.eventStart ? [[L("Event dates", true), `${D(b.eventStart)} – ${D(b.eventEnd)}`]] : []), [L("Publishing period", true), `${D(b.publishStart)} – ${D(b.publishEnd)}`], [L("Call to action", true), C(b.cta)]].filter((r) => r[1] && r[1] !== "— – —"), widths: [1, 2.2] }],
    }),
    objectives: () => S("objectives", {
      left: [{ t: "bullets", heading: L("Objectives in priority order"), items: b.objectives.map((o, i) => `${i + 1}. ${L(o, true)}`) }],
      right: b.kpis.filter((k) => k.label).length ? [{ t: "table", heading: L("KPIs and targets"), head: [L("KPI", true), L("Target", true)], rows: b.kpis.filter((k) => k.label).map((k) => [C(k.label), k.target]), widths: [2, 1] }] : undefined,
    }),
    audience: () => S("audience", {
      left: [{ t: "table", head: [L("Segment", true), L("Role", true), L("Priority", true), L("Languages", true), L("Age groups", true), L("Target", true)], rows: b.segments.map((s) => [C(s.name), L(s.role === "primary" ? "Primary" : "Secondary", true), `P${s.priority}`, s.languages.map((l) => L(l, true)).join(", ") || "—", s.ageGroups.join(", ") || "—", `${s.coverageTarget}%`]), widths: [2.2, 1, 0.7, 1.4, 1.5, 0.7] }],
      right: [{ t: "chart", kind: "pie", heading: L("Desired coverage by segment"), labels: b.segments.map((s) => C(s.name)), values: b.segments.map((s) => s.coverageTarget), unit: "pct" }],
      note: L("Audience matching uses audience language, location, age and gender analytics only."),
    }),
    strategy: () => {
      const tiers = m.dist.tiers; const mix = sel.length ? tiers.map((t) => `${L(tierLabel(t.name as "micro"), true)}: ${sel.filter((a) => tierOf(inf(a.influencerId).followers) === t.name).length}`) : recommendTierMix(b).map((t) => `${t.tier}: ${t.share}%`);
      S("strategy", {
        left: [{ t: "bullets", heading: L("Strategic approach"), items: [
          L("Cover every audience segment in proportion to its priority rather than maximising total reach."),
          L("Give each creator a distinct role and message so the campaign tells one story from many voices."),
          L("Blend anchor names for awareness with community creators for trust and action."),
          ...(b.eventStart ? [L("Build momentum before the event, saturate during it and convert interest afterwards.")] : []),
          `${L("Creator mix")}: ${mix.join(" · ")}` ] }],
        right: [{ t: "chart", kind: "pie", heading: L("Influencer distribution by tier"), labels: tiers.map((t) => L(tierLabel(t.name as "micro"), true)), values: tiers.map((t) => sel.filter((a) => tierOf(inf(a.influencerId).followers) === t.name).length), unit: "num" }],
      });
    },
    messages: () => {
      const order = ["mandatory", "high", "supporting", "optional"]; const list = c.messages.filter((x) => x.type !== "restriction").sort((x, y) => order.indexOf(x.priority) - order.indexOf(y.priority));
      const restr = c.messages.filter((x) => x.type === "restriction");
      chunk(list.slice(0, 27), 9).forEach((rows, n) => S("messages", { left: [{ t: "table", head: [L("Message", true), L("Type", true), L("Priority", true)], rows: rows.map((x) => [C(x.text), L(MESSAGE_TYPE_LABEL[x.type], true), L(x.priority === "high" ? "High priority" : x.priority[0].toUpperCase() + x.priority.slice(1), true)]), widths: [5, 1.3, 1] }], right: n === 0 && restr.length ? [{ t: "bullets", heading: L("Communication restrictions"), items: restr.slice(0, 7).map((x) => C(x.text)) }] : undefined }, n));
      if (!list.length) S("messages", { left: [{ t: "text", text: C(b.mainMessage) || "—" }] });
    },
    influencers: () => chunk(sel, 10).forEach((rows, n) => S("influencers", {
      left: [{ t: "table", head: [L("Influencer", true), L("Platform", true), L("Tier", true), L("Followers", true), L("Engagement", true), L("Match", true), L("Primary segment", true), L("Fee", true)], rows: rows.map((a) => { const i = inf(a.influencerId); return [`${i.name}  @${i.handle}`, platformLabel(i.platform), L(tierLabel(tierOf(i.followers)), true), compact(i.followers), pct(i.engagementRate), String(m.scores[i.id]?.total ?? "—"), C(m.scores[i.id]?.bestSegment?.name ?? "—"), `${money(a.fee, cur)}${a.feeStatus === "estimated" ? "*" : ""}`]; }), widths: [2.6, 1, 0.9, 0.9, 1, 0.7, 2, 1.3] }],
      note: `* ${L("Estimated fee")}. ${m.dataQuality.demo ? L("Includes demonstration profiles: figures are illustrative, not verified analytics.") : ""}`,
    }, n)),
    profiles: () => chunk(sel, 3).forEach((group, n) => S("profiles", {
      left: [{ t: "table", head: ["", ...group.map((a) => inf(a.influencerId).name)], rows: [
        [L("Handle", true), ...group.map((a) => `@${inf(a.influencerId).handle} · ${platformLabel(inf(a.influencerId).platform)}`)],
        [L("Followers", true), ...group.map((a) => compact(inf(a.influencerId).followers))],
        [L("Engagement", true), ...group.map((a) => pct(inf(a.influencerId).engagementRate))],
        [L("Avg. views", true), ...group.map((a) => compact(inf(a.influencerId).avgViews))],
        [L("Top audience", true), ...group.map((a) => (inf(a.influencerId).audience?.countries ?? []).slice(0, 2).map((x) => `${x.name} ${Math.round(x.weight * 100)}%`).join(", ") || "—")],
        [L("Languages", true), ...group.map((a) => inf(a.influencerId).languages.join(", ") || "—")],
        [L("Content", true), ...group.map((a) => C(inf(a.influencerId).categories.join(", ")) || "—")],
        [L("Authenticity", true), ...group.map((a) => pct(inf(a.influencerId).audience?.credibility, 0))],
        [L("Campaign role", true), ...group.map((a) => C(a.plan?.role ?? "—"))],
        [L("Data source", true), ...group.map((a) => ({ demo: L("Demo data", true), modash: "Modash", manual: L("Manual", true), csv: "CSV" }[inf(a.influencerId).source]))],
      ], widths: [1.2, ...group.map(() => 2.6)] }],
    }, n)),
    rationale: () => chunk(sel, 7).forEach((rows, n) => S("rationale", {
      left: [{ t: "table", head: [L("Influencer", true), L("Match", true), L("Why selected", true), L("Watch-outs", true)], rows: rows.map((a) => { const s = m.scores[a.influencerId]; return [inf(a.influencerId).name, String(s?.total ?? "—"), C(s?.reasons.slice(0, 3).join("; ") || (a.manual ? "Selected manually by the campaign team" : "—")), C([...(s?.concerns ?? []).slice(0, 2), ...(s?.missing.length ? [`Missing data: ${s.missing.slice(0, 2).join(", ")}`] : [])].join("; ") || "—")]; }), widths: [1.8, 0.7, 4, 3.2] }],
      note: n === 0 ? `${L("Scoring weights")}: ${(Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[]).map((k) => `${L(WEIGHT_LABELS[k], true)} ${c.weights[k]}%`).join(" · ")}` : undefined,
    }, n)),
    content: () => chunk(sel, 8).forEach((rows, n) => S("content", {
      left: [{ t: "table", head: [L("Influencer", true), L("Campaign role", true), L("Topic", true), L("Formats", true), L("Segment", true)], rows: rows.map((a) => [inf(a.influencerId).name, C(a.plan?.role ?? "—"), C(cut(a.plan?.topic ?? "—", 70)), a.deliverables.map((x) => `${x.count}× ${L(formatInfo(x.format).label, true)}`).join(", "), C(b.segments.find((s) => s.id === a.plan?.segmentId)?.name ?? m.scores[a.influencerId]?.bestSegment?.name ?? "—")]), widths: [1.8, 2, 3, 2.6, 1.8] }],
    }, n)),
    concepts: () => chunk(sel.filter((a) => a.plan), 2).forEach((group, n) => S("concepts", {
      left: group[0] ? conceptBlocks(group[0]) : [], right: group[1] ? conceptBlocks(group[1]) : undefined,
    }, n)),
    matrix: () => {
      const rows = m.matrix; if (!rows.length || !sel.length) return;
      chunk(sel, 12).forEach((cols, ci) => chunk(rows, 11).forEach((rs, n) => S("matrix", {
        left: [{ t: "table", matrix: true, head: [L("Message / service", true), ...cols.map((a) => inf(a.influencerId).name.split(" ")[0])], rows: rs.map((r) => [C(cut(r.message.text, 64)), ...cols.map((a) => (a.messages[r.message.id] === "primary" ? "P" : a.messages[r.message.id] === "supporting" ? "S" : ""))]), widths: [4.2, ...cols.map(() => 0.62)] }],
        note: `P = ${L("Primary message ownership", true)} · S = ${L("Supporting coverage", true)}${m.alerts.filter((x) => x.level === "critical").length ? ` · ${m.alerts.filter((x) => x.level === "critical").length} ${L("message(s) not yet assigned", true)}` : ""}`,
      }, ci * 10 + n)));
    },
    deliverables: () => {
      const byFormat: Record<string, number> = {}, byPlat: Record<string, number> = {};
      for (const a of sel) for (const x of a.deliverables) { byFormat[x.format] = (byFormat[x.format] ?? 0) + x.count; byPlat[x.platform] = (byPlat[x.platform] ?? 0) + x.count; }
      S("deliverables", {
        left: [{ t: "table", head: [L("Format", true), L("Quantity", true)], rows: Object.entries(byFormat).sort((x, y) => y[1] - x[1]).map(([f, n]) => [L(formatInfo(f as "reel").label, true), String(n)]), widths: [3, 1] }],
        right: [{ t: "chart", kind: "pie", heading: L("Deliverables by platform"), labels: Object.keys(byPlat).map((p) => platformLabel(p as "instagram")), values: Object.values(byPlat), unit: "num" }],
      });
    },
    distribution: () => S("distribution", {
      left: [{ t: "chart", kind: "bar", heading: L("Audience geographic distribution"), labels: m.dist.countries.map((x) => x.name), values: m.dist.countries.map((x) => +(x.weight * 100).toFixed(1)), unit: "pct" }, { t: "chart", kind: "bar", heading: L("Age distribution"), labels: m.dist.ages.map((x) => x.name), values: m.dist.ages.map((x) => +(x.weight * 100).toFixed(1)), unit: "pct" }],
      right: [{ t: "chart", kind: "bar", heading: L("Language distribution"), labels: m.dist.languages.map((x) => x.name), values: m.dist.languages.map((x) => +(x.weight * 100).toFixed(1)), unit: "pct" }, { t: "chart", kind: "bar", heading: L("Target audience coverage"), labels: m.coverage.map((x) => C(x.name)), values: m.coverage.map((x) => +(x.share * 100).toFixed(1)), unit: "pct" }],
      note: `${L("Reach-weighted, from creators with audience data.")} ${est}`,
    }),
    impact: () => S("impact", {
      left: [{ t: "kpis", items: [{ label: L("Estimated unique reach"), value: compact(fc.reach) }, { label: L("Estimated total impressions"), value: compact(fc.impressions) }, { label: L("Estimated video views"), value: compact(fc.views) }, { label: L("Estimated engagements"), value: compact(fc.engagements) }] },
        { t: "table", head: [L("Scenario", true), L("Reach", true), L("Impressions", true), L("Views", true), L("Engagements", true)], rows: (["conservative", "expected", "optimistic"] as const).map((k) => [L(k[0].toUpperCase() + k.slice(1), true), compact(m.forecast[k].reach), compact(m.forecast[k].impressions), compact(m.forecast[k].views), compact(m.forecast[k].engagements)]), widths: [1.6, 1, 1, 1, 1] }],
      right: [{ t: "chart", kind: "bar", heading: L("Estimated unique reach by scenario"), labels: [L("Conservative", true), L("Expected", true), L("Optimistic", true)], values: [m.forecast.conservative.reach, fc.reach, m.forecast.optimistic.reach].map(Math.round), unit: "num" }],
      note: `${est} ${L("Combined follower base")}: ${compact(fc.followers)} (${L("not reach", true)}). ${L("Confidence")}: ${L(m.dataQuality.label, true)}.`,
    }),
    budget: () => S("budget", {
      left: [{ t: "table", head: [L("Budget line", true), L("Amount", true), L("Share", true)], rows: ([["Confirmed influencer fees", B.confirmed], ["Quoted influencer fees", B.quoted], ["Estimated influencer fees", B.estimated], ["Content production", B.production], ["Travel and accommodation", B.travel], ["Paid amplification", B.amplification], ["Additional expenses", B.additional], ["Taxes", B.taxes]] as const).filter(([, v]) => v > 0).map(([l, v]) => [L(l, true), money(v, cur), B.grand ? `${Math.round((v / B.grand) * 100)}%` : "—"]).concat([[L("Planned spend", true), money(B.grand, cur), "100%"], [L("Contingency (reserve)", true), money(B.contingency, cur), ""], [L("Total campaign budget", true), money(B.total, cur), ""], [L("Remaining budget", true), money(B.remaining, cur), ""]]), widths: [2.6, 1.6, 0.8] }],
      right: [{ t: "chart", kind: "pie", heading: L("Budget allocation"), labels: [L("Influencer fees", true), L("Production", true), L("Paid amplification", true), L("Travel", true), L("Additional", true), L("Taxes", true)], values: [B.influencerSpend, B.production, B.amplification, B.travel, B.additional, B.taxes].map(Math.round), unit: "num" }],
      note: B.over ? L("Planned spend currently exceeds the total budget.") : undefined,
    }),
    efficiency: () => {
      const rows = sel.map((a) => { const f = fc.byInfluencer.find((x) => x.influencerId === a.influencerId); return { a, cpm: f?.impressions ? (a.fee / f.impressions) * 1000 : 0, cpe: f?.engagements ? a.fee / f.engagements : 0, f }; }).sort((x, y) => x.cpm - y.cpm);
      S("efficiency", {
        left: [{ t: "kpis", items: [{ label: L("Estimated CPM"), value: fc.cpm ? `${cur} ${fc.cpm.toFixed(0)}` : "—" }, { label: L("Estimated cost per engagement"), value: fc.cpe ? `${cur} ${fc.cpe.toFixed(2)}` : "—" }, { label: L("Budget utilisation"), value: B.total ? `${Math.round(B.utilisation * 100)}%` : "—" }] },
          { t: "table", head: [L("Influencer", true), L("Fee", true), L("Est. reach", true), L("Est. CPM", true), L("Cost / engagement", true)], rows: rows.slice(0, 9).map(({ a, cpm, cpe, f }) => [inf(a.influencerId).name, money(a.fee, cur), compact(f?.reach ?? 0), cpm ? cpm.toFixed(0) : "—", cpe ? cpe.toFixed(2) : "—"]), widths: [2.4, 1.4, 1, 1, 1.2] }],
        note: `${L("Campaign CPM includes production, amplification and taxes; per-creator figures use the fee only.")} ${est}`,
      });
    },
    timeline: () => {
      const phases: string[][] = [];
      if (b.publishStart && b.eventStart) phases.push([L("Pre-event", true), `${D(b.publishStart)} – ${D(b.eventStart)}`, C(b.preEvent || "Teasers and registration drive")]);
      if (b.eventStart) phases.push([L("During event", true), `${D(b.eventStart)} – ${D(b.eventEnd)}`, C(b.duringEvent || "On-ground coverage")]);
      if (b.eventStart && b.publishEnd) phases.push([L("Post-event", true), `${D(b.eventEnd)} – ${D(b.publishEnd)}`, C(b.postEvent || "Highlights and follow-up")]);
      if (!phases.length) phases.push([L("Campaign", true), `${D(b.startDate)} – ${D(b.endDate)}`, C(b.description)]);
      const count = (types: string[]) => c.events.filter((e) => types.includes(e.type)).length;
      S("timeline", {
        left: [{ t: "table", head: [L("Phase", true), L("Dates", true), L("Focus", true)], rows: phases, widths: [1.2, 2, 4.5] }],
        right: [{ t: "table", heading: L("Scheduled activity"), head: [L("Activity", true), L("Count", true)], rows: [[L("Publishing", true), String(count(["publish", "pre_event", "post_event"]))], [L("Attendance", true), String(count(["attendance"]))], [L("Filming", true), String(count(["filming"]))], [L("Stage, podcast and interviews", true), String(count(["stage", "podcast", "interview", "live"]))], [L("Submission and approval deadlines", true), String(count(["submission", "approval"]))]], widths: [3, 1] }],
      });
    },
    attendance: () => {
      const ev = c.events.filter((e) => ["attendance", "stage", "podcast", "interview", "live", "filming", "event"].includes(e.type) && e.type !== "filming").sort((x, y) => (x.date + (x.start ?? "")).localeCompare(y.date + (y.start ?? "")));
      chunk(ev, 11).forEach((rows, n) => S("attendance", { left: [{ t: "table", head: [L("Date", true), L("Time", true), L("Influencer", true), L("Activity", true), L("Location", true)], rows: rows.map((e) => [fmtShort(e.date, loc), e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "—", e.influencerId ? inf(e.influencerId)?.name ?? "—" : "—", C(e.title.split(" — ")[0]), C(e.location ?? "—")]), widths: [1, 1.2, 2.2, 2.6, 2] }] }, n));
    },
    publishing: () => {
      const ev = c.events.filter((e) => ["publish", "pre_event", "post_event"].includes(e.type)).sort((x, y) => x.date.localeCompare(y.date));
      chunk(ev, 12).forEach((rows, n) => S("publishing", { left: [{ t: "table", head: [L("Date", true), L("Influencer", true), L("Content", true), L("Platform", true), L("Phase", true)], rows: rows.map((e) => [fmtShort(e.date, loc), e.influencerId ? inf(e.influencerId)?.name ?? "—" : "—", C(e.title.replace(/^Publish /, "").split(" — ")[0]), e.notes ? platformLabel(e.notes as "instagram") : "—", L(e.type === "pre_event" ? "Pre-event" : e.type === "post_event" ? "Post-event" : "During event", true)]), widths: [1, 2.2, 3, 1.2, 1.2] }] }, n));
    },
    approvals: () => chunk(sel, 8).forEach((rows, n) => S("approvals", {
      left: [{ t: "table", head: [L("Influencer", true), L("Status", true), L("Approval requirements", true), L("Filming requirements", true)], rows: rows.map((a) => [inf(a.influencerId).name, L(a.status, true), C(cut(a.plan?.approval ?? a.ops.approvals ?? "—", 110)), C(cut(a.plan?.filming ?? a.ops.production ?? "—", 110))]), widths: [1.8, 1.4, 3.6, 3.6] }],
    }, n)),
    risks: () => {
      const auto = weaknesses(m).filter((w) => !/No material|No influencers/.test(w)).slice(0, 4).map((w) => [C(w), C(/budget|fees|spend/i.test(w) ? "Firm up quotations and apply the cost options in the budget view." : /coverage|reach against/i.test(w) ? "Add creators for the under-served segment or shift deliverables." : /message/i.test(w) ? "Assign a primary owner in the message matrix before briefing." : /schedul/i.test(w) ? "Resolve conflicts in the schedule before contracts are issued." : /demonstration|analytics/i.test(w) ? "Refresh profiles with verified analytics before final approval." : "Review with the campaign lead.")]);
      const std = [["Creator availability or late withdrawal", "Keep two alternates per segment from the shortlist; contract early."], ["Off-message or non-compliant content", "Mandatory script and final-cut approval; restrictions listed in every brief."], ["Under-delivery against estimates", "Track actuals weekly; reallocate paid amplification to top performers."], ["Late content submissions", "Submission deadlines five days before publishing with staged reminders."]].map((r) => r.map((x) => C(x)));
      S("risks", { left: [{ t: "table", head: [L("Risk", true), L("Mitigation", true)], rows: [...auto, ...std].slice(0, 8), widths: [1, 1] }] });
    },
    next: () => {
      const confirmed = sel.filter((a) => COLLAB_STATUSES.indexOf(a.status) >= 6).length;
      S("next", {
        left: [{ t: "bullets", heading: L("Recommendation"), items: [
          C(`Approve the ${sel.length}-creator plan covering ${m.coverage.filter((x) => x.status !== "under").length} of ${m.coverage.length || 0} audience segments on target, within a planned spend of ${money(B.grand, cur)}.`),
          C(`Estimated unique reach of ${compact(m.forecast.conservative.reach)}–${compact(m.forecast.optimistic.reach)} (expected ${compact(fc.reach)}).`),
          ...(m.coverage.filter((x) => x.status === "under").map((x) => C(`Strengthen coverage of “${x.name}” before launch.`))) ] }],
        right: [{ t: "bullets", heading: L("Next steps"), items: [
          C(`Confirm the remaining ${sel.length - confirmed} of ${sel.length} collaborations and issue contracts.`),
          C("Approve creator briefs and mandatory messaging."), C("Lock the attendance schedule and accreditation."), C("Set up weekly performance tracking against the forecast."), ...(b.startDate ? [C(`Campaign start: ${D(b.startDate)}.`)] : []) ] }],
      });
    },
  };

  function conceptBlocks(a: (typeof sel)[number]): Block[] {
    const i = inf(a.influencerId), p = a.plan!;
    const msgs = Object.entries(a.messages).filter(([, l]) => l === "primary").map(([id]) => byMsg[id]?.text).filter(Boolean).slice(0, 2);
    return [
      { t: "text", heading: `${i.name} — ${C(p.role)}`, text: C(p.concept) },
      { t: "bullets", items: [`${L("Opening hook", true)}: ${C(p.hook)}`, `${L("Formats", true)}: ${a.deliverables.map((x) => `${x.count}× ${L(formatInfo(x.format).label, true)}`).join(", ")}`, ...msgs.map((x) => `${L("Message", true)}: ${C(cut(x, 110))}`), `${L("Call to action", true)}: ${C(cut(p.cta, 110))}`] },
    ];
  }

  for (const id of d.order.filter((x) => builders[x])) { if (!opts.all && d.hidden.includes(id)) continue; builders[id](); }
  // per-page overrides (edited titles / bullets)
  for (const s of out) {
    const o = d.overrides[s.id]; if (!o) continue;
    if (o.title) s.title = o.title;
    if (o.bullets) { let k = 0; for (const blk of [...s.left, ...(s.right ?? [])]) { if (blk.t === "bullets" || blk.t === "text") { const v = o.bullets[k]; if (v) { if (blk.t === "bullets") blk.items = v; else blk.text = v.join("\n"); } k++; } } }
  }
  return out;
}

/** Every piece of campaign content in the deck (for AI translation). */
export function deckContentStrings(m: Model): string[] {
  const set = new Set<string>(); buildDeck({ ...m, campaign: { ...m.campaign, deck: { ...m.campaign.deck, language: "en" } } }, { all: true, collect: set });
  return [...set].filter((s) => /[A-Za-z]{3}/.test(s));
}
