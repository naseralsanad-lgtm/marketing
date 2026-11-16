"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { computeModel, historyStats, type Model } from "./model";
import { getStatus, type Status } from "./api";
import { compact, money } from "./utils";

export function useCampaign(id: string) { return useStore((s) => s.campaigns[id]); }

export function useModel(id: string): Model | null {
  const c = useStore((s) => s.campaigns[id]);
  const lib = useStore((s) => s.library);
  const campaigns = useStore((s) => s.campaigns);
  // history only depends on recorded actuals — cheap to recompute, but keyed loosely to avoid churn
  const hKey = useMemo(() => Object.values(campaigns).map((x) => x.assignments.filter((a) => a.actuals?.reach).map((a) => `${a.influencerId}:${a.actuals!.reach}`).join(",")).join("|"), [campaigns]);
  const history = useMemo(() => historyStats(campaigns, lib), [hKey, lib]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => (c ? computeModel(c, lib, history) : null), [c, lib, history]);
}

export function useStatus(): Status | null {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { let on = true; getStatus().then((x) => on && setS(x)).catch(() => on && setS({ modash: { configured: false, platforms: [] }, ai: { configured: false }, supabase: { configured: false } })); return () => { on = false; }; }, []);
  return s;
}

export function useFmt(currency = "AED") {
  return useMemo(() => ({ money: (n: number | undefined | null) => money(n, currency), compact: (n: number) => compact(n) }), [currency]);
}
