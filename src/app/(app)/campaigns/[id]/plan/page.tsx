"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { useModel } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { platformLabel, tierLabel } from "@/lib/constants";
import { weaknesses } from "@/lib/assistant";
import { useWorkspace } from "../layout";
import { Presentation } from "@/components/plan/Presentation";
import { Columns, Donut, ShareBars } from "@/components/Charts";
import { Avatar, Badge, Button, Card, Empty, Note, SectionTitle, Segmented, Stat, Textarea } from "@/components/ui";
import { compact, fmtShort, money } from "@/lib/utils";

// remembered while the app is open, so returning from a print view lands on the same tab
let lastTab: "overview" | "presentation" = "overview";

export default function PlanPage() {
  const { id } = useParams<{ id: string }>(); const t = useT(); const model = useModel(id); const update = useStore((s) => s.update); const { openAssistant } = useWorkspace();
  const [tab, setTabState] = useState<"overview" | "presentation">(lastTab); const setTab = (v: "overview" | "presentation") => { lastTab = v; setTabState(v); };
  if (!model) return null;
  const c = model.campaign, b = c.brief, B = model.budget, cur = B.currency, fc = model.forecast.expected, D = model.dist;
  const platforms = new Set(c.assignments.flatMap((a) => a.deliverables.map((d) => d.platform)));
  const onTarget = model.coverage.filter((s) => s.status !== "under" && s.status !== "unknown").length;
  const issues = weaknesses(model); const clean = issues.length === 1 && /No material/.test(issues[0]);
  if (!model.selected.length) return <Empty icon={<Sparkles size={22} />} title={t("Nothing to review yet")} text={t("Select influencers in Step 2 and the full campaign plan and presentation appear here.")} action={<Link href={`/campaigns/${id}/build`}><Button variant="primary">{t("Build Campaign")}</Button></Link>} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[26px] font-semibold">{t("Campaign Plan")}</h1><p className="text-[13.5px] text-ink-2">{t("Everything in one place. Change anything in Steps 1–2 and every figure, chart and slide here updates.")}</p></div>
        <Segmented value={tab} onChange={setTab} options={[{ id: "overview", label: t("Executive overview") }, { id: "presentation", label: t("Presentation & exports") }]} />
      </div>
      {tab === "presentation" ? <Presentation model={model} /> : (
        <div className="fade-up space-y-5">
          <Card className="grid grid-cols-2 gap-x-6 gap-y-7 p-6 md:grid-cols-5">
            <Stat label={t("Total campaign budget")} value={money(B.total, cur)} sub={`${Math.round(B.utilisation * 100)}% ${t("planned")}`} tone={B.over ? "bad" : undefined} />
            <Stat label={t("Selected influencers")} value={model.selected.length} />
            <Stat label={t("Combined follower base")} value={compact(fc.followers)} sub={t("not reach")} />
            <Stat label={t("Estimated campaign reach")} value={compact(fc.reach)} sub={`${compact(model.forecast.conservative.reach)} – ${compact(model.forecast.optimistic.reach)}`} />
            <Stat label={t("Estimated views")} value={compact(fc.views)} />
            <Stat label={t("Estimated engagement")} value={compact(fc.engagements)} />
            <Stat label={t("Content deliverables")} value={fc.deliverables} />
            <Stat label={t("Platforms")} value={platforms.size} sub={[...platforms].map((p) => platformLabel(p)).join(", ")} />
            <Stat label={t("Audience coverage")} value={model.coverage.length ? `${onTarget}/${model.coverage.length}` : "—"} sub={t("segments on target")} tone={model.coverage.length && onTarget < model.coverage.length ? "warn" : undefined} />
            <Stat label={t("Campaign duration")} value={model.durationDays ? `${model.durationDays} ${t("days")}` : "—"} sub={b.startDate ? `${fmtShort(b.startDate)} – ${fmtShort(b.endDate)}` : undefined} />
          </Card>
          <Note tone={model.dataQuality.level === "high" ? "good" : "warn"}>{t("Reach, views and engagement are estimates, not guaranteed outcomes.")} {t("Confidence")}: {t(model.dataQuality.label)}.</Note>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-5"><SectionTitle title={t("Budget allocation")} /><Donut data={[{ name: t("Influencer fees"), value: B.influencerSpend }, { name: t("Production"), value: B.production }, { name: t("Paid amplification"), value: B.amplification }, { name: t("Travel"), value: B.travel }, { name: t("Additional"), value: B.additional }, { name: t("Taxes"), value: B.taxes }]} center={{ value: compact(B.grand), label: cur }} /></Card>
            <Card className="p-5"><SectionTitle title={t("Platform mix")} hint={t("Share of estimated reach")} /><Donut data={D.platforms.map((x) => ({ name: platformLabel(x.name as "instagram"), value: x.weight }))} format={(n) => `${Math.round(n * 100)}%`} /></Card>
            <Card className="p-5"><SectionTitle title={t("Influencer distribution")} hint={t("Creators by tier")} /><Donut data={D.tiers.map((x) => ({ name: t(tierLabel(x.name as "micro")), value: model.selected.filter((i) => (i.followers < 1e4 ? "nano" : i.followers < 1e5 ? "micro" : i.followers < 5e5 ? "mid" : i.followers < 1e6 ? "macro" : i.followers < 5e6 ? "mega" : "celebrity") === x.name).length }))} format={(n) => String(n)} /></Card>
            <Card className="p-5"><SectionTitle title={t("Audience coverage")} hint={t("vs. desired coverage (marker)")} />{model.coverage.length ? <ShareBars data={model.coverage.map((s) => ({ name: s.name, value: s.share, color: s.status === "under" ? "var(--warn)" : "var(--accent)" }))} targets={Object.fromEntries(model.coverage.map((s) => [s.name, s.target]))} max={Math.max(0.5, ...model.coverage.map((s) => Math.max(s.share, s.target)))} /> : <p className="text-[13px] text-ink-3">{t("No segments defined.")}</p>}</Card>
            <Card className="p-5"><SectionTitle title={t("Audience demographics")} hint={t("Age distribution")} /><Columns height={170} data={D.ages.map((x) => ({ name: x.name, value: +(x.weight * 100).toFixed(1) }))} format={(n) => `${Math.round(n)}%`} /></Card>
            <Card className="p-5"><SectionTitle title={t("Estimated performance")} hint={t("Unique reach by scenario")} /><Columns height={170} data={(["conservative", "expected", "optimistic"] as const).map((k) => ({ name: t(k[0].toUpperCase() + k.slice(1)), value: Math.round(model.forecast[k].reach), color: k === "expected" ? "var(--accent)" : "var(--line-strong)" }))} /></Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <Card className="p-5">
              <SectionTitle title={t("Strategic summary")} hint={t("Editable — used on the Executive Summary slide.")} />
              <Textarea rows={8} value={b.summary} placeholder={t("Write or generate a summary in Step 1.")} onChange={(e) => update(id, (d) => { d.brief.summary = e.target.value; d.brief.summaryOrigin = "edited"; }, "summary")} className="!text-[13.5px] leading-relaxed" />
            </Card>
            <Card className="p-5">
              <SectionTitle title={t("Readiness check")} action={<Button size="sm" variant="soft" icon={<Sparkles size={13} />} onClick={() => openAssistant()}>{t("Ask assistant")}</Button>} />
              {clean ? <div className="flex items-center gap-2 text-[13.5px] text-good"><CheckCircle2 size={16} />{t("No material weaknesses detected.")}</div> : <ul className="space-y-2">{issues.map((w) => <li key={w} className="flex gap-2 text-[13px]"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />{w}</li>)}</ul>}
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4"><SectionTitle title={t("Selected influencers")} className="!mb-2" /><Link href={`/campaigns/${id}/build`} className="text-[13px] text-accent">{t("Edit in Build Campaign")}</Link></div>
            <table className="w-full min-w-[820px] text-[13px]"><thead><tr className="border-y text-[11.5px] uppercase tracking-wide text-ink-3">{["Influencer", "Role", "Segment", "Deliverables", "Fee", "Est. reach", "Status"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium first:ps-5">{t(h)}</th>)}</tr></thead>
              <tbody className="divide-y">{c.assignments.filter((a) => model.lib[a.influencerId]).map((a) => { const i = model.lib[a.influencerId]; const f = fc.byInfluencer.find((x) => x.influencerId === i.id); return (
                <tr key={i.id}><td className="py-2 pe-3 ps-5"><div className="flex items-center gap-2.5"><Avatar name={i.name} src={i.avatarUrl} size={28} /><div><div className="font-medium">{i.name}</div><div className="text-[11.5px] text-ink-3">{platformLabel(i.platform)} · {compact(i.followers)}</div></div></div></td>
                  <td className="px-3">{a.plan?.role ?? <span className="text-ink-3">—</span>}</td><td className="px-3 text-ink-2">{model.scores[i.id]?.bestSegment?.name ?? "—"}</td><td className="num px-3">{a.deliverables.reduce((s, d) => s + d.count, 0)}</td>
                  <td className="num px-3">{money(a.fee, cur)} <Badge tone={a.feeStatus === "confirmed" ? "good" : a.feeStatus === "quoted" ? "accent" : "neutral"}>{t(a.feeStatus === "confirmed" ? "Confirmed" : a.feeStatus === "quoted" ? "Quoted" : "Estimated")}</Badge></td>
                  <td className="num px-3">{compact(f?.reach ?? 0)}</td><td className="px-3"><Badge>{t(a.status)}</Badge></td></tr>); })}</tbody></table>
          </Card>
          <div className="flex justify-end"><Button variant="primary" size="lg" onClick={() => { setTab("presentation"); window.scrollTo({ top: 0 }); }}>{t("Generate presentation")}</Button></div>
        </div>
      )}
    </div>
  );
}
