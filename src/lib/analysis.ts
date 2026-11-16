import type { AudienceSegment, Brief, Message, MessagePriority, MessageType, SourceDoc } from "./types";
import { recommendPlatforms, recommendTierMix } from "./scoring";
import { budgetTotal } from "./budget";
import { fmtDate, money, uid } from "./utils";

/**
 * Built-in (non-AI) document analysis. It is deliberately extractive: every message is a verbatim
 * sentence or bullet from the source, so nothing can be invented. Classification is rule-based.
 * When an Anthropic API key is configured the server performs a richer analysis and each quote is
 * verified against the source text.
 */
const SECTION: [RegExp, MessageType][] = [
  [/key messages?|main messages?|core messages?|الرسائل الرئيسية/i, "main"],
  [/supporting|secondary|proof points?/i, "supporting"],
  [/services?|products?|features?|what'?s on|experiences?|الخدمات/i, "service"],
  [/stat|facts?|figures|numbers|at a glance|أرقام/i, "statistic"],
  [/benefits?|why it matters|what it means/i, "benefit"],
  [/call[- ]to[- ]action|cta|how to|next steps/i, "cta"],
  [/restrict|do not|don'?ts|guidelines|compliance|mandatory|must|إرشادات/i, "restriction"],
  [/talking points?|q&a|faq/i, "talking_point"],
  [/opportunit|content ideas?|activations?|agenda|programme|program/i, "opportunity"],
];

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
export const normaliseForMatch = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[“”"'‘’`]/g, "").trim();
export const quoteInSource = (quote: string, text: string) => !!quote && normaliseForMatch(text).includes(normaliseForMatch(quote));

function classify(s: string, section?: MessageType): { type: MessageType; priority: MessagePriority } | null {
  const t = s.toLowerCase();
  if (/^(do not|don't|never|avoid|must not|no )|\b(must not|do not|never|prohibited|not permitted|without approval|only use the official)\b/.test(t)) return { type: "restriction", priority: "mandatory" };
  if (/\bmust\b|\balways\b|\bmandatory\b|\brequired to\b/.test(t)) return { type: section && section !== "restriction" ? section : "restriction", priority: "mandatory" };
  if (section === "restriction") return { type: "restriction", priority: "mandatory" };
  if (/\b(download|register|sign up|book|visit|apply|scan|follow|join us|get the app|learn more at)\b/.test(t) && (section === "cta" || s.length < 160)) return { type: "cta", priority: "high" };
  if (section === "main") return { type: "main", priority: "mandatory" };
  if (/\d/.test(s) && /(%|percent|million|billion|thousand|\b\d{2,}[,.]?\d*\b|x faster|minutes|seconds|hours)/i.test(s) && section !== "service" && section !== "opportunity") return { type: "statistic", priority: "high" };
  if (section) return { type: section, priority: section === "service" ? "high" : section === "supporting" || section === "talking_point" || section === "benefit" ? "supporting" : "optional" };
  if (/\b(save|faster|easier|simpl|free|secure|convenient|benefit|helps? you|so you can)\b/.test(t)) return { type: "benefit", priority: "supporting" };
  if (/\b(service|platform|app|feature|portal|launch|introduc)\b/.test(t)) return { type: "service", priority: "supporting" };
  return null;
}

export function extractMessages(doc: SourceDoc, segments: AudienceSegment[] = []): Message[] {
  const out: Message[] = []; const seen = new Set<string>();
  let section: MessageType | undefined; let mainCount = 0;
  const lines = doc.text.replace(/\r/g, "").split("\n");
  for (const raw of lines) {
    const line = norm(raw.replace(/^[\s•·\-–—*▪■●○>]+|^\(?\d{1,2}[.)]\s+/g, ""));
    if (!line) continue;
    const bullet = /^[\s]*([•·\-–—*▪■●○>]|\(?\d{1,2}[.)])\s+/.test(raw);
    const headingLike = !bullet && line.length <= 60 && !/[.!?؟]$/.test(line) && line.split(" ").length <= 8;
    if (headingLike) { section = SECTION.find(([re]) => re.test(line))?.[1]; if (section || /:$/.test(line) || line === line.toUpperCase()) continue; }
    const parts = bullet ? [line] : line.match(/[^.!?؟]+[.!?؟]+|[^.!?؟]+$/g) ?? [line];
    for (const p of parts) {
      const s = norm(p);
      if (s.length < 25 || s.length > 320) continue;
      const key = s.toLowerCase().slice(0, 60); if (seen.has(key)) continue;
      const c = classify(s, section); if (!c) continue;
      if (c.type === "main" && ++mainCount > 4) { c.type = "supporting"; c.priority = "high"; }
      seen.add(key);
      const low = s.toLowerCase();
      const segmentIds = segments.filter((seg) => [seg.name, ...seg.languages, ...seg.communities].some((w) => w && w.length > 3 && low.includes(w.toLowerCase()))).map((x) => x.id);
      out.push({ id: uid("m"), text: s, type: c.type, priority: c.priority, sourceId: doc.id, sourceQuote: s, verified: true, origin: "extracted", segmentIds: segmentIds.length ? segmentIds : undefined });
      if (out.length >= 45) return out;
    }
  }
  return out;
}

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  main: "Main message", supporting: "Supporting message", service: "Service / product", statistic: "Key statistic", benefit: "Audience benefit",
  talking_point: "Talking point", cta: "Call to action", restriction: "Restriction", opportunity: "Content opportunity",
};

/** Deterministic strategic summary assembled only from what the user entered. */
export function buildSummary(b: Brief, messages: Message[]): string {
  const L: string[] = [];
  const period = b.startDate && b.endDate ? `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}` : "dates to be confirmed";
  L.push(`${b.name || "This campaign"}${b.organisation ? ` for ${b.organisation}` : ""} is ${/^[aeiou]/i.test(b.type) ? "an" : "a"} ${b.type.toLowerCase() || "campaign"}${b.location ? ` in ${b.location}` : ""} running ${period}.${b.eventStart ? ` The event takes place ${fmtDate(b.eventStart)}${b.eventEnd && b.eventEnd !== b.eventStart ? ` – ${fmtDate(b.eventEnd)}` : ""}.` : ""}`);
  if (b.objectives.length) L.push(`Priorities, in order: ${b.objectives.slice(0, 4).map((o, i) => `${i + 1}) ${o.toLowerCase()}`).join(", ")}.${b.kpis.filter((k) => k.label).length ? ` Targets: ${b.kpis.filter((k) => k.label).map((k) => `${k.label} ${k.target}`.trim()).join("; ")}.` : ""}`);
  if (b.segments.length) L.push(`Audience: ${b.segments.map((s) => `${s.name} (${s.role}, ${s.coverageTarget}% of coverage)`).join("; ")}. The influencer mix should cover each segment in proportion rather than maximise total reach.`);
  const plats = b.recommendPlatforms || !b.platforms.length ? recommendPlatforms(b).slice(0, 4).map((p) => p.platform) : b.platforms;
  L.push(`Platforms: ${plats.map((p) => p[0].toUpperCase() + p.slice(1)).join(", ")}${b.recommendPlatforms || !b.platforms.length ? " (recommended from objectives and audience)" : ""}. Suggested creator mix: ${recommendTierMix(b).map((t) => `${t.share}% ${t.tier}`).join(", ")}.`);
  const total = budgetTotal(b.budget);
  if (total) L.push(`Budget: ${money(total, b.budget.currency)} in total${b.budget.influencer ? `, of which ${money(b.budget.influencer, b.budget.currency)} is for influencer collaborations` : ""}.`);
  const mand = messages.filter((m) => m.priority === "mandatory" && m.type !== "restriction");
  if (b.mainMessage || mand.length) L.push(`Core message: ${b.mainMessage || mand[0].text}${mand.length > 1 ? ` Plus ${mand.length - (b.mainMessage ? 0 : 1)} further mandatory message(s) from the messaging library.` : ""}`);
  const restr = messages.filter((m) => m.type === "restriction").length;
  if (restr) L.push(`${restr} communication restriction(s) apply to every creator brief.`);
  if (b.cta) L.push(`Call to action: ${b.cta}`);
  return L.join("\n\n");
}
