"use client";
import { useMemo, useState } from "react";
import { BookUser, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import type { Influencer } from "@/lib/types";
import { PLATFORMS, platformLabel, tierLabel, tierOf } from "@/lib/constants";
import { forecastInfluencer } from "@/lib/forecast";
import { estimateFee } from "@/lib/scoring";
import { refreshFromModash } from "@/components/build/ProfilePanel";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Page } from "@/components/Shell";
import { ShareBars } from "@/components/Charts";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Note, NumberInput, Select, Sheet, SourceBadge, Textarea, useUI } from "@/components/ui";
import { compact, cx, fmtDate, money, pct } from "@/lib/utils";

function Stars({ value, onChange, label }: { value?: number; onChange: (n: number) => void; label: string }) {
  return <div className="flex items-center justify-between gap-3 text-[13px]"><span className="text-ink-2">{label}</span><span className="flex">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${label} ${n}/5`} onClick={() => onChange(value === n ? 0 : n)} className="p-0.5"><Star size={16} className={cx(n <= (value ?? 0) ? "fill-warn text-warn" : "text-line-strong")} /></button>)}</span></div>;
}

export default function Library() {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus();
  const lib = useStore((s) => s.library); const campaigns = useStore((s) => s.campaigns); const { updateInfluencer, upsertInfluencers, removeInfluencer } = useStore.getState();
  const [q, setQ] = useState(""); const [platform, setPlatform] = useState(""); const [source, setSource] = useState(""); const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const history = useMemo(() => { const h: Record<string, { c: (typeof campaigns)[string]; a: (typeof campaigns)[string]["assignments"][number] }[]> = {}; for (const c of Object.values(campaigns)) for (const a of c.assignments) (h[a.influencerId] ??= []).push({ c, a }); return h; }, [campaigns]);
  const list = useMemo(() => Object.values(lib).filter((i) => (!platform || i.platform === platform) && (!source || i.source === source) && `${i.name} ${i.handle} ${i.categories.join(" ")}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (history[b.id]?.length ?? 0) - (history[a.id]?.length ?? 0) || b.followers - a.followers), [lib, q, platform, source, history]);
  const inf = open ? lib[open] : null; const upd = (fn: (i: Influencer) => void) => inf && updateInfluencer(inf.id, fn);
  const canRefresh = inf && status?.modash.configured && ["instagram", "tiktok", "youtube"].includes(inf.platform);
  return (
    <Page wide title={t("Influencer Library")} subtitle={t("Your reusable creator database. It grows with every campaign — fees, ratings, notes and results.")}>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, handle, category, language…")} className="!ps-8" /></div>
        <Select className="w-40" aria-label={t("Platform")} value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("All platforms")}</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
        <Select className="w-44" aria-label={t("Data source")} value={source} onChange={(e) => setSource(e.target.value)}><option value="">{t("All sources")}</option><option value="modash">Modash</option><option value="manual">{t("Manual")}</option><option value="csv">{t("CSV import")}</option><option value="demo">{t("Demo data")}</option></Select>
      </div>
      {!list.length ? <Empty icon={<BookUser size={22} />} title={t("No influencers yet")} text={t("Creators are added here automatically when you discover, add or import them in a campaign.")} /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]"><thead><tr className="border-b text-[11.5px] uppercase tracking-wide text-ink-3">{["Influencer", "Platform", "Followers", "Engagement", "Campaigns", "Last fee", "Rating", "Approval", "Analytics updated"].map((h) => <th key={h} className="px-3 py-2.5 text-start font-medium first:ps-5">{t(h)}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map((i) => { const last = i.feeHistory[i.feeHistory.length - 1]; return (
              <tr key={i.id} onClick={() => setOpen(i.id)} className="cursor-pointer transition hover:bg-surface-2">
                <td className="py-2 pe-3 ps-5"><div className="flex items-center gap-2.5"><Avatar name={i.name} src={i.avatarUrl} size={32} /><div className="min-w-0"><div className="flex items-center gap-1.5 font-medium">{i.name}<SourceBadge source={i.source} /></div><div className="text-[11.5px] text-ink-3">@{i.handle} · {t(tierLabel(tierOf(i.followers)))}</div></div></div></td>
                <td className="px-3">{platformLabel(i.platform)}</td><td className="num px-3">{compact(i.followers)}</td><td className="num px-3">{pct(i.engagementRate)}</td><td className="num px-3">{history[i.id]?.length ?? 0}</td>
                <td className="num px-3">{last ? money(last.amount, last.currency) : "—"}</td><td className="num px-3">{i.ratings?.overall ? `${i.ratings.overall}/5` : "—"}</td>
                <td className="px-3"><Badge tone={i.approvalStatus === "approved" ? "good" : i.approvalStatus === "blocked" ? "bad" : "neutral"}>{t(i.approvalStatus === "approved" ? "Approved" : i.approvalStatus === "blocked" ? "Blocked" : "Pending")}</Badge></td>
                <td className="px-3 text-ink-2">{i.fetchedAt ? fmtDate(i.fetchedAt.slice(0, 10)) : "—"}</td></tr>); })}</tbody></table>
        </Card>)}
      <Sheet open={!!inf} onClose={() => setOpen(null)} width={600} title={inf ? <span className="flex items-center gap-2">{inf.name}<SourceBadge source={inf.source} /></span> : ""}
        footer={inf && <><Button variant="danger" icon={<Trash2 size={14} />} onClick={async () => { const used = history[inf.id]?.length ?? 0; if (await confirm({ title: t("Delete from the library?"), text: used ? t("{name} is used in {n} campaign(s) and will be removed from them too.", { name: inf.name, n: used }) : t("{name} will be removed from your library.", { name: inf.name }), confirmLabel: t("Delete"), danger: true })) { for (const { c } of history[inf.id] ?? []) useStore.getState().update(c.id, (d) => { d.assignments = d.assignments.filter((a) => a.influencerId !== inf.id); d.events = d.events.filter((e) => e.influencerId !== inf.id); }); for (const c of Object.values(useStore.getState().campaigns)) if (c.candidates.includes(inf.id)) useStore.getState().update(c.id, (d) => { d.candidates = d.candidates.filter((x) => x !== inf.id); }); setOpen(null); removeInfluencer(inf.id); toast(t("Deleted")); } }}>{t("Delete")}</Button><span className="flex-1" /><Button variant="primary" onClick={() => setOpen(null)}>{t("Done")}</Button></>}>
        {inf && <div className="space-y-5">
          <div className="flex items-center gap-4"><Avatar name={inf.name} src={inf.avatarUrl} size={60} /><div className="min-w-0 flex-1"><div className="text-[13px] text-ink-2">@{inf.handle} · {platformLabel(inf.platform)} · {compact(inf.followers)} {t("followers")}</div><div className="text-[12px] text-ink-3">{[inf.city, inf.country].filter(Boolean).join(", ")} {inf.languages.length ? `· ${inf.languages.join(", ")}` : ""}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">{t("Analytics updated")}: {inf.fetchedAt ? fmtDate(inf.fetchedAt.slice(0, 10)) : "—"}{canRefresh ? <Button size="sm" variant="ghost" loading={busy} icon={<RefreshCw size={12} />} onClick={async () => { setBusy(true); try { upsertInfluencers([await refreshFromModash(inf)]); toast(t("Analytics refreshed from Modash")); } catch (e) { toast((e as Error).message, { tone: "bad" }); } setBusy(false); }}>{t("Refresh via Modash")}</Button> : <span>· {t(status?.modash.configured ? "Modash does not cover this platform" : "Connect Modash to refresh")}</span>}</div></div></div>
          {inf.source === "demo" && <Note tone="warn">{t("Demonstration profile: this creator and all figures are fictional sample data, not verified analytics.")}</Note>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Email")}><Input type="email" value={inf.contact?.email ?? ""} onChange={(e) => upd((i) => { i.contact = { ...i.contact, email: e.target.value }; })} /></Field>
            <Field label={t("Phone")}><Input value={inf.contact?.phone ?? ""} onChange={(e) => upd((i) => { i.contact = { ...i.contact, phone: e.target.value }; })} /></Field>
            <Field label={t("Management or agency")}><Input value={inf.contact?.agency ?? ""} onChange={(e) => upd((i) => { i.contact = { ...i.contact, agency: e.target.value }; })} /></Field>
            <Field label={t("Manager")}><Input value={inf.contact?.manager ?? ""} onChange={(e) => upd((i) => { i.contact = { ...i.contact, manager: e.target.value }; })} /></Field>
            <Field label={t("Approval status")}><Select value={inf.approvalStatus ?? "pending"} onChange={(e) => upd((i) => { i.approvalStatus = e.target.value as "approved"; })}><option value="pending">{t("Pending")}</option><option value="approved">{t("Approved")}</option><option value="blocked">{t("Blocked")}</option></Select></Field>
            <Field label={t("Brand suitability (0–100)")} hint={t("Your internal review; feeds the match score.")}><NumberInput value={inf.brandSafety ?? 0} placeholder={t("Not reviewed")} onChange={(n) => upd((i) => { i.brandSafety = n ? Math.min(100, n) : undefined; })} /></Field>
          </div>
          <Card className="space-y-2 p-4"><div className="text-[13px] font-semibold">{t("Internal performance ratings")}</div><Stars label={t("Overall")} value={inf.ratings?.overall} onChange={(n) => upd((i) => { i.ratings = { ...i.ratings, overall: n || undefined }; })} /><Stars label={t("Reliability")} value={inf.ratings?.reliability} onChange={(n) => upd((i) => { i.ratings = { ...i.ratings, reliability: n || undefined }; })} /><Stars label={t("Content quality")} value={inf.ratings?.contentQuality} onChange={(n) => upd((i) => { i.ratings = { ...i.ratings, contentQuality: n || undefined }; })} /></Card>
          <Field label={t("Internal notes")}><Textarea value={inf.notes ?? ""} onChange={(e) => upd((i) => { i.notes = e.target.value; })} /></Field>
          <div><div className="mb-2 text-[13px] font-semibold">{t("Quotations and confirmed fees")}</div>
            {inf.feeHistory.length ? <ul className="divide-y rounded-xl border text-[13px]">{[...inf.feeHistory].reverse().map((f, k) => <li key={k} className="flex items-center justify-between gap-3 px-3 py-2"><span>{fmtDate(f.date)} <span className="text-ink-3">{f.campaignName ?? f.note ?? ""}</span></span><span className="flex items-center gap-2"><span className="num font-medium">{money(f.amount, f.currency)}</span><SourceBadge source={f.status} /></span></li>)}</ul> : <p className="text-[13px] text-ink-3">{t("No fee history yet.")} {t("Current estimate")}: {money(estimateFee(inf), "AED")}.</p>}</div>
          <div><div className="mb-2 text-[13px] font-semibold">{t("Campaign participation — forecast vs. actual")}</div>
            {history[inf.id]?.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full text-[12.5px]"><thead><tr className="border-b text-ink-3"><th className="px-3 py-1.5 text-start font-normal">{t("Campaign")}</th><th className="px-2 text-start font-normal">{t("Status")}</th><th className="px-2 text-start font-normal">{t("Deliverables")}</th><th className="px-2 text-end font-normal">{t("Forecast reach")}</th><th className="px-2 text-end font-normal">{t("Actual reach")}</th><th className="px-3 text-end font-normal">{t("vs forecast")}</th></tr></thead>
              <tbody className="divide-y">{history[inf.id].map(({ c, a }) => { const f = forecastInfluencer(inf, a).reach; const act = a.actuals?.reach; return <tr key={c.id}><td className="px-3 py-1.5">{c.brief.name || t("Untitled campaign")}</td><td className="px-2">{t(a.status)}</td><td className="num px-2">{a.deliverables.map((d) => `${d.count}× ${d.format.replace(/_/g, " ")}`).join(", ")}</td><td className="num px-2 text-end">{compact(f)}</td><td className="num px-2 text-end">{act ? compact(act) : "—"}</td><td className={cx("num px-3 text-end font-medium", !!act && (act >= f ? "text-good" : "text-warn"))}>{act && f ? `${act >= f ? "+" : ""}${Math.round((act / f - 1) * 100)}%` : "—"}</td></tr>; })}</tbody></table></div> : <p className="text-[13px] text-ink-3">{t("Not used in a campaign yet.")}</p>}
            <p className="mt-2 text-[12px] text-ink-3">{t("Record actual results in a campaign’s Tracking tab once content is published. After two campaigns with actuals, the engagement score for this creator is adjusted by how they performed against forecast.")}</p></div>
          {inf.audience?.countries && <div><div className="mb-2 text-[13px] font-semibold">{t("Audience location")}</div><ShareBars data={inf.audience.countries.slice(0, 5).map((x) => ({ name: x.name, value: x.weight }))} /></div>}
        </div>}
      </Sheet>
    </Page>
  );
}
