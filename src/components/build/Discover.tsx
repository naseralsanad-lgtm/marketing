"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, FileSpreadsheet, Heart, LayoutGrid, Lock, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Star, Table2, Undo2, UserPlus, Users, X } from "lucide-react";
import type { Influencer, Weights } from "@/lib/types";
import type { Model } from "@/lib/model";
import { DEFAULT_WEIGHTS, PLATFORMS, platformLabel, tierLabel, tierOf, TIERS, WEIGHT_LABELS } from "@/lib/constants";
import { forecastInfluencer } from "@/lib/forecast";
import { draftAssignment, gapCandidates } from "@/lib/scenarios";
import { buildActions } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { AddManual, CsvImport, ModashSearch } from "./Intake";
import { Avatar, Badge, Button, Card, Empty, IconButton, Input, Modal, Note, ScoreRing, Segmented, Select, SourceBadge, useUI } from "@/components/ui";
import { compact, cx, money, pct } from "@/lib/utils";

type View = "recommended" | "selected" | "favourites" | "rejected";
type Sort = "match" | "followers" | "engagement" | "fee" | "reach";

export function Discover({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus(); const update = useStore((s) => s.update); const loadDemo = useStore((s) => s.loadDemo);
  const c = model.campaign; const act = buildActions(c.id); const cur = model.budget.currency;
  const [view, setView] = useState<View>("recommended"); const [layout, setLayout] = useState<"cards" | "table">("cards"); const [sort, setSort] = useState<Sort>("match");
  const [q, setQ] = useState(""); const [platform, setPlatform] = useState(""); const [tier, setTier] = useState(""); const [segment, setSegment] = useState("");
  const [modal, setModal] = useState<"modash" | "manual" | "csv" | "weights" | null>(null);
  const selIds = useMemo(() => new Set(c.assignments.map((a) => a.influencerId)), [c.assignments]);
  const reach = useMemo(() => Object.fromEntries(model.pool.map((i) => [i.id, forecastInfluencer(i, c.assignments.find((a) => a.influencerId === i.id) ?? draftAssignment(i, c.brief, 0)).reach])), [model.pool, c.assignments, c.brief]);
  const feeOf = (i: Influencer) => c.assignments.find((a) => a.influencerId === i.id)?.fee ?? model.scores[i.id]?.estFee ?? 0;

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return model.pool.filter((i) => {
      if (view === "selected" && !selIds.has(i.id)) return false;
      if (view === "favourites" && !c.favourites.includes(i.id)) return false;
      if (view === "rejected" ? !c.rejected.includes(i.id) : c.rejected.includes(i.id)) return false;
      if (platform && i.platform !== platform) return false;
      if (tier && tierOf(i.followers) !== tier) return false;
      if (segment && model.scores[i.id]?.bestSegment?.segmentId !== segment) return false;
      return !ql || `${i.name} ${i.handle} ${i.categories.join(" ")} ${i.languages.join(" ")} ${i.city ?? ""}`.toLowerCase().includes(ql);
    }).sort((a, b) => sort === "followers" ? b.followers - a.followers : sort === "engagement" ? (b.engagementRate ?? 0) - (a.engagementRate ?? 0) : sort === "fee" ? feeOf(a) - feeOf(b) : sort === "reach" ? reach[b.id] - reach[a.id] : (model.scores[b.id]?.total ?? 0) - (model.scores[a.id]?.total ?? 0));
  }, [model, view, q, platform, tier, segment, sort, selIds, c.favourites, c.rejected, reach]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (i: Influencer) => { const a = c.assignments.find((x) => x.influencerId === i.id); if (a && (a.locked || a.mandatory) && !(await confirm({ title: t("Remove a locked influencer?"), text: t("{name} is locked or marked mandatory. Remove them from this campaign anyway?", { name: i.name }), confirmLabel: t("Remove"), danger: true }))) return; act.remove(i.id); toast(t("{name} removed", { name: i.name }), { action: { label: t("Undo"), run: () => useStore.getState().undo(c.id) } }); };
  const alt = (i: Influencer) => { const seg = model.scores[i.id]?.bestSegment?.segmentId; const cands = (seg ? gapCandidates(seg, model.pool, model.scores, c.brief, [...selIds, i.id], c.rejected, 1) : model.pool.filter((x) => !selIds.has(x.id) && x.id !== i.id && !c.rejected.includes(x.id)).sort((a, b) => model.scores[b.id].total - model.scores[a.id].total)); const next = cands[0]; if (!next) { toast(t("No alternative available in the pool."), { tone: "warn" }); return; } act.reject(i.id); onOpen(next.id); toast(t("Showing an alternative: {name}", { name: next.name })); };
  const gaps = model.coverage.filter((s) => s.status === "under");
  const demoInPool = model.pool.some((i) => i.source === "demo");

  const Actions = ({ i, compactMode }: { i: Influencer; compactMode?: boolean }) => {
    const a = c.assignments.find((x) => x.influencerId === i.id);
    if (view === "rejected") return <Button size="sm" icon={<Undo2 size={13} />} onClick={() => act.unreject(i.id)}>{t("Restore")}</Button>;
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {a ? <Button size="sm" variant="soft" icon={a.locked ? <Lock size={12} /> : <Check size={13} />} onClick={() => remove(i)} title={t("Click to remove")}>{t("Selected")}</Button> : <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => act.select(i.id, true)}>{t(compactMode ? "Add" : "Accept")}</Button>}
        <IconButton label={t("Favourite")} onClick={() => act.favourite(i.id)}><Heart size={15} className={c.favourites.includes(i.id) ? "fill-bad text-bad" : ""} /></IconButton>
        {a ? <IconButton label={a.locked ? t("Unlock") : t("Lock")} active={a.locked} onClick={() => act.patch(i.id, (x) => { x.locked = !x.locked; })}><Lock size={14} /></IconButton>
          : <><IconButton label={t("Request an alternative")} onClick={() => alt(i)}><RotateCcw size={14} /></IconButton><IconButton label={t("Reject")} onClick={() => { act.reject(i.id); toast(t("{name} rejected", { name: i.name }), { action: { label: t("Undo"), run: () => act.unreject(i.id) } }); }}><X size={15} /></IconButton></>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {demoInPool && <Note tone="warn" icon={<AlertTriangle size={14} />}><b>{t("Demonstration mode.")}</b> {t("The pool contains fictional sample creators so you can explore the workflow. Their figures are illustrative and are not verified influencer analytics.")} {!status?.modash.configured && t("Connect Modash, add creators manually or import a CSV to work with real data.")}</Note>}
      {gaps.length > 0 && selIds.size > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold"><Sparkles size={15} className="text-accent" />{t("Audience coverage gaps")}</div>
          <div className="space-y-3">{gaps.map((g) => { const cands = gapCandidates(g.segmentId, model.pool, model.scores, c.brief, [...selIds], c.rejected, 3); return (
            <div key={g.segmentId} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]"><span className="min-w-[220px] flex-1"><b className="font-medium">{g.name}</b> <span className="text-ink-2">— {Math.round(g.share * 100)}% {t("of estimated reach vs a")} {Math.round(g.target * 100)}% {t("target")}</span></span>
              {cands.map((i) => <button key={i.id} onClick={() => onOpen(i.id)} className="flex items-center gap-1.5 rounded-full border bg-surface py-1 pe-1 ps-1 transition hover:bg-surface-2"><Avatar name={i.name} src={i.avatarUrl} size={22} /><span className="text-[12.5px]">{i.name}</span><span role="button" tabIndex={0} aria-label={t("Add")} onClick={(e) => { e.stopPropagation(); act.select(i.id, false); }} className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white"><Plus size={13} /></span></button>)}
              {!cands.length && <span className="text-[12.5px] text-ink-3">{t("No matching creators in the pool — widen discovery.")}</span>}</div>); })}</div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ id: "recommended", label: `${t("Recommended")} ${model.pool.length - c.rejected.length}` }, { id: "selected", label: `${t("Selected")} ${selIds.size}` }, { id: "favourites", label: `${t("Favourites")} ${c.favourites.length}` }, { id: "rejected", label: `${t("Rejected")} ${c.rejected.length}` }]} />
        <span className="flex-1" />
        <Button size="sm" icon={<Search size={13} />} onClick={() => setModal("modash")}>{t("Search Modash")}</Button>
        <Button size="sm" icon={<UserPlus size={13} />} onClick={() => setModal("manual")}>{t("Add manually")}</Button>
        <Button size="sm" icon={<FileSpreadsheet size={13} />} onClick={() => setModal("csv")}>{t("Import CSV")}</Button>
        <Button size="sm" variant="ghost" icon={<SlidersHorizontal size={13} />} onClick={() => setModal("weights")}>{t("Scoring")}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1"><Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, handle, category, language…")} className="!ps-8" /></div>
        <Select aria-label={t("Platform")} className="w-36" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("All platforms")}</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
        <Select aria-label={t("Tier")} className="w-32" value={tier} onChange={(e) => setTier(e.target.value)}><option value="">{t("All tiers")}</option>{TIERS.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}</Select>
        {c.brief.segments.length > 0 && <Select aria-label={t("Segment")} className="w-48" value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">{t("All segments")}</option>{c.brief.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
        <Select aria-label={t("Sort")} className="w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="match">{t("Sort: Match score")}</option><option value="reach">{t("Sort: Est. reach")}</option><option value="followers">{t("Sort: Followers")}</option><option value="engagement">{t("Sort: Engagement")}</option><option value="fee">{t("Sort: Fee (low first)")}</option></Select>
        <Segmented size="sm" value={layout} onChange={setLayout} options={[{ id: "cards", label: <LayoutGrid size={14} aria-label={t("Card view")} /> }, { id: "table", label: <Table2 size={14} aria-label={t("Comparison table")} /> }]} />
      </div>

      {!model.pool.length ? <Empty icon={<Users size={22} />} title={t("Your discovery pool is empty")} text={t("Search Modash, add creators by profile URL, import a CSV — or load the clearly-labelled demonstration creators to explore.")} action={<><Button variant="primary" onClick={() => setModal(status?.modash.configured ? "modash" : "manual")}>{t(status?.modash.configured ? "Search Modash" : "Add manually")}</Button><Button onClick={() => { loadDemo(); const ids = Object.values(useStore.getState().library).filter((i) => i.source === "demo").map((i) => i.id); act.addCandidates(ids); }}>{t("Use demonstration creators")}</Button></>} />
        : !list.length ? <Empty icon={<Ban size={20} />} title={t("Nothing matches these filters")} action={<Button onClick={() => { setQ(""); setPlatform(""); setTier(""); setSegment(""); }}>{t("Clear filters")}</Button>} />
        : layout === "cards" ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((i) => { const s = model.scores[i.id]; const a = c.assignments.find((x) => x.influencerId === i.id); const top = [...(i.audience?.countries ?? [])].sort((x, y) => y.weight - x.weight)[0]; return (
              <Card key={i.id} onClick={() => onOpen(i.id)} className={cx("fade-up flex cursor-pointer flex-col p-4 transition-shadow hover:shadow-pop", a && "ring-1 ring-accent/50")}>
                <div className="flex items-start gap-3">
                  <Avatar name={i.name} src={i.avatarUrl} size={46} />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-[15px] font-semibold">{i.name}</span>{a?.mandatory && <Star size={12} className="shrink-0 fill-warn text-warn" />}</div>
                    <div className="truncate text-[12.5px] text-ink-2">@{i.handle} · {platformLabel(i.platform)} · {t(tierLabel(tierOf(i.followers)))}</div>
                    <div className="mt-1 flex flex-wrap gap-1"><SourceBadge source={i.source} />{s?.bestSegment && s.bestSegment.fit >= 55 && <Badge tone="accent">{s.bestSegment.name}</Badge>}</div></div>
                  {s && <ScoreRing score={s.total} />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">{[[t("Followers"), compact(i.followers)], [t("Engagement"), pct(i.engagementRate)], [t("Avg. views"), compact(i.avgViews)]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-2 py-2"><div className="num text-[15px] font-semibold">{v}</div><div className="text-[11px] text-ink-3">{l}</div></div>)}</div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-ink-3">{t("Audience location")}</dt><dd className="truncate text-end">{top ? `${top.name} ${Math.round(top.weight * 100)}%` : "—"}</dd>
                  <dt className="text-ink-3">{t("Primary language")}</dt><dd className="truncate text-end">{i.languages[0] ?? "—"}</dd>
                  <dt className="text-ink-3">{t(a ? (a.feeStatus === "confirmed" ? "Confirmed fee" : a.feeStatus === "quoted" ? "Quoted fee" : "Estimated fee") : "Estimated fee")}</dt><dd className="num text-end font-medium">{money(feeOf(i), cur)}</dd>
                  <dt className="text-ink-3">{t("Est. contribution")}</dt><dd className="num text-end">{compact(reach[i.id])} {t("reach")}</dd>
                </dl>
                <p className="mt-3 line-clamp-2 min-h-[34px] flex-1 text-[12.5px] text-ink-2">{s?.reasons.length ? s.reasons.slice(0, 2).join(" · ") : t("No standout strengths for this brief.")}{s?.concerns.length ? <span className="text-warn"> · {s.concerns[0]}</span> : null}</p>
                <div className="mt-3 flex items-center justify-between border-t pt-3"><Actions i={i} /></div>
              </Card>); })}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead><tr className="border-b text-start text-[11.5px] uppercase tracking-wide text-ink-3">{["Influencer", "Match", "Followers", "Engagement", "Avg. views", "Top audience", "Language", "Authenticity", "Fee", "Est. reach", ""].map((h) => <th key={h} className="px-3 py-2.5 text-start font-medium">{h && t(h)}</th>)}</tr></thead>
              <tbody className="divide-y">{list.map((i) => { const s = model.scores[i.id]; const top = [...(i.audience?.countries ?? [])].sort((x, y) => y.weight - x.weight)[0]; return (
                <tr key={i.id} onClick={() => onOpen(i.id)} className={cx("cursor-pointer transition hover:bg-surface-2", selIds.has(i.id) && "bg-accent-soft/40")}>
                  <td className="px-3 py-2"><div className="flex items-center gap-2.5"><Avatar name={i.name} src={i.avatarUrl} size={30} /><div className="min-w-0"><div className="truncate font-medium">{i.name}</div><div className="truncate text-[11.5px] text-ink-3">@{i.handle} · {platformLabel(i.platform)} {i.source === "demo" && "· demo"}</div></div></div></td>
                  <td className="px-3"><span className={cx("num font-semibold", s?.total >= 75 ? "text-good" : s?.total < 45 ? "text-warn" : "")}>{s?.total ?? "—"}</span></td>
                  <td className="num px-3">{compact(i.followers)}</td><td className="num px-3">{pct(i.engagementRate)}</td><td className="num px-3">{compact(i.avgViews)}</td>
                  <td className="px-3">{top ? `${top.name} ${Math.round(top.weight * 100)}%` : "—"}</td><td className="px-3">{i.languages[0] ?? "—"}</td><td className="num px-3">{pct(i.audience?.credibility, 0)}</td>
                  <td className="num px-3">{money(feeOf(i), cur)}</td><td className="num px-3">{compact(reach[i.id])}</td><td className="px-3 py-1.5"><Actions i={i} compactMode /></td>
                </tr>); })}</tbody>
            </table>
          </Card>
        )}

      <ModashSearch open={modal === "modash"} onClose={() => setModal(null)} model={model} />
      <AddManual open={modal === "manual"} onClose={() => setModal(null)} model={model} />
      <CsvImport open={modal === "csv"} onClose={() => setModal(null)} model={model} />
      <Modal open={modal === "weights"} onClose={() => setModal(null)} title={t("Campaign Match Score — scoring weights")} footer={<><Button variant="ghost" onClick={() => update(c.id, (d) => { d.weights = { ...DEFAULT_WEIGHTS }; })}>{t("Reset to defaults")}</Button><Button variant="primary" onClick={() => setModal(null)}>{t("Done")}</Button></>}>
        <p className="mb-4 text-[13px] text-ink-2">{t("Each creator is scored out of 100 on seven criteria. Adjust how much each one matters; scores update instantly. Weights are normalised, so they do not need to total 100.")}</p>
        <div className="space-y-4">{(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((k) => (
          <div key={k}><div className="mb-1 flex justify-between text-[13px]"><span>{t(WEIGHT_LABELS[k])}</span><span className="num font-semibold">{c.weights[k]}%</span></div><input type="range" min={0} max={60} step={5} value={c.weights[k]} aria-label={t(WEIGHT_LABELS[k])} onChange={(e) => update(c.id, (d) => { d.weights[k] = +e.target.value; }, `w${k}`)} className="w-full accent-[var(--accent)]" /></div>))}</div>
        <div className="mt-3 text-[12.5px] text-ink-3">{t("Total")}: {Object.values(c.weights).reduce((a, b) => a + b, 0)}%</div>
      </Modal>
    </div>
  );
}
