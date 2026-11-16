import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, structured, SummarySchema } from "@/server/ai";
import { fail, guard } from "@/server/guard";

export async function POST(req: Request) {
  const blocked = await guard(req, 10); if (blocked) return blocked;
  const p = z.object({ context: z.string().max(40_000) }).safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  try {
    return NextResponse.json(await structured({
      schema: SummarySchema, effort: "medium", maxTokens: 4000,
      system: "Write a strategic campaign summary (4-6 short paragraphs, plain text) for an influencer campaign brief: the opportunity, objectives in priority order, audience segments and how the influencer mix should serve each, platform and creator-tier recommendation, messaging priorities and restrictions, budget posture and key risks. Use only the facts provided; do not invent numbers.",
      user: `<campaign>\n${p.data.context}\n</campaign>`,
    }));
  } catch (e) { return e instanceof AiError ? fail(e.message, e.status) : fail("Summary generation failed."); }
}
