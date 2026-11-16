import { NextResponse } from "next/server";
import { dictionary, ModashError } from "@/server/modash";
import { fail, guard } from "@/server/guard";
import type { Platform } from "@/lib/types";

export async function GET(req: Request) {
  const blocked = await guard(req, 40); if (blocked) return blocked;
  const q = new URL(req.url).searchParams; const kind = q.get("kind") ?? "";
  if (!["locations", "languages", "interests", "brands"].includes(kind)) return fail("Unknown dictionary.", 400);
  try { return NextResponse.json(await dictionary((q.get("platform") ?? "instagram") as Platform, kind as "locations", (q.get("query") ?? "").slice(0, 60))); }
  catch (e) { return e instanceof ModashError ? fail(e.message, e.status) : fail("Unexpected error."); }
}
