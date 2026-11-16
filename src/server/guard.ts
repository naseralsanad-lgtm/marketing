import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const hits = new Map<string, { n: number; reset: number }>();

/** Per-client rate limiting plus (when Supabase is configured) a signed-in user check for every API route. */
export async function guard(req: Request, limitPerMin = 30): Promise<NextResponse | null> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${ip}:${new URL(req.url).pathname}`;
  const now = Date.now(); const h = hits.get(key);
  if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + 60_000 });
  else if (++h.n > limitPerMin) return NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(Math.ceil((h.reset - now) / 1000)) } });
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
  }
  return null;
}

export const fail = (message: string, status = 500, extra: Record<string, unknown> = {}) => NextResponse.json({ error: message, ...extra }, { status });
