import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, AnalysisSchema, structured } from "@/server/ai";
import { fail, guard } from "@/server/guard";
import { quoteInSource } from "@/lib/analysis";

const Body = z.object({ doc: z.object({ id: z.string(), name: z.string().max(300), text: z.string().min(1).max(200_000) }), segments: z.array(z.string().max(120)).max(12), campaign: z.string().max(3000) });

export async function POST(req: Request) {
  const blocked = await guard(req, 10); if (blocked) return blocked;
  const p = Body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  const { doc, segments, campaign } = p.data;
  try {
    const out = await structured({
      schema: AnalysisSchema, effort: "medium",
      system: "You are a senior communications strategist building a messaging library for an influencer campaign. Extract messages ONLY from the supplied document. Never invent statistics, capabilities, dates or claims. Each item must include an exact verbatim quote from the document. Classify each as: main, supporting, service (a service or product showcased), statistic, benefit (audience benefit), talking_point, cta (required call to action), restriction (communication restriction or mandatory rule), or opportunity (content opportunity such as agenda moments). Priority: mandatory, high, supporting or optional. Return at most 45 items, most important first, written in the document's language.",
      user: `<campaign>${campaign}</campaign>\nAudience segments: ${segments.join("; ") || "not defined"}\n\n<document name=${JSON.stringify(doc.name)}>\n${doc.text}\n</document>`,
    });
    // Integrity check: a quote that cannot be found verbatim in the source is flagged, never silently trusted.
    return NextResponse.json({ messages: out.messages.map((m) => ({ ...m, verified: quoteInSource(m.sourceQuote, doc.text) })) });
  } catch (e) { return e instanceof AiError ? fail(e.message, e.status) : fail("AI analysis failed."); }
}
