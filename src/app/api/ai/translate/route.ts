import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, structured, TranslateSchema } from "@/server/ai";
import { fail, guard } from "@/server/guard";

const Body = z.object({ to: z.enum(["Arabic", "English"]), items: z.array(z.object({ key: z.string().max(80), text: z.string().max(4000) })).max(400) });

export async function POST(req: Request) {
  const blocked = await guard(req, 6); if (blocked) return blocked;
  const p = Body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  try {
    const out = await structured({
      schema: TranslateSchema, effort: "low", maxTokens: 32000,
      system: `Translate each item into ${p.data.to} for a formal leadership presentation${p.data.to === "Arabic" ? " (Modern Standard Arabic, Gulf business register)" : ""}. Keep names, handles, numbers, currencies and URLs unchanged. Return every item with its original key. Do not add or remove information.`,
      user: `<document>\n${JSON.stringify(p.data.items)}\n</document>`,
    });
    return NextResponse.json(out);
  } catch (e) { return e instanceof AiError ? fail(e.message, e.status) : fail("Translation failed."); }
}
