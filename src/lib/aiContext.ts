import type { Model } from "./model";
import { SLIDES, tierOf } from "./constants";

/** Compact, id-bearing campaign snapshot sent to the AI. Contains no contact details. */
export function assistantContext(m: Model): string {
  const c = m.campaign, b = c.brief;
  const inf = (id: string, full = false) => { const i = m.lib[id]; const s = m.scores[id]; return { id, name: i.name, handle: i.handle, platform: i.platform, tier: tierOf(i.followers), followers: i.followers, er: i.engagementRate, languages: i.languages, categories: i.categories, style: i.contentStyle, match: s?.total, bestSegment: s?.bestSegment?.name, estFee: s?.estFee, source: i.source, topCountries: i.audience?.countries?.slice(0, 3).map((x) => `${x.name} ${Math.round(x.weight * 100)}%`), ...(full ? { concerns: s?.concerns } : {}) }; };
  return JSON.stringify({
    brief: { name: b.name, type: b.type, location: b.location, dates: [b.startDate, b.endDate], event: [b.eventStart, b.eventEnd], publishing: [b.publishStart, b.publishEnd], objectives: b.objectives, kpis: b.kpis.map((k) => `${k.label}: ${k.target}`), mainMessage: b.mainMessage, cta: b.cta, platforms: b.platforms },
    segments: b.segments.map((s) => ({ id: s.id, name: s.name, priority: s.priority, coverageTarget: s.coverageTarget, languages: s.languages, countries: s.countries, ages: s.ageGroups })),
    budget: { currency: m.budget.currency, total: m.budget.total, influencerAllocation: b.budget.influencer, influencerFees: m.budget.influencerSpend, plannedSpend: Math.round(m.budget.grand), remaining: Math.round(m.budget.remaining), fields: b.budget },
    selected: c.assignments.filter((a) => m.lib[a.influencerId]).map((a) => ({ ...inf(a.influencerId, true), fee: a.fee, feeStatus: a.feeStatus, locked: a.locked, mandatory: a.mandatory, status: a.status, deliverables: a.deliverables.map((d) => `${d.count}× ${d.format}`), messages: a.messages })),
    candidates: m.pool.filter((i) => !c.assignments.some((a) => a.influencerId === i.id) && !c.rejected.includes(i.id)).sort((x, y) => m.scores[y.id].total - m.scores[x.id].total).slice(0, 30).map((i) => inf(i.id)),
    messages: c.messages.map((x) => ({ id: x.id, type: x.type, priority: x.priority, text: x.text })),
    coverage: m.coverage.map((s) => ({ segment: s.name, shareOfReach: +s.share.toFixed(2), target: +s.target.toFixed(2), status: s.status })),
    forecastExpected: { uniqueReach: Math.round(m.forecast.expected.reach), impressions: Math.round(m.forecast.expected.impressions), engagements: Math.round(m.forecast.expected.engagements), note: "estimates, not guarantees" },
    matrixAlerts: m.alerts.map((a) => a.text), scheduleIssues: m.conflicts.slice(0, 15).map((x) => x.text),
    events: c.events.filter((e) => ["publish", "pre_event", "post_event", "approval", "submission"].includes(e.type)).slice(0, 80).map((e) => ({ id: e.id, type: e.type, date: e.date, title: e.title })),
    slides: SLIDES.map((s) => ({ id: s.id, title: s.title, hidden: c.deck.hidden.includes(s.id) })),
  });
}

export function contentContext(m: Model, ids: string[]): string {
  const c = m.campaign, b = c.brief; const byId = Object.fromEntries(c.messages.map((x) => [x.id, x]));
  return JSON.stringify({
    campaign: { name: b.name, organisation: b.organisation, type: b.type, description: b.description, mainMessage: b.mainMessage, cta: b.cta, event: [b.eventStart, b.eventEnd], location: b.location, pre: b.preEvent, during: b.duringEvent, post: b.postEvent, style: b.prefs.contentStyle },
    restrictions: c.messages.filter((x) => x.type === "restriction").map((x) => x.text),
    influencers: c.assignments.filter((a) => ids.includes(a.influencerId) && m.lib[a.influencerId]).map((a) => { const i = m.lib[a.influencerId]; return {
      influencerId: i.id, name: i.name, platform: i.platform, tier: tierOf(i.followers), languages: i.languages, categories: i.categories, contentStyle: i.contentStyle,
      audienceSegment: m.scores[i.id]?.bestSegment?.name, deliverables: a.deliverables.map((d) => `${d.count}× ${d.format} on ${d.platform}`),
      primaryMessages: Object.entries(a.messages).filter(([, l]) => l === "primary").map(([id]) => byId[id]?.text).filter(Boolean),
      supportingMessages: Object.entries(a.messages).filter(([, l]) => l === "supporting").map(([id]) => byId[id]?.text).filter(Boolean),
    }; }),
  });
}

export function summaryContext(m: Model): string {
  const b = m.campaign.brief;
  return JSON.stringify({ ...b, summary: undefined, prefs: { ...b.prefs, approvedHandles: undefined, excludedHandles: undefined }, messages: m.campaign.messages.map((x) => ({ type: x.type, priority: x.priority, text: x.text })) });
}
