"use client";
import { useCallback } from "react";
import { useStore } from "./store";
import { AR } from "./i18n-ar";

/** English strings are the keys. Arabic falls back to English for any string not yet translated. */
export function translate(lang: "en" | "ar", s: string, vars?: Record<string, string | number>): string {
  let out = lang === "ar" ? AR[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
export function useT() {
  const lang = useStore((s) => s.settings.language);
  return useCallback((s: string, vars?: Record<string, string | number>) => translate(lang, s, vars), [lang]);
}
export const useLang = () => useStore((s) => s.settings.language);
