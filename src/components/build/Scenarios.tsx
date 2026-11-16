"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Layers, Plus } from "lucide-react";
import type { Model } from "@/lib/model";
import { buildScenario, SCENARIOS, type ScenarioId, type ScenarioResult } from "@/lib/scenarios";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { buildActions } from "@/lib/actions";
import { Avatar, Badge, Button, Card, Empty, Note, SectionTitle, useUI } from "@/components/ui";
import { compact, cx, money } from "@/lib/utils";

export function Scenarios({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const { toast, confirm } = useUI(); const applyOps = useStore((s) => s.applyOps);
  const c = model.campaign; const cur = model.budget.currency; const act = buildActions(c.id);
  const [open, setOpen] = useState<ScenarioId | null>(null); const [generated, setGenerated] = useState(false);
  const results = useMemo<ScenarioResult[]>(() => generated ? SCENARIOS.map((s) => buildScenario(s.id, model.pool, model.scores, c.brief, c.assignments, model.lib, c.rejected)) : [], [generated, model.pool, model.scores, c.brief, c.assignments, model.lib, c.rejected]);
  const selIds = c.assignments.map((a) => a.influencerId);
  const now = { cost: model.budget.influencerSpend, reach: model.forecast.expected.reach, eng: model.forecast.expected.engagements };
  if (!model.pool.length) return <Empty icon={<Layers size={22} />} title={t("Add creators to the pool first")} text={t("Scenarios are built from the discovery pool.")} />;
  const apply = async (r: ScenarioResult) => {
    const remove = selIds.filter((id) => !r.ids.includes(id)), add = r.ids.filter((id) => !selIds.includes(id));
    if (remove.length && !(await confirm({ title: t("Apply “{name}”?", { name: t(r.name) }), text: t("{a} creator(s) will be added and {r} removed. Locked, mandatory and manually added creators are kept. You can undo this.", { a: add.length, r: remove.length }), confirmLabel: t("Apply scenario") }))) return;
    applyOps(c.id, [...remove.map((id) => ({ op: "remove_influencer" as const, influencerId: id })), ...add.map((id) => ({ op: "add_influencer" as const, influencerId: id }))], r.name);
    toast(t("Scenario applied"), { action: { label: t("Undo"), run: () => useStore.getState().undo(c.id) } });
  };
  return (
    <div className="space-y-4">
      <SectionTitle title={t("Campaign scenarios")} hint={t("Compare different creator mixes built from the same pool and budget. Apply one in full, or pick individual creators from any of them.")} action={<Button variant={generated ? "secondary" : "primary"} icon={<Layers size={14} />} onClick={() => setGenerated(true)}>{t(generated ? "Scenarios are live" : "Generate scenarios")}</Button>} />
      {!generated ? <Empty icon={<Layers size={22} />} title={t("Seven ways to build this campaign")} text={t("Maximum reach, best audience alignment, maximum engagement, best value, balanced, premium and community-focused — each with budget, reach, engagement, coverage and limitations.")} action={<Button variant="primary" onClick={() => setGenerated(true)}>{t("Generate scenarios")}</Button>} /> : <>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="border-b text-[11.5px] uppercase tracking-wide text-ink-3">{["Scenario", "Creators", "Influencer fees", "Est. reach", "Est. engagements", "Avg. match", "Segment coverage", ""].map((h) => <th key={h} className="px-3 py-2.5 text-start font-medium">{h && t(h)}</th>)}</tr></thead>
            <tbody className="divide-y">
              <tr className="bg-surface-2/60"><td className="px-3 py-2.5 font-medium">{t("Current selection")}</td><td className="num px-3">{selIds.length}</td><td className="num px-3">{money(now.cost, cur)}</td><td className="num px-3">{compact(now.reach)}</td><td className="num px-3">{compact(now.eng)}</td><td className="num px-3">{selIds.length ? Math.round(selIds.reduce((s, id) => s + (model.scores[id]?.total ?? 0), 0) / selIds.length) : "—"}</td><td className="px-3"><CoverageDots cov={model.coverage} /></td><td /></tr>
              {results.map((r) => (
                <tr key={r.id} className={cx("cursor-pointer transition hover:bg-surface-2", open === r.id && "bg-accent-soft/40")} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="px-3 py-2.5"><div className="font-medium">{t(r.name)}</div><div className="text-[12px] text-ink-3">{t(r.desc)}</div></td>
                  <td className="num px-3">{r.ids.length}</td><td className="num px-3">{money(r.cost, cur)}</td>
                  <td className="num px-3 font-medium">{compact(r.forecast.reach)}</td><td className="num px-3">{compact(r.forecast.engagements)}</td><td className="num px-3">{r.avgScore}</td>
                  <td className="px-3"><CoverageDots cov={r.coverage} /></td>
                  <td className="px-3 text-end"><Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); apply(r); }}>{t("Apply")}</Button></td>
                </tr>))}
            </tbody>
          </table>
        </Card>
        <p className="text-[12px] text-ink-3">{t("All figures are estimates using the “expected” forecast. Scenarios respect the influencer budget, minimums and exclusions in the brief.")}</p>
        {results.filter((r) => r.id === open).map((r) => (
          <Card key={r.id} className="fade-up p-5">
            <SectionTitle title={t(r.name)} hint={`${r.ids.length} ${t("creators")} · ${money(r.cost, cur)}${r.keptLocked ? ` · ${r.keptLocked} ${t("kept from your selection")}` : ""}`} action={<Button variant="primary" onClick={() => apply(r)}>{t("Apply scenario")}</Button>} />
            {!!r.limitations.length && <Note tone="warn" icon={<AlertTriangle size={14} />} className="mb-4"><b>{t("Potential limitations")}:</b> {r.limitations.join(" · ")}</Note>}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{r.ids.map((id) => { const i = model.lib[id]; const sel = selIds.includes(id); return (
              <div key={id} className="flex items-center gap-2.5 rounded-xl border p-2.5"><button onClick={() => onOpen(id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start"><Avatar name={i.name} src={i.avatarUrl} size={32} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{i.name}</span><span className="block truncate text-[11.5px] text-ink-3">{compact(i.followers)} · {i.platform} · {t("match")} {model.scores[id]?.total}</span></span></button>
                {sel ? <Badge tone="good"><Check size={11} />{t("Selected")}</Badge> : <Button size="sm" icon={<Plus size={12} />} onClick={() => { act.select(id, false); toast(t("{name} added to the campaign", { name: i.name })); }}>{t("Add")}</Button>}</div>); })}</div>
          </Card>))}
      </>}
    </div>
  );
}
function CoverageDots({ cov }: { cov: Model["coverage"] }) {
  if (!cov.length) return <span className="text-ink-3">—</span>;
  return <div className="flex flex-wrap gap-1">{cov.map((s) => <span key={s.segmentId} title={`${s.name}: ${Math.round(s.share * 100)}% vs ${Math.round(s.target * 100)}% target`} className={cx("num rounded-md px-1.5 py-0.5 text-[11px] font-medium", s.status === "under" ? "bg-warn-soft text-warn" : s.status === "unknown" ? "bg-surface-2 text-ink-3" : "bg-good-soft text-good")}>{Math.round(s.share * 100)}%</span>)}</div>;
}
