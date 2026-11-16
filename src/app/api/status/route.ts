import { NextResponse } from "next/server";
import { accountInfo, modashConfigured, MODASH_PLATFORMS } from "@/server/modash";
import { aiConfigured, AI_MODEL } from "@/server/ai";
import { guard } from "@/server/guard";

export async function GET(req: Request) {
  const blocked = await guard(req, 60); if (blocked) return blocked;
  const info = modashConfigured() ? await accountInfo() : null;
  return NextResponse.json({
    modash: { configured: modashConfigured(), reachable: modashConfigured() ? !!info : undefined, credits: info?.credits, platforms: MODASH_PLATFORMS },
    ai: { configured: aiConfigured(), model: aiConfigured() ? AI_MODEL : undefined },
    supabase: { configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
  });
}
