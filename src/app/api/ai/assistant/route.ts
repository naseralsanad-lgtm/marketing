import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, AssistantSchema, structured } from "@/server/ai";
import { fail, guard } from "@/server/guard";

const Body = z.object({ text: z.string().min(1).max(2000), context: z.string().max(80_000), focusId: z.string().max(120).optional() });

export async function POST(req: Request) {
  const blocked = await guard(req, 15); if (blocked) return blocked;
  const p = Body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  try {
    const out = await structured({
      schema: AssistantSchema, effort: "medium", maxTokens: 8000,
      system: `You are the campaign assistant inside an influencer campaign planning tool. Answer the user's request using ONLY the campaign data provided. You cannot change anything directly: when a change is needed, return one or more proposals made of operations, which the user will review, accept or reject.
Operations (set unused fields to null):
- add_influencer {influencerId} — only ids listed under candidates
- remove_influencer {influencerId} — never propose removing a creator marked locked or mandatory
- replace_influencer {influencerId, toId}
- set_fee {influencerId, fee}
- set_budget {field, value} — absolute amounts in the campaign currency
- assign_message {messageId, influencerId, level: primary|supporting|none}
- add_deliverable / remove_deliverable {influencerId, format, count}
- move_event {eventId, date: YYYY-MM-DD}
- hide_slides {slideIds} — the full list of slide ids to hide
- regenerate_schedule {}
Use only ids that appear in the data. Explain the reasoning and trade-offs honestly, including weaknesses. Never state estimates as guaranteed outcomes and never invent influencers, statistics or analytics. If the request needs data that is not available, say so. Keep the reply under 150 words. Return an empty proposals array for questions that need no change.`,
      user: `<campaign>\n${p.data.context}\n</campaign>\n${p.data.focusId ? `The user currently has influencer ${p.data.focusId} open.\n` : ""}\nUser request: ${p.data.text}`,
    });
    return NextResponse.json(out);
  } catch (e) { return e instanceof AiError ? fail(e.message, e.status) : fail("The assistant is unavailable."); }
}
