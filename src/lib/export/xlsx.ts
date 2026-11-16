import type { Model } from "../model";
import { formatInfo, platformLabel, tierLabel, tierOf } from "../constants";
import { MESSAGE_TYPE_LABEL } from "../analysis";
import { toCSV } from "../utils";

const SRC = { demo: "Demonstration data (not verified)", modash: "Modash", manual: "Manual", csv: "CSV import" };

/** Campaign planning workbook: one sheet per planning area, with real numbers (not text) for further analysis. */
export async function exportWorkbook(m: Model): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook(); wb.creator = "Marketing Planner"; wb.created = new Date();
  const c = m.campaign, b = c.brief, B = m.budget, cur = B.currency; const sel = c.assignments.filter((a) => m.lib[a.influencerId]);
  const sheet = (name: string, cols: { header: string; width: number; numFmt?: string }[], rows: (string | number | null | undefined)[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((x) => ({ header: x.header, width: x.width, style: x.numFmt ? { numFmt: x.numFmt } : {} }));
    rows.forEach((r) => ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v ?? ""))));
    const h = ws.getRow(1); h.font = { bold: true, color: { argb: "FFFFFFFF" } }; h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D1D1F" } }; h.alignment = { vertical: "middle" }; h.height = 22;
    ws.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: "top", wrapText: true }; });
    return ws;
  };
  const money = `#,##0 "${cur}"`;
  const fc = m.forecast;
  sheet("Overview", [{ header: "Item", width: 34 }, { header: "Value", width: 60 }], [
    ["Campaign", b.name], ["Organisation", b.organisation], ["Type", b.type], ["Location", b.location], ["Campaign dates", `${b.startDate} to ${b.endDate}`], ["Event dates", b.eventStart ? `${b.eventStart} to ${b.eventEnd}` : ""], ["Publishing period", `${b.publishStart} to ${b.publishEnd}`],
    ["Objectives (priority order)", b.objectives.join("; ")], ...b.kpis.map((k) => [`KPI: ${k.label}`, k.target]), ["Main message", b.mainMessage], ["Call to action", b.cta],
    ["Total budget", B.total], ["Planned spend (incl. tax)", Math.round(B.grand)], ["Selected influencers", sel.length], ["Deliverables", fc.expected.deliverables], ["Combined followers (not reach)", fc.expected.followers],
    ["Est. unique reach — conservative", Math.round(fc.conservative.reach)], ["Est. unique reach — expected", Math.round(fc.expected.reach)], ["Est. unique reach — optimistic", Math.round(fc.optimistic.reach)],
    ["Data confidence", m.dataQuality.label], ["Note", "All forecast figures are estimates, not guaranteed outcomes."], ["Exported", new Date().toISOString()],
  ]);
  sheet("Influencers", [{ header: "Name", width: 24 }, { header: "Handle", width: 20 }, { header: "Platform", width: 12 }, { header: "Tier", width: 11 }, { header: "Followers", width: 13, numFmt: "#,##0" }, { header: "Engagement rate", width: 14, numFmt: "0.0%" }, { header: "Avg views", width: 12, numFmt: "#,##0" }, { header: "Match score", width: 11 }, { header: "Primary segment", width: 30 }, { header: "Fee", width: 15, numFmt: money }, { header: "Fee status", width: 12 }, { header: "Status", width: 20 }, { header: "Locked", width: 8 }, { header: "Mandatory", width: 10 }, { header: "Est. reach", width: 13, numFmt: "#,##0" }, { header: "Est. engagements", width: 15, numFmt: "#,##0" }, { header: "Data source", width: 30 }, { header: "Analytics updated", width: 18 }, { header: "Why selected", width: 60 }, { header: "Concerns", width: 60 }, { header: "Notes", width: 40 }],
    sel.map((a) => { const i = m.lib[a.influencerId], s = m.scores[i.id], f = fc.expected.byInfluencer.find((x) => x.influencerId === i.id); return [i.name, `@${i.handle}`, platformLabel(i.platform), tierLabel(tierOf(i.followers)), i.followers, i.engagementRate ?? null, i.avgViews ?? null, s?.total, s?.bestSegment?.name, a.fee, a.feeStatus, a.status, a.locked ? "Yes" : "", a.mandatory ? "Yes" : "", Math.round(f?.reach ?? 0), Math.round(f?.engagements ?? 0), SRC[i.source], i.fetchedAt?.slice(0, 10), s?.reasons.join("; "), s?.concerns.join("; "), a.notes]; }));
  sheet("Content plan", [{ header: "Influencer", width: 24 }, { header: "Role", width: 26 }, { header: "Segment", width: 28 }, { header: "Topic", width: 40 }, { header: "Concept", width: 60 }, { header: "Hook", width: 40 }, { header: "Storyline", width: 60 }, { header: "Talking points", width: 60 }, { header: "Mandatory information", width: 60 }, { header: "Call to action", width: 40 }, { header: "Deliverables", width: 40 }, { header: "Filming", width: 40 }, { header: "Approval", width: 40 }, { header: "Origin", width: 12 }],
    sel.map((a) => { const p = a.plan; return [m.lib[a.influencerId].name, p?.role, b.segments.find((s) => s.id === p?.segmentId)?.name, p?.topic, p?.concept, p?.hook, p?.storyline, p?.talkingPoints.join("\n"), p?.mandatoryInfo.join("\n"), p?.cta, a.deliverables.map((d) => `${d.count}x ${formatInfo(d.format).label} (${platformLabel(d.platform)})`).join("\n"), p?.filming, p?.approval, p?.origin]; }));
  const mx = sheet("Message matrix", [{ header: "Message", width: 70 }, { header: "Type", width: 20 }, { header: "Priority", width: 12 }, { header: "Status", width: 14 }, ...sel.map((a) => ({ header: m.lib[a.influencerId].name, width: 14 })), { header: "Source", width: 36 }],
    m.matrix.map((r) => [r.message.text, MESSAGE_TYPE_LABEL[r.message.type], r.message.priority, r.status, ...sel.map((a) => (a.messages[r.message.id] === "primary" ? "P" : a.messages[r.message.id] === "supporting" ? "S" : "")), c.sources.find((s) => s.id === r.message.sourceId)?.name ?? (r.message.origin === "manual" ? "Manual" : "")]));
  mx.eachRow((row, i) => { if (i > 1) for (let k = 5; k < 5 + sel.length; k++) { const cell = row.getCell(k); cell.alignment = { horizontal: "center" }; if (cell.value === "P") { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A84FF" } }; cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; } else if (cell.value === "S") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F2FD" } }; } });
  const bs = sheet("Budget", [{ header: "Line", width: 36 }, { header: "Amount", width: 18, numFmt: money }, { header: "Basis", width: 40 }], [
    ["Confirmed influencer fees", B.confirmed, "Confirmed"], ["Quoted influencer fees", B.quoted, "Quoted"], ["Estimated influencer fees", B.estimated, "Estimated"], ["Content production", B.production, ""], ["Travel and accommodation", B.travel, ""], ["Paid amplification", B.amplification, ""], ["Additional expenses", B.additional, ""], ["Subtotal", null, ""], [`Taxes (${b.budget.taxRate}%)`, null, ""], ["Planned spend", null, ""], ["Contingency (reserve)", B.contingency, "Not counted as planned spend"], ["Total campaign budget", B.total, ""], ["Remaining budget", null, ""],
  ]);
  bs.getCell("B9").value = { formula: "SUM(B2:B8)", result: B.subtotal }; bs.getCell("B10").value = { formula: `B9*${b.budget.taxRate / 100}`, result: B.taxes }; bs.getCell("B11").value = { formula: "B9+B10", result: B.grand }; bs.getCell("B14").value = { formula: "B13-B11", result: B.remaining };
  [9, 11, 13, 14].forEach((r) => { bs.getRow(r).font = { bold: true }; });
  sheet("Forecast", [{ header: "Metric", width: 34 }, { header: "Conservative", width: 16, numFmt: "#,##0" }, { header: "Expected", width: 16, numFmt: "#,##0" }, { header: "Optimistic", width: 16, numFmt: "#,##0" }], [
    ...(["reach", "impressions", "views", "engagements"] as const).map((k) => [`Estimated ${k === "reach" ? "unique reach" : k}`, Math.round(fc.conservative[k]), Math.round(fc.expected[k]), Math.round(fc.optimistic[k])]),
    ["Estimated CPM", fc.conservative.cpm ?? null, fc.expected.cpm ?? null, fc.optimistic.cpm ?? null], ["Estimated cost per engagement", fc.conservative.cpe ?? null, fc.expected.cpe ?? null, fc.optimistic.cpe ?? null], [],
    ["Segment coverage (expected)", "Share of reach", "Target", "Status"], ...m.coverage.map((s) => [s.name, `${Math.round(s.share * 100)}%`, `${Math.round(s.target * 100)}%`, s.status]), [],
    ["Method", "Estimates only. Reach uses average views or followers × format reach rate × tier factor; campaign reach is de-duplicated with an assumed overlap rate (25% / 15% / 8%). Combined followers are not reach."],
  ]);
  sheet("Schedule", [{ header: "Date", width: 12 }, { header: "Start", width: 8 }, { header: "End", width: 8 }, { header: "Type", width: 20 }, { header: "Activity", width: 46 }, { header: "Influencer", width: 24 }, { header: "Location", width: 26 }, { header: "Notes", width: 30 }],
    [...c.events].sort((x, y) => (x.date + (x.start ?? "")).localeCompare(y.date + (y.start ?? ""))).map((e) => [e.date, e.start, e.end, e.type.replace("_", " "), e.title, e.influencerId ? m.lib[e.influencerId]?.name : "", e.location, e.notes]));
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function shortlistCSV(m: Model): string {
  const sel = m.campaign.assignments.filter((a) => m.lib[a.influencerId]);
  return toCSV([["name", "handle", "platform", "profile_url", "tier", "followers", "engagement_rate_pct", "avg_views", "country", "city", "languages", "categories", "match_score", "primary_segment", "fee", "currency", "fee_status", "status", "data_source", "analytics_updated"],
    ...sel.map((a) => { const i = m.lib[a.influencerId], s = m.scores[i.id]; return [i.name, i.handle, i.platform, i.profileUrl, tierOf(i.followers), i.followers, i.engagementRate != null ? +(i.engagementRate * 100).toFixed(2) : "", i.avgViews, i.country, i.city, i.languages.join(";"), i.categories.join(";"), s?.total, s?.bestSegment?.name, a.fee, m.budget.currency, a.feeStatus, a.status, SRC[i.source], i.fetchedAt?.slice(0, 10)]; })]);
}
