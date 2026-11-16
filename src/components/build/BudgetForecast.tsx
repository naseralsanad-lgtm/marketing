"use client";
import { useState } from "react";
import { AlertTriangle, Lightbulb, TrendingUp, Wallet } from "lucide-react";
import type { Budget } from "@/lib/types";
import type { Model } from "@/lib/model";
import { platformLabel, tierLabel, tierOf } from "@/lib/constants";
import type { ScenarioKey } from "@/lib/forecast";
import { buildActions } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Columns, Donut, PALETTE, ShareBars } from "@/components/Charts";
import { Avatar, Badge, Button, Card, Empty, Note, NumberInput, Progress, SectionTitle, Segmented, Select, SourceBadge, Stat } from "@/components/ui";
import { compact, cx, money, num } from "@/lib/utils";

export function BudgetTab({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const update = useStore((s) => s.update); const c = model.campaign; const B = model.budget; const cur = B.currency; const act = buildActions(c.id); const fc = model.forecast.expected;
  const setB = (k: keyof Budget, v: number) => update(c.id, (d) => { (d.brief.budget[k] as number) = v; }, `bud${k}`);
  const rows = c.assignments.filter((a) => model.lib[a.influencerId]);
  const suggestions: string[] = [];
  if (B.over || B.influencerOver) {
    const over = B.over ? -B.remaining : -B.influencerRemaining;
    const est = rows.filter((a) => a.feeStatus === "estimated"); if (est.length) suggestions.push(t("{n} fee(s) are estimates. Requesting quotations may bring the total down — or confirm it.", { n: est.length }));
    const cand = rows.filter((a) => !a.locked && !a.mandatory).map((a) => ({ a, v: (model.scores[a.influencerId]?.total ?? 50) / Math.max(a.fee, 1) })).sort((x, y) => x.v - y.v)[0];
    if (cand) suggestions.push(t("Releasing {name} ({fee}, match {score}) would recover {pct}% of the overspend with the smallest loss of fit.", { name: model.lib[cand.a.influencerId].name, fee: money(cand.a.fee, cur), score: model.scores[cand.a.influencerId]?.total ?? "—", pct: Math.min(100, Math.round((cand.a.fee / over) * 100)) }));
    const big = [...rows].sort((x, y) => y.deliverables.reduce((s, d) => s + d.count, 0) - x.deliverables.reduce((s, d) => s + d.count, 0))[0];
    if (big) suggestions.push(t("Reduce deliverables for {name} and renegotiate a smaller package.", { name: model.lib[big.influencerId].name }));
    if (B.amplification > 0) suggestions.push(t("Move part of the paid amplification budget ({v}) to creator fees.", { v: money(B.amplification, cur) }));
    if (B.contingency > 0) suggestions.push(t("Draw on the contingency reserve ({v}) — it is not counted as planned spend.", { v: money(B.contingency, cur) }));
  }
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label={t("Total allocated budget")} value={money(B.total, cur)} />
          <Stat label={t("Planned spend")} value={money(B.grand, cur)} sub={`${t("incl.")} ${money(B.taxes, cur)} ${t("tax")}`} tone={B.over ? "bad" : undefined} />
          <Stat label={t("Remaining budget")} value={money(B.remaining, cur)} tone={B.over ? "bad" : "good"} sub={B.contingency ? `${t("of which contingency")} ${money(B.contingency, cur)}` : undefined} />
          <Stat label={t("Budget utilisation")} value={B.total ? `${Math.round(B.utilisation * 100)}%` : "—"} tone={B.over ? "bad" : B.utilisation > 0.9 ? "warn" : undefined} />
        </div>
        <div className="mt-5"><Progress value={B.utilisation * 100} tone={B.over ? "bad" : B.utilisation > 0.9 ? "warn" : "accent"} /></div>
        <div className="mt-5 grid grid-cols-2 gap-6 border-t pt-5 md:grid-cols-4">
          <Stat label={t("Confirmed influencer fees")} value={money(B.confirmed, cur)} className="[&_.num]:!text-[19px]" />
          <Stat label={t("Quoted influencer fees")} value={money(B.quoted, cur)} className="[&_.num]:!text-[19px]" />
          <Stat label={t("Estimated influencer fees")} value={money(B.estimated, cur)} className="[&_.num]:!text-[19px]" />
          <Stat label={t("Est. CPM / cost per engagement")} value={`${fc.cpm ? fc.cpm.toFixed(0) : "—"} / ${fc.cpe ? fc.cpe.toFixed(2) : "—"}`} sub={`${cur} · ${t("estimated")}`} className="[&_.num]:!text-[19px]" />
        </div>
      </Card>
      {(B.over || B.influencerOver) && (
        <Card className="border-bad/40 p-5"><div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-bad"><AlertTriangle size={16} />{B.over ? t("Planned spend exceeds the budget by {v}", { v: money(-B.remaining, cur) }) : t("Influencer fees exceed the influencer allocation by {v}", { v: money(-B.influencerRemaining, cur) })}</div>
          <p className="mb-2 text-[13px] text-ink-2">{t("Nothing has been changed. Here are practical options — you decide:")}</p>
          <ul className="space-y-1.5">{suggestions.map((s) => <li key={s} className="flex gap-2 text-[13px]"><Lightbulb size={14} className="mt-0.5 shrink-0 text-warn" />{s}</li>)}</ul></Card>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto">
          <div className="px-5 pt-4"><SectionTitle title={t("Influencer fees")} hint={t("Edit a fee or its status — everything recalculates instantly.")} /></div>
          {rows.length ? <table className="w-full min-w-[640px] text-[13px]"><thead><tr className="border-y text-[11.5px] uppercase tracking-wide text-ink-3"><th className="px-5 py-2 text-start font-medium">{t("Influencer")}</th><th className="px-2 text-start font-medium">{t("Deliverables")}</th><th className="px-2 text-start font-medium">{t("Fee")} ({cur})</th><th className="px-2 text-start font-medium">{t("Status")}</th><th className="px-5 text-end font-medium">{t("Est. CPM")}</th></tr></thead>
            <tbody className="divide-y">{rows.map((a) => { const i = model.lib[a.influencerId]; const f = fc.byInfluencer.find((x) => x.influencerId === i.id); return (
              <tr key={i.id}><td className="px-5 py-2"><button className="flex items-center gap-2.5 text-start" onClick={() => onOpen(i.id)}><Avatar name={i.name} src={i.avatarUrl} size={28} /><span className="font-medium">{i.name}</span></button></td>
                <td className="num px-2 text-ink-2">{a.deliverables.reduce((s, d) => s + d.count, 0)}</td>
                <td className="px-2 py-1.5"><NumberInput aria-label={`${t("Fee")} ${i.name}`} className="!w-32 !py-1" value={a.fee} onChange={(n) => act.patch(i.id, (x) => { x.fee = n; }, `fee${i.id}`)} /></td>
                <td className="px-2"><Select className={cx("w-32", a.feeStatus === "confirmed" && "[&_select]:text-good")} value={a.feeStatus} onChange={(e) => act.patch(i.id, (x) => { x.feeStatus = e.target.value as "quoted"; })}><option value="estimated">{t("Estimated")}</option><option value="quoted">{t("Quoted")}</option><option value="confirmed">{t("Confirmed")}</option></Select></td>
                <td className="num px-5 text-end text-ink-2">{f?.impressions ? ((a.fee / f.impressions) * 1000).toFixed(0) : "—"}</td></tr>); })}</tbody>
            <tfoot><tr className="border-t font-semibold"><td className="px-5 py-2.5">{t("Total")}</td><td /><td className="num px-2">{num(B.influencerSpend)}</td><td className="px-2 text-[12px] font-normal text-ink-3" colSpan={2}>{B.influencerAllocated ? `${t("allocation")} ${money(B.influencerAllocated, cur)}` : ""}</td></tr></tfoot></table>
            : <div className="p-5"><Empty icon={<Wallet size={20} />} title={t("No influencers selected")} /></div>}
        </Card>
        <div className="space-y-5">
          <Card className="p-5"><SectionTitle title={t("Budget allocation")} />
            <Donut data={[{ name: t("Influencer fees"), value: B.influencerSpend }, { name: t("Production"), value: B.production }, { name: t("Paid amplification"), value: B.amplification }, { name: t("Travel"), value: B.travel }, { name: t("Additional"), value: B.additional }, { name: t("Taxes"), value: B.taxes }, { name: t("Contingency"), value: B.contingency, color: "#c7c7cc" }]} format={(n) => compact(n)} center={{ value: compact(B.grand), label: cur }} /></Card>
          <Card className="space-y-3 p-5"><SectionTitle title={t("Other costs")} className="!mb-1" />
            {([["production", "Content production"], ["travel", "Travel and accommodation"], ["amplification", "Paid amplification"], ["additional", "Additional expenses"], ["contingency", "Contingency"], ["influencer", "Influencer allocation"]] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between gap-3 text-[13px]"><span className="text-ink-2">{t(l)}</span><NumberInput className="!w-36 !py-1" value={c.brief.budget[k]} onChange={(n) => setB(k, n)} /></label>)}
            <label className="flex items-center justify-between gap-3 text-[13px]"><span className="text-ink-2">{t("Applicable taxes (%)")}</span><NumberInput className="!w-36 !py-1" value={c.brief.budget.taxRate} onChange={(n) => setB("taxRate", Math.min(100, n))} /></label>
            {c.brief.budget.mode === "total" && <label className="flex items-center justify-between gap-3 border-t pt-3 text-[13px] font-medium"><span>{t("Total campaign budget")}</span><NumberInput className="!w-36 !py-1" value={c.brief.budget.total} onChange={(n) => setB("total", n)} /></label>}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ForecastTab({ model }: { model: Model }) {
  const t = useT(); const [sc, setSc] = useState<ScenarioKey>("expected"); const [showMethod, setShowMethod] = useState(false);
  const fc = model.forecast[sc]; const cur = model.budget.currency; const D = model.dist;
  if (!model.selected.length) return <Empty icon={<TrendingUp size={22} />} title={t("Select influencers first")} text={t("The forecast is calculated from the selected creators and their planned deliverables.")} />;
  const tone = model.dataQuality.level === "high" ? "good" : model.dataQuality.level === "medium" ? "accent" : "warn";
  return (
    <div className="space-y-5">
      <SectionTitle title={t("Campaign impact forecast")} hint={t("Estimates from available influencer data and planned deliverables — never guaranteed outcomes.")} action={<Segmented value={sc} onChange={setSc} options={[{ id: "conservative", label: t("Conservative") }, { id: "expected", label: t("Expected") }, { id: "optimistic", label: t("Optimistic") }]} />} />
      <Note tone={tone}><b>{t("Confidence")}:</b> {t(model.dataQuality.label)}. {model.dataQuality.modash} Modash · {model.dataQuality.manual} {t("manual / CSV")} · {model.dataQuality.demo} {t("demonstration")}. {D.dataShare < 1 && t("Audience distributions are based on the {p}% of estimated reach that has audience data.", { p: Math.round(D.dataShare * 100) })}</Note>
      <Card className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
        <Stat label={t("Estimated unique reach")} value={compact(fc.reach)} sub={t("de-duplicated estimate")} />
        <Stat label={t("Estimated total impressions")} value={compact(fc.impressions)} />
        <Stat label={t("Estimated video views")} value={compact(fc.views)} />
        <Stat label={t("Estimated engagements")} value={compact(fc.engagements)} />
        <Stat label={t("Combined follower base")} value={compact(fc.followers)} sub={t("not reach — includes overlap and inactive followers")} />
        <Stat label={t("Estimated CPM")} value={fc.cpm ? `${cur} ${fc.cpm.toFixed(0)}` : "—"} />
        <Stat label={t("Estimated cost per engagement")} value={fc.cpe ? `${cur} ${fc.cpe.toFixed(2)}` : "—"} />
        <Stat label={t("Content deliverables")} value={fc.deliverables} />
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><SectionTitle title={t("Three performance scenarios")} hint={t("Estimated unique reach")} /><Columns data={(["conservative", "expected", "optimistic"] as const).map((k) => ({ name: t(k[0].toUpperCase() + k.slice(1)), value: Math.round(model.forecast[k].reach), color: k === sc ? "var(--accent)" : "var(--line-strong)" }))} /></Card>
        <Card className="p-5"><SectionTitle title={t("Target audience coverage")} hint={t("Share of estimated reach per segment vs. desired coverage (marker)")} />
          {model.coverage.length ? <ShareBars data={model.coverage.map((s) => ({ name: s.name, value: s.share, color: s.status === "under" ? "var(--warn)" : "var(--accent)" }))} targets={Object.fromEntries(model.coverage.map((s) => [s.name, s.target]))} max={Math.max(0.5, ...model.coverage.map((s) => Math.max(s.share, s.target)))} /> : <p className="text-[13px] text-ink-3">{t("Define audience segments in the brief to measure coverage.")}</p>}</Card>
        <Card className="p-5"><SectionTitle title={t("Audience geographic distribution")} /><ShareBars data={D.countries.map((x) => ({ name: x.name, value: x.weight }))} /></Card>
        <Card className="p-5"><SectionTitle title={t("Language distribution")} /><ShareBars data={D.languages.map((x) => ({ name: x.name, value: x.weight }))} /></Card>
        <Card className="p-5"><SectionTitle title={t("Age distribution")} /><Columns height={170} data={D.ages.map((x) => ({ name: x.name, value: +(x.weight * 100).toFixed(1) }))} format={(n) => `${Math.round(n)}%`} /></Card>
        <Card className="p-5"><SectionTitle title={t("Platform distribution")} hint={t("Share of estimated reach")} /><Donut height={150} data={D.platforms.map((x, i) => ({ name: platformLabel(x.name as "instagram"), value: x.weight, color: PALETTE[i % PALETTE.length] }))} format={(n) => `${Math.round(n * 100)}%`} /></Card>
      </div>
      <Card className="overflow-x-auto">
        <div className="px-5 pt-4"><SectionTitle title={t("Contribution by influencer")} /></div>
        <table className="w-full min-w-[640px] text-[13px]"><thead><tr className="border-y text-[11.5px] uppercase tracking-wide text-ink-3">{["Influencer", "Tier", "Est. reach", "Impressions", "Views", "Engagements", "Basis"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium first:ps-5">{t(h)}</th>)}</tr></thead>
          <tbody className="divide-y">{[...fc.byInfluencer].sort((a, b) => b.reach - a.reach).map((p) => { const i = model.lib[p.influencerId]; return <tr key={i.id}><td className="py-2 ps-5 pe-4"><span className="font-medium">{i.name}</span> {i.source === "demo" && <SourceBadge source="demo" />}</td><td className="px-4 text-ink-2">{t(tierLabel(tierOf(i.followers)))}</td><td className="num px-4 font-medium">{compact(p.reach)}</td><td className="num px-4">{compact(p.impressions)}</td><td className="num px-4">{compact(p.views)}</td><td className="num px-4">{compact(p.engagements)}</td><td className="px-4"><Badge>{t(p.basis === "views" ? "Average views" : "Followers × rate")}</Badge>{p.assumedEngagement && <Badge tone="warn" className="ms-1">{t("ER assumed")}</Badge>}</td></tr>; })}</tbody></table>
      </Card>
      <Card className="p-5">
        <button className="flex w-full items-center justify-between text-start" onClick={() => setShowMethod(!showMethod)}><span className="text-[15px] font-semibold">{t("Methodology and assumptions")}</span><span className="text-[13px] text-accent">{t(showMethod ? "Hide" : "Show")}</span></button>
        {showMethod && <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[13px] text-ink-2">
          <li>{t("Reach per deliverable = the creator’s average views (video formats, when the data source provides them), otherwise followers × a format reach rate × a tier factor (larger accounts reach a smaller share of their followers).")}</li>
          <li>{t("Reach per creator = their largest single deliverable + 35% of the remaining deliverables (repeat exposure), capped at 90% of followers.")}</li>
          <li>{t("Campaign unique reach de-duplicates creators who share a platform and main audience country: each additional creator in a group contributes less. The overlap rate is an assumption (25% conservative, 15% expected, 8% optimistic) because measured audience-overlap data is not available.")}</li>
          <li>{t("Impressions = deliverable reach × 1.15 frequency. Engagements = followers × engagement rate × a format factor. Missing engagement rates use a tier benchmark and are flagged.")}</li>
          <li>{t("Conservative assumes 65% and optimistic 135% of expected delivery.")}</li>
          <li>{t("Combined followers are shown for context only and are never used as reach.")}</li>
          <li>{t("CPM and cost per engagement divide total planned spend (including production, amplification and taxes) by estimated impressions and engagements. Paid amplification uplift is not modelled.")}</li>
        </ul>}
      </Card>
    </div>
  );
}
