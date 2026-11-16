import type { Assignment, Brief, Campaign, ContentFormat, ContentPlan, Deliverable, Influencer, Message, MsgLevel } from "./types";
import { formatInfo, tierOf } from "./constants";
import type { ScoreResult } from "./scoring";
import { segmentShare } from "./scoring";
import { rng, uid } from "./utils";

const isEvent = (b: Brief) => !!b.eventStart || /event/i.test(b.type);

export function defaultDeliverables(inf: Influencer, brief: Brief): Deliverable[] {
  const p = inf.platform; const tier = tierOf(inf.followers);
  const d = (format: ContentFormat, count = 1): Deliverable => ({ id: uid("d"), format, platform: p, count, durationSec: formatInfo(format).defaultDuration });
  const edu = inf.categories.some((c) => /Education|Technology|Finance|Government/i.test(c));
  const talk = /podcast|conversation|thought|insight|threads|commentary/i.test(inf.contentStyle ?? "");
  if (p === "linkedin" || p === "x") return isEvent(brief) ? [d("panel"), d("educational")] : [d("educational", 2)];
  if (isEvent(brief)) {
    if (talk) return [d("podcast"), d("post_event_highlights")];
    if (tier === "mega" || tier === "celebrity") return [d("pre_event_promo"), d("event_attendance"), d("story_coverage", 3)];
    if (edu) return [d("educational"), d("event_attendance"), d("story_coverage", 3)];
    return [d("pre_event_promo"), d("story_coverage", 4), d("post_event_highlights")];
  }
  return edu ? [d("educational", 2), d("story_coverage", 2)] : [d("reel", 2), d("story_coverage", 3)];
}

const assignable = (m: Message) => m.type !== "restriction";
const PRI: Record<Message["priority"], number> = { mandatory: 0, high: 1, supporting: 2, optional: 3 };
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z؀-ۿ]{4,}/g) ?? []);

/**
 * Strategically distribute messages: every assignable message gets one primary owner (the best-fitting,
 * least-loaded creator) and limited supporting coverage. Calls-to-action are intentionally repeated.
 * Assignments whose plan is locked are never modified.
 */
export function distributeMessages(c: Campaign, lib: Record<string, Influencer>, scores: Record<string, ScoreResult>): Record<string, Record<string, MsgLevel>> {
  const out: Record<string, Record<string, MsgLevel>> = {};
  const free = c.assignments.filter((a) => !a.plan?.locked);
  for (const a of c.assignments) out[a.influencerId] = a.plan?.locked ? { ...a.messages } : {};
  if (!free.length) return out;
  const load: Record<string, number> = Object.fromEntries(c.assignments.map((a) => [a.influencerId, Object.values(out[a.influencerId]).filter((l) => l === "primary").length]));
  const msgs = c.messages.filter(assignable).sort((a, b) => PRI[a.priority] - PRI[b.priority]);
  const cap = Math.max(1, Math.ceil(msgs.filter((m) => m.type !== "cta").length / free.length) + 1);
  for (const m of msgs) {
    if (m.type === "cta") { for (const a of free) out[a.influencerId][m.id] = "supporting"; continue; }
    const hasPrimary = c.assignments.some((a) => out[a.influencerId][m.id] === "primary");
    const mw = words(m.text);
    const ranked = free.map((a) => {
      const inf = lib[a.influencerId]; if (!inf) return { id: a.influencerId, v: -1 };
      let v = (scores[inf.id]?.total ?? 50) / 10;
      const segs = m.segmentIds?.length ? c.brief.segments.filter((s) => m.segmentIds!.includes(s.id)) : [];
      for (const s of segs) v += (segmentShare(inf, s) ?? 0) * 30;
      const iw = words(`${inf.categories.join(" ")} ${inf.contentStyle ?? ""} ${inf.bio ?? ""}`);
      for (const w of mw) if (iw.has(w)) v += 6;
      if (m.type === "service" || m.type === "statistic") v += inf.categories.some((x) => /Education|Technology|Finance|Government|Business/i.test(x)) ? 6 : 0;
      if (m.type === "benefit" || m.type === "opportunity") v += inf.categories.some((x) => /Lifestyle|Family|Parenting|Comedy|Youth/i.test(x)) ? 5 : 0;
      v -= load[inf.id] * 5 + (load[inf.id] >= cap ? 40 : 0);
      return { id: inf.id, v };
    }).sort((a, b) => b.v - a.v);
    let idx = 0;
    if (!hasPrimary && ranked[0]) { out[ranked[0].id][m.id] = "primary"; load[ranked[0].id]++; idx = 1; }
    const support = m.priority === "mandatory" ? 2 : m.priority === "high" ? 1 : 0;
    for (let k = 0; k < support && ranked[idx + k]; k++) out[ranked[idx + k].id][m.id] ??= "supporting";
  }
  return out;
}

const HOOKS = [
  "“Nobody told me {topic} could be this simple…”",
  "“Stop scrolling if you’ve ever struggled with {topic}.”",
  "“I tried {topic} for the first time — here’s what happened.”",
  "“Three things I wish I knew about {topic}.”",
  "“POV: you just found out about {topic}.”",
  "“Here’s the one thing about {topic} everyone gets wrong.”",
];
const CONCEPTS: Record<ContentFormat, string[]> = {
  reel: ["A fast-cut “before / after” showing life with and without {topic}, in {name}'s own {style} style.", "{name} takes on a 60-second challenge built around {topic}, ending on the call to action."],
  educational: ["A step-by-step explainer: {name} walks the audience through {topic} in three clear steps.", "Myth vs fact: {name} corrects the most common misunderstandings about {topic}."],
  product_demo: ["A real-time screen/hands-on demo of {topic}, narrated in {name}'s natural voice.", "{name} tests {topic} against the “old way” and times the difference."],
  pre_event_promo: ["A countdown teaser: {name} shares the one thing they are most excited to see — {topic} — and invites followers to join.", "“Come with me” invitation revealing what visitors can do around {topic}."],
  post_event_highlights: ["A highlight recap: {name}'s top three moments, anchored on {topic}.", "“What I learned” reflection connecting the event back to {topic} for people who could not attend."],
  story_coverage: ["Live story sequence from the venue: arrival, a walkthrough of {topic}, a poll sticker and a swipe-up call to action.", "Day-in-the-life stories following {name} through the experience, pausing on {topic}."],
  event_attendance: ["On-ground attendance: {name} visits the {topic} area, meets the team and shares candid reactions.", "Hosted walkthrough with a subject expert explaining {topic} to {name} on camera."],
  stage_speaker: ["A short keynote where {name} shares a personal story linked to {topic}.", "Fireside-style talk: {name} on why {topic} matters to their community."],
  panel: ["{name} joins a panel discussion representing the audience's view on {topic}.", "{name} moderates a conversation between experts about {topic}."],
  podcast: ["A recorded podcast conversation exploring {topic} through real audience questions.", "{name} hosts a guest expert episode unpacking {topic}."],
  interview: ["{name} interviews a spokesperson with five audience-submitted questions about {topic}.", "Quick-fire vox-pop interviews with visitors about {topic}."],
  live: ["A live session from the venue with Q&A about {topic}.", "Live walkthrough with real-time audience questions on {topic}."],
};
const FILMING: Partial<Record<ContentFormat, string>> = {
  event_attendance: "On-site access pass, escort and a 30-minute filming slot at the assigned area.",
  story_coverage: "Self-shot on mobile; venue Wi-Fi and filming permission required.",
  podcast: "Podcast studio booking, two microphones and a producer.",
  interview: "Quiet interview corner, lapel microphones and spokesperson availability.",
  stage_speaker: "Stage rehearsal slot, clicker and stage camera feed.",
  panel: "Panel briefing call and on-stage camera feed for clips.",
  live: "Stable uplink and a moderator for live comments.",
};

const short = (s: string, n = 70) => { const t = s.replace(/\s+/g, " ").trim().replace(/[.。]$/, ""); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };

export function generatePlan(a: Assignment, inf: Influencer, c: Campaign, score: ScoreResult | undefined, variant = 0): ContentPlan {
  const r = rng(inf.id + variant);
  const pick = <T,>(arr: T[]) => arr[(variant + Math.floor(r() * arr.length)) % arr.length];
  const byId = Object.fromEntries(c.messages.map((m) => [m.id, m]));
  const mine = Object.entries(a.messages).map(([id, level]) => ({ m: byId[id], level })).filter((x) => x.m);
  const primary = mine.filter((x) => x.level === "primary").map((x) => x.m);
  const supporting = mine.filter((x) => x.level === "supporting" && x.m.type !== "cta").map((x) => x.m);
  const lead = primary[0] ?? supporting[0];
  const topic = lead ? short(lead.text, 60) : c.brief.mainMessage ? short(c.brief.mainMessage, 60) : c.brief.name;
  const seg = c.brief.segments.find((s) => s.id === score?.bestSegment?.segmentId);
  const tier = tierOf(inf.followers);
  const mainFormat = a.deliverables[0]?.format ?? "reel";
  const role = tier === "mega" || tier === "celebrity" ? "Headline reach driver"
    : inf.categories.some((x) => /Education|Technology|Finance|Government/i.test(x)) ? "Trusted explainer"
    : seg && (score?.bestSegment?.share ?? 0) > 0.3 && tier !== "macro" ? `Community voice — ${seg.name}`
    : a.deliverables.some((d) => ["event_attendance", "story_coverage", "live"].includes(d.format)) ? "On-ground storyteller" : "Lifestyle integrator";
  const fill = (s: string) => s.replaceAll("{topic}", topic.charAt(0).toLowerCase() + topic.slice(1)).replaceAll("{name}", inf.name.split(" ")[0]).replaceAll("{style}", (inf.contentStyle ?? "signature").toLowerCase());
  const restrictions = c.messages.filter((m) => m.type === "restriction").map((m) => m.text);
  const mandatory = [...primary, ...supporting].filter((m) => m.priority === "mandatory").map((m) => m.text);
  const cta = mine.find((x) => x.m.type === "cta")?.m.text ?? c.brief.cta;
  const lang = inf.languages[0];
  return {
    role,
    objective: role.startsWith("Headline") ? `Create mass awareness of ${c.brief.name} and signal credibility.`
      : role.startsWith("Trusted") ? `Help the audience understand and act on: ${topic}.`
      : role.startsWith("Community") ? `Make the campaign relevant to ${seg!.name} in their own language and context.`
      : `Show the experience first-hand and make people want to take part.`,
    segmentId: seg?.id, topic,
    concept: fill(pick(CONCEPTS[mainFormat])),
    storyline: fill(`1) Open on a relatable moment from ${inf.name.split(" ")[0]}'s day. 2) Introduce {topic} naturally${lang ? `, in ${lang}` : ""}. 3) Show it working — one concrete proof point. 4) Close with the call to action.`),
    hook: fill(pick(HOOKS)),
    talkingPoints: [...primary, ...supporting].slice(0, 5).map((m) => m.text),
    mandatoryInfo: [...new Set([...mandatory, ...restrictions])],
    cta,
    filming: [...new Set(a.deliverables.map((d) => FILMING[d.format]).filter(Boolean))].join(" ") || "Self-produced; share raw files on request.",
    approval: mandatory.length || restrictions.length ? "Script and final cut require communications-team approval before publishing." : "Final cut reviewed by the campaign team 48 hours before publishing.",
    origin: "generated", variant,
  };
}

// ---------------------------------------------------------------- coverage matrix
export interface MatrixRow {
  message: Message; primary: string[]; supporting: string[];
  status: "ok" | "uncovered" | "no_owner" | "duplicate" | "n/a";
  segments: string[];
}
export function matrixRows(c: Campaign, scores: Record<string, ScoreResult>): MatrixRow[] {
  const n = c.assignments.length;
  return c.messages.filter(assignable).map((m) => {
    const primary = c.assignments.filter((a) => a.messages[m.id] === "primary").map((a) => a.influencerId);
    const supporting = c.assignments.filter((a) => a.messages[m.id] === "supporting").map((a) => a.influencerId);
    const covered = primary.length + supporting.length;
    const status: MatrixRow["status"] = !n ? "n/a" : covered === 0 ? "uncovered" : primary.length === 0 && m.type !== "cta" ? "no_owner"
      : m.type !== "cta" && (primary.length > 1 || (n >= 4 && covered / n > 0.6)) ? "duplicate" : "ok";
    const segments = [...new Set([...primary, ...supporting].map((id) => scores[id]?.bestSegment?.name).filter(Boolean) as string[])];
    return { message: m, primary, supporting, status, segments };
  });
}
export interface MatrixAlert { level: "critical" | "warning" | "info"; text: string; messageId: string }
export function matrixAlerts(rows: MatrixRow[]): MatrixAlert[] {
  const out: MatrixAlert[] = [];
  for (const r of rows) {
    const t = short(r.message.text, 80);
    if (r.status === "uncovered") out.push({ level: r.message.priority === "mandatory" || r.message.priority === "high" ? "critical" : "warning", messageId: r.message.id, text: `${r.message.priority === "mandatory" ? "Mandatory message" : "Message"} not assigned to anyone: “${t}”` });
    else if (r.status === "no_owner") out.push({ level: "warning", messageId: r.message.id, text: `No primary owner for: “${t}”` });
    else if (r.status === "duplicate") out.push({ level: "info", messageId: r.message.id, text: `Possible unnecessary duplication (${r.primary.length} primary, ${r.supporting.length} supporting): “${t}”` });
  }
  return out.sort((a, b) => "critical warning info".indexOf(a.level) - "critical warning info".indexOf(b.level));
}
