import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, PlanSchema, structured } from "@/server/ai";
import { fail, guard } from "@/server/guard";

const Body = z.object({ context: z.string().max(60_000), language: z.string().max(20).optional() });

export async function POST(req: Request) {
  const blocked = await guard(req, 10); if (blocked) return blocked;
  const p = Body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  try {
    const out = await structured({
      schema: PlanSchema, effort: "medium",
      system: "You are a creative director writing influencer content plans. For each influencer in the campaign data, write a distinct plan that fits their established content style, audience segment and assigned deliverables, and that carries ONLY their assigned messages. Do not repeat the same concept across influencers. Do not invent facts, statistics or product capabilities beyond the assigned messages. Respect every restriction. Keep each field concise and practical: role (3-6 words), objective (one sentence), topic, concept (2-3 sentences), storyline (numbered beats), hook (one line the creator could say), 3-5 talking points, call to action, filming requirements, approval requirements. Return one plan per influencer using the exact influencerId given.",
      user: `${p.data.language ? `Write in ${p.data.language}.\n` : ""}<campaign>\n${p.data.context}\n</campaign>`,
    });
    return NextResponse.json(out);
  } catch (e) { return e instanceof AiError ? fail(e.message, e.status) : fail("AI content generation failed."); }
}
