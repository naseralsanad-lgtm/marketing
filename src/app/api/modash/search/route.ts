import { NextResponse } from "next/server";
import { z } from "zod";
import { ModashError, searchInfluencers } from "@/server/modash";
import { fail, guard } from "@/server/guard";

const Body = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube", "snapchat", "facebook", "x", "linkedin"]), page: z.number().int().min(0).max(50).optional(),
  minFollowers: z.number().min(0).optional(), maxFollowers: z.number().min(0).optional(), minEngagement: z.number().min(0).max(1).optional(),
  keywords: z.string().max(120).optional(), languageCode: z.string().max(5).optional(), countries: z.array(z.string().max(60)).max(6).optional(),
  audienceCountries: z.array(z.string().max(60)).max(6).optional(), audienceLanguageCode: z.string().max(5).optional(), minCredibility: z.number().min(0).max(1).optional(),
});

export async function POST(req: Request) {
  const blocked = await guard(req, 20); if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid search request.", 400);
  try { return NextResponse.json(await searchInfluencers(parsed.data)); }
  catch (e) { return e instanceof ModashError ? fail(e.message, e.status, { code: e.code }) : fail("Unexpected error while searching Modash."); }
}
