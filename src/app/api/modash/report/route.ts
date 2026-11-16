import { NextResponse } from "next/server";
import { getReport, ModashError } from "@/server/modash";
import { fail, guard } from "@/server/guard";
import type { Platform } from "@/lib/types";

export async function GET(req: Request) {
  const blocked = await guard(req, 20); if (blocked) return blocked;
  const q = new URL(req.url).searchParams; const platform = q.get("platform") as Platform; const id = q.get("id") ?? "";
  if (!platform || !/^[\w.@-]{1,80}$/.test(id)) return fail("Provide a platform and a profile id or username.", 400);
  try { return NextResponse.json({ influencer: await getReport(platform, id) }); }
  catch (e) { return e instanceof ModashError ? fail(e.message, e.status, { code: e.code }) : fail("Unexpected error while loading the Modash report."); }
}
