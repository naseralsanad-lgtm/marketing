"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useModel } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "../layout";
import { Discover } from "@/components/build/Discover";
import { Scenarios } from "@/components/build/Scenarios";
import { ContentTab } from "@/components/build/ContentTab";
import { Matrix } from "@/components/build/Matrix";
import { BudgetTab, ForecastTab } from "@/components/build/BudgetForecast";
import { ScheduleTab } from "@/components/build/ScheduleTab";
import { Tracking } from "@/components/build/Tracking";
import { ProfilePanel } from "@/components/build/ProfilePanel";
import { Button, Card, Progress, Stat } from "@/components/ui";
import { compact, cx, money } from "@/lib/utils";

const TABS = [["discover", "Discover"], ["scenarios", "Scenarios"], ["content", "Content"], ["matrix", "Messages"], ["budget", "Budget"], ["forecast", "Forecast"], ["schedule", "Schedule"], ["tracking", "Tracking"]] as const;
type Tab = (typeof TABS)[number][0];

function Build() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const sp = useSearchParams(); const t = useT(); const { openAssistant } = useWorkspace();
  const model = useModel(id); const [profile, setProfile] = useState<string | null>(null);
  const tab = (TABS.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : "discover") as Tab;
  const setTab = (k: Tab) => router.replace(`/campaigns/${id}/build?tab=${k}`, { scroll: false });
  if (!model) return null;
  const B = model.budget; const fc = model.forecast.expected; const c = model.campaign;
  const covered = model.coverage.filter((s) => s.status === "ok" || s.status === "over").length;
  const badge: Partial<Record<Tab, number>> = { matrix: model.alerts.filter((a) => a.level !== "info").length, schedule: model.conflicts.filter((x) => x.level === "critical").length, content: c.assignments.filter((a) => !a.plan).length };
  return (
    <div className="space-y-5">
      {!c.brief.name && <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-[13px]"><span>{t("This campaign has no brief yet. Scores and recommendations improve once the brief has objectives and audience segments.")}</span><Link href={`/campaigns/${id}/brief`}><Button size="sm">{t("Complete the brief")}</Button></Link></Card>}
      <Card className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-5">
        <Stat label={t("Selected influencers")} value={model.selected.length} sub={`${model.pool.length} ${t("in pool")}`} />
        <div><Stat label={t("Budget used")} value={B.total ? `${Math.round(B.utilisation * 100)}%` : "—"} tone={B.over ? "bad" : undefined} sub={`${money(B.grand, B.currency)} / ${money(B.total, B.currency)}`} /><div className="mt-2"><Progress value={B.utilisation * 100} tone={B.over ? "bad" : "accent"} /></div></div>
        <Stat label={t("Est. unique reach")} value={compact(fc.reach)} sub={t("expected scenario")} />
        <Stat label={t("Est. engagements")} value={compact(fc.engagements)} sub={`${fc.deliverables} ${t("deliverables")}`} />
        <Stat label={t("Segments on target")} value={model.coverage.length ? `${covered}/${model.coverage.length}` : "—"} tone={model.coverage.length && covered < model.coverage.length && model.selected.length ? "warn" : undefined} sub={t("audience coverage")} />
      </Card>
      <div className="no-print sticky top-[57px] z-20 -mx-4 overflow-x-auto bg-bg px-4 py-2 sm:-mx-8 sm:px-8 md:top-[61px]">
        <div role="tablist" className="inline-flex rounded-[11px] bg-surface-2 p-0.5">{TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition", tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>{t(label)}{!!badge[k] && model.selected.length > 0 && <span className="num flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-bold text-white">{badge[k]}</span>}</button>)}</div>
      </div>
      <div key={tab} className="fade-up">
        {tab === "discover" && <Discover model={model} onOpen={setProfile} />}
        {tab === "scenarios" && <Scenarios model={model} onOpen={setProfile} />}
        {tab === "content" && <ContentTab model={model} onOpen={setProfile} />}
        {tab === "matrix" && <Matrix model={model} onOpen={setProfile} />}
        {tab === "budget" && <BudgetTab model={model} onOpen={setProfile} />}
        {tab === "forecast" && <ForecastTab model={model} />}
        {tab === "schedule" && <ScheduleTab model={model} />}
        {tab === "tracking" && <Tracking model={model} onOpen={setProfile} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button variant="ghost" onClick={() => { const i = TABS.findIndex(([k]) => k === tab); if (i > 0) setTab(TABS[i - 1][0]); else router.push(`/campaigns/${id}/brief`); }}>{t("Back")}</Button>
        <div className="flex gap-2">{tab !== "tracking" && <Button onClick={() => setTab(TABS[TABS.findIndex(([k]) => k === tab) + 1][0])}>{t("Next")}: {t(TABS[TABS.findIndex(([k]) => k === tab) + 1][1])}</Button>}<Button variant="primary" icon={<ArrowRight size={15} className="rtl:rotate-180" />} disabled={!model.selected.length} onClick={() => router.push(`/campaigns/${id}/plan`)}>{t("Review Campaign Plan")}</Button></div>
      </div>
      <ProfilePanel model={model} infId={profile} onClose={() => setProfile(null)} onAsk={(pid) => { setProfile(null); openAssistant(pid); }} />
    </div>
  );
}
export default function BuildPage() { return <Suspense><Build /></Suspense>; }
