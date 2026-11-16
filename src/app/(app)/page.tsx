"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarClock, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { budgetTotal } from "@/lib/budget";
import { eventInfo } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { Page, useCreateCampaign } from "@/components/Shell";
import { CampaignCard, campaignPhase } from "@/components/CampaignCard";
import { Button, Card, Empty, SectionTitle, Stat } from "@/components/ui";
import { fmtDate, moneyCompact, todayISO } from "@/lib/utils";

export default function Home() {
  const t = useT(); const campaigns = useStore((s) => s.campaigns); const lib = useStore((s) => s.library); const settings = useStore((s) => s.settings);
  const createCampaign = useCreateCampaign(); const loadDemo = useStore((s) => s.loadDemo);
  const list = useMemo(() => Object.values(campaigns).filter((c) => c.status !== "archived").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [campaigns]);
  const active = list.filter((c) => campaignPhase(c).label === "Active"), upcoming = list.filter((c) => ["Upcoming", "Draft"].includes(campaignPhase(c).label));
  const live = list.filter((c) => campaignPhase(c).label !== "Completed");
  const today = todayISO();
  const deliverables = useMemo(() => live.flatMap((c) => c.events.filter((e) => e.date >= today && ["submission", "approval", "publish", "pre_event", "post_event"].includes(e.type)).map((e) => ({ e, c }))).sort((a, b) => a.e.date.localeCompare(b.e.date)).slice(0, 8), [live, today]);
  const byCurrency = live.reduce<Record<string, number>>((a, c) => { const v = budgetTotal(c.brief.budget); if (v) a[c.brief.budget.currency] = (a[c.brief.budget.currency] ?? 0) + v; return a; }, {});
  const hour = new Date().getHours();
  return (
    <Page title={t(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")} subtitle={new Date().toLocaleDateString(settings.language === "ar" ? "ar-AE" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: settings.timezone })}
      actions={<Button variant="primary" size="lg" icon={<Plus size={17} />} onClick={() => createCampaign()}>{t("Create Campaign")}</Button>}>
      {!list.length ? (
        <Empty icon={<Sparkles size={22} />} title={t("Plan your first influencer campaign")} text={t("Start from a brief and a factsheet. In three steps you’ll have a selected creator mix, a content plan, a budget, a schedule and a leadership-ready presentation.")}
          action={<><Button variant="primary" onClick={() => createCampaign()}>{t("Create Campaign")}</Button><Button onClick={loadDemo}>{t("Load demonstration campaign")}</Button></>} />
      ) : (
        <div className="space-y-8">
          <Card className="grid grid-cols-2 gap-x-6 gap-y-6 p-6 md:grid-cols-5">
            <Stat label={t("Active campaigns")} value={active.length} />
            <Stat label={t("Upcoming campaigns")} value={upcoming.length} />
            <Stat label={t("Allocated budgets")} value={Object.entries(byCurrency).map(([c, v]) => moneyCompact(v, c)).join(" + ") || "—"} />
            <Stat label={t("Planned collaborations")} value={live.reduce((s, c) => s + c.assignments.length, 0)} sub={`${live.reduce((s, c) => s + c.assignments.filter((a) => ["Confirmed", "Contract issued", "Contract signed"].includes(a.status)).length, 0)} ${t("confirmed")}`} />
            <Stat label={t("Upcoming deliverables")} value={live.reduce((s, c) => s + c.events.filter((e) => e.date >= today && ["publish", "pre_event", "post_event"].includes(e.type)).length, 0)} />
          </Card>
          <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
            <div className="space-y-8">
              {!!active.length && <section><SectionTitle title={t("Active campaigns")} /><div className="grid gap-4 md:grid-cols-2">{active.map((c) => <CampaignCard key={c.id} c={c} />)}</div></section>}
              {!!upcoming.length && <section><SectionTitle title={t("Upcoming and drafts")} action={<Link href="/campaigns" className="flex items-center gap-1 text-[13px] text-accent">{t("All campaigns")}<ArrowRight size={13} className="rtl:rotate-180" /></Link>} /><div className="grid gap-4 md:grid-cols-2">{upcoming.slice(0, 6).map((c) => <CampaignCard key={c.id} c={c} />)}</div></section>}
            </div>
            <section>
              <SectionTitle title={t("Upcoming deliverables")} />
              <Card className="divide-y">
                {deliverables.length ? deliverables.map(({ e, c }) => (
                  <Link key={e.id} href={`/campaigns/${c.id}/build?tab=schedule`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: eventInfo(e.type).color }} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{e.title}</div><div className="truncate text-[12px] text-ink-3">{c.brief.name} · {e.influencerId ? lib[e.influencerId]?.name : ""}</div></div>
                    <span className="num shrink-0 text-[12px] text-ink-2">{fmtDate(e.date, { day: "numeric", month: "short" })}</span>
                  </Link>
                )) : <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-ink-3"><CalendarClock size={20} />{t("No upcoming deliverables. They appear here once a campaign has a schedule.")}</div>}
              </Card>
            </section>
          </div>
        </div>
      )}
    </Page>
  );
}
