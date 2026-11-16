"use client";
import { supabase } from "./supabase";
import { IS_PREVIEW } from "./utils";

export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }

/** Fetch wrapper for the app's own API routes: attaches the session token (if any) and normalises errors. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (IS_PREVIEW) throw new ApiError(path.includes("documents") ? "File and web-page import need the hosted version. In this preview, use “Paste text”." : "This needs the hosted version with its integrations connected.", 503, "preview");
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try { res = await fetch(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body }); }
  catch { throw new ApiError("Network error — check your connection and try again.", 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.code);
  return data as T;
}

export interface Status {
  modash: { configured: boolean; reachable?: boolean; credits?: number; platforms: string[] };
  ai: { configured: boolean; model?: string };
  supabase: { configured: boolean };
}
let statusPromise: Promise<Status> | null = null;
export const getStatus = (fresh = false) => IS_PREVIEW ? Promise.resolve<Status>({ modash: { configured: false, platforms: [] }, ai: { configured: false }, supabase: { configured: false } }) : (statusPromise && !fresh ? statusPromise : (statusPromise = api<Status>("/api/status").catch((e) => { statusPromise = null; throw e; })));
