"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** null when Supabase is not configured — the app then runs local-first in this browser. */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

/** Cloud sync: one private workspace document per user (see supabase/migrations/0001_workspaces.sql). */
export async function pullWorkspace(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("workspaces").select("data, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as { data: unknown; updated_at: string } | null;
}
export async function pushWorkspace(userId: string, data: unknown) {
  if (!supabase) return;
  const { error } = await supabase.from("workspaces").upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}
