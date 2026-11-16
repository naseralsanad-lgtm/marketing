"use client";
import { useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { COLLAB_STATUSES, type CollabStatus } from "@/lib/types";
import type { Model } from "@/lib/model";
import { buildActions } from "@/lib/actions";
import { forecastInfluencer } from "@/lib/forecast";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Avatar, Badge, Card, Empty, Field, Input, NumberInput, Progress, SectionTitle, Select, Toggle, type Tone } from "@/components/ui";
import { compact, cx, money } from "@/lib/utils";

const tone = (s: CollabStatus): Tone => { const i = COLLAB_STATUSES.indexOf(s); return i >= 11 ? "good" : i >= 6 ? "accent" : i >= 2 ? "warn" : "neutral"; };

export function Tracking({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const c = model.campaign; const act = buildActions(c.id); const upd = useStore((s) => s.updateInfluencer); const [open, setOpen] = useState<string | null>(null);
  const rows = c.assignments.filter((a) => model.lib[a.influencerId]);
  if (!rows.length) return <Empty icon={<ClipboardList size={22} />} title={t("Select influencers first")} text={t("Track outreach, quotations, contracts and content status here once creators are selected.")} />;
  const counts = { outreach: rows.filter((a) => COLLAB_STATUSES.indexOf(a.status) < 6).length, confirmed: rows.filter((a) => { const i = COLLAB_STATUSES.indexOf(a.status); return i >= 6 && i < 9; }).length, production: rows.filter((a) => { const i = COLLAB_STATUSES.indexOf(a.status); return i >= 9 && i < 12; }).length, done: rows.filter((a) => COLLAB_STATUSES.indexOf(a.status) >= 12).length };
  const setStatus = (id: string, s: CollabStatus) => {
    const a = rows.find((x) => x.influencerId === id)!;
    act.patch(id, (x) => { x.status = s; if (COLLAB_STATUSES.indexOf(s) >= 6 && x.feeStatus !== "confirmed") x.feeStatus = "confirmed"; });
    // confirmed fees feed the Influencer Library's fee history for future estimates
    if (COLLAB_STATUSES.indexOf(s) >= 6 && a.feeStatus !== "confirmed") upd(id, (i) => { i.feeHistory = [...i.feeHistory.filter((f) => f.campaignId !== c.id), { date: new Date().toISOString().slice(0, 10), amount: a.fee, currency: model.budget.currency, status: "confirmed", campaignId: c.id, campaignName: c.brief.name }]; });
  };
  return (
    <div className="space-y-4">
      <SectionTitle title={t("Collaboration management")} hint={t("Lightweight operational tracking. Setting a status of Confirmed or later marks the fee as confirmed and records it in the Influencer Library.")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{([["Outreach & negotiation", counts.outreach], ["Confirmed & contracted", counts.confirmed], ["In production", counts.production], ["Published & completed", counts.done]] as const).map(([l, n]) => <Card key={l} className="p-4"><div className="num text-[24px] font-semibold">{n}</div><div className="text-[12px] text-ink-2">{t(l)}</div></Card>)}</div>
      <Card className="divide-y">
        {rows.map((a) => { const i = model.lib[a.influencerId]; const idx = COLLAB_STATUSES.indexOf(a.status); const isOpen = open === i.id; const f = forecastInfluencer(i, a); return (
          <div key={i.id}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button onClick={() => onOpen(i.id)} className="flex min-w-[180px] flex-1 items-center gap-2.5 text-start"><Avatar name={i.name} src={i.avatarUrl} size={34} /><span className="min-w-0"><span className="block truncate text-[13.5px] font-medium">{i.name}</span><span className="block text-[11.5px] text-ink-3">{money(a.fee, model.budget.currency)} · {t(a.feeStatus === "confirmed" ? "Confirmed" : a.feeStatus === "quoted" ? "Quoted" : "Estimated")}</span></span></button>
              <div className="hidden w-40 md:block"><Progress value={((idx + 1) / COLLAB_STATUSES.length) * 100} tone={tone(a.status) === "good" ? "good" : "accent"} /></div>
              <Badge tone={tone(a.status)} className="hidden sm:inline-flex">{idx + 1}/{COLLAB_STATUSES.length}</Badge>
              <Select aria-label={t("Status")} className="w-52" value={a.status} onChange={(e) => setStatus(i.id, e.target.value as CollabStatus)}>{COLLAB_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</Select>
              <button aria-label={t("Details")} onClick={() => setOpen(isOpen ? null : i.id)} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><ChevronDown size={16} className={cx("transition-transform", isOpen && "rotate-180")} /></button>
            </div>
            {isOpen && <div className="fade-up grid gap-3 bg-surface-2/50 px-4 py-4 md:grid-cols-2">
              <div className="flex items-center md:col-span-2"><Toggle checked={!!a.ops.eventAccess} onChange={(v) => act.patch(i.id, (x) => { x.ops.eventAccess = v; })} label={t("Event access / accreditation arranged")} /></div>
              <Field label={t("Required approvals")}><Input value={a.ops.approvals ?? ""} onChange={(e) => act.patch(i.id, (x) => { x.ops.approvals = e.target.value; }, `oa${i.id}`)} /></Field>
              <Field label={t("Travel arrangements")}><Input value={a.ops.travel ?? ""} onChange={(e) => act.patch(i.id, (x) => { x.ops.travel = e.target.value; }, `ot${i.id}`)} /></Field>
              <Field label={t("Production requirements")} className="md:col-span-2"><Input value={a.ops.production ?? ""} onChange={(e) => act.patch(i.id, (x) => { x.ops.production = e.target.value; }, `op${i.id}`)} /></Field>
              {idx >= 12 && <div className="md:col-span-2"><div className="mb-2 text-[12.5px] font-medium text-ink-2">{t("Actual results")} <span className="font-normal text-ink-3">— {t("compared with the forecast in the Influencer Library and used to improve future recommendations")}</span></div>
                <div className="grid grid-cols-3 gap-3">{([["reach", "Reach", f.reach], ["views", "Views", f.views], ["engagements", "Engagements", f.engagements]] as const).map(([k, l, fv]) => <Field key={k} label={t(l)} hint={`${t("Forecast")}: ${compact(fv)}`}><NumberInput value={a.actuals?.[k] ?? 0} placeholder="—" onChange={(n) => act.patch(i.id, (x) => { x.actuals = { ...x.actuals, [k]: n || undefined }; }, `ac${k}${i.id}`)} /></Field>)}</div></div>}
            </div>}
          </div>); })}
      </Card>
    </div>
  );
}
