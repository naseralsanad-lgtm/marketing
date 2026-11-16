"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Heart, Lock, LockOpen, Plus, RefreshCw, Sparkles, Star, Trash2 } from "lucide-react";
import type { ContentFormat, Influencer } from "@/lib/types";
import type { Model } from "@/lib/model";
import { FORMATS, formatInfo, platformLabel, tierLabel, tierOf, WEIGHT_LABELS } from "@/lib/constants";
import { forecastInfluencer } from "@/lib/forecast";
import { draftAssignment } from "@/lib/scenarios";
import { buildActions } from "@/lib/actions";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { ShareBars } from "@/components/Charts";
import { Avatar, Badge, Button, Field, IconButton, Note, NumberInput, Progress, ScoreRing, Segmented, Select, Sheet, SourceBadge, Textarea, Toggle, useUI } from "@/components/ui";
import { compact, fmtDate, money, pct, uid } from "@/lib/utils";

export async function refreshFromModash(inf: Influencer): Promise<Influencer> {
  const r = await api<{ influencer: Influencer }>(`/api/modash/report?platform=${inf.platform}&id=${encodeURIComponent(inf.modashUserId ?? inf.handle)}`);
  return { ...r.influencer, id: inf.id };
}

export function ProfilePanel({ model, infId, onClose, onAsk }: { model: Model; infId: string | null; onClose: () => void; onAsk?: (id: string) => void }) {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus(); const upsert = useStore((s) => s.upsertInfluencers);
  const [tab, setTab] = useState<"fit" | "audience" | "content" | "plan">("fit"); const [busy, setBusy] = useState(false);
  const inf = infId ? model.lib[infId] : null; if (!inf) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const c = model.campaign; const act = buildActions(c.id); const cur = model.budget.currency;
  const s = model.scores[inf.id]; const a = c.assignments.find((x) => x.influencerId === inf.id);
  const fc = forecastInfluencer(inf, a ?? draftAssignment(inf, c.brief, s?.estFee ?? 0));
  const canRefresh = status?.modash.configured && ["instagram", "tiktok", "youtube"].includes(inf.platform);
  const refresh = async () => { setBusy(true); try { upsert([await refreshFromModash(inf)]); toast(t("Analytics refreshed from Modash")); } catch (e) { toast((e as Error).message, { tone: "bad" }); } setBusy(false); };
  const remove = async () => { if (a && (a.locked || a.mandatory) && !(await confirm({ title: t("Remove a locked influencer?"), text: t("{name} is locked or marked mandatory. Remove them from this campaign anyway?", { name: inf.name }), confirmLabel: t("Remove"), danger: true }))) return; act.remove(inf.id); };

  return (
    <Sheet open onClose={onClose} width={620} title={<span className="flex items-center gap-2">{inf.name}<SourceBadge source={inf.source} /></span>}
      footer={<>{onAsk && <Button variant="ghost" icon={<Sparkles size={14} />} onClick={() => onAsk(inf.id)}>{t("Ask assistant")}</Button>}<span className="flex-1" />{a ? <Button variant="danger" icon={<Trash2 size={14} />} onClick={remove}>{t("Remove from campaign")}</Button> : <Button variant="primary" icon={<Plus size={14} />} onClick={() => act.select(inf.id)}>{t("Add to campaign")}</Button>}</>}>
      <div className="flex items-start gap-4">
        <Avatar name={inf.name} src={inf.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2"><span>@{inf.handle}</span>·<span>{platformLabel(inf.platform)}</span>·<span>{t(tierLabel(tierOf(inf.followers)))}</span>{inf.profileUrl && <a href={inf.profileUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent">{t("Profile")}<ExternalLink size={12} /></a>}</div>
          {inf.bio && <p className="mt-1 text-[13px] text-ink-2">{inf.bio}</p>}
          <div className="mt-1 text-[12px] text-ink-3">{[inf.city, inf.country].filter(Boolean).join(", ")}{inf.languages.length ? ` · ${inf.languages.join(", ")}` : ""}</div>
        </div>
        {s && <ScoreRing score={s.total} size={58} />}
      </div>
      {inf.source === "demo" && <Note tone="warn" className="mt-4">{t("Demonstration profile: this creator and all figures are fictional sample data, not verified analytics.")}</Note>}
      <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl bg-surface-2 p-4 text-center">
        {[[t("Followers"), compact(inf.followers)], [t("Engagement"), pct(inf.engagementRate)], [t("Avg. views"), compact(inf.avgViews)], [t("Est. reach"), compact(fc.reach)]].map(([l, v]) => <div key={l}><div className="num text-[19px] font-semibold">{v}</div><div className="text-[11.5px] text-ink-3">{l}</div></div>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <span>{t("Analytics updated")}: {inf.fetchedAt ? fmtDate(inf.fetchedAt.slice(0, 10)) : "—"}</span>
        {canRefresh ? <Button size="sm" variant="ghost" loading={busy} icon={<RefreshCw size={12} />} onClick={refresh}>{t("Refresh via Modash")}</Button> : <span>· {status?.modash.configured ? t("Modash does not cover this platform") : t("Connect Modash to refresh")}</span>}
      </div>

      {a && (
        <div className="mt-4 space-y-3 rounded-2xl border p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Toggle checked={a.locked} onChange={(v) => act.patch(inf.id, (x) => { x.locked = v; })} label={<span className="flex items-center gap-1">{a.locked ? <Lock size={13} /> : <LockOpen size={13} />}{t("Locked")}</span>} />
            <Toggle checked={a.mandatory} onChange={(v) => act.patch(inf.id, (x) => { x.mandatory = v; })} label={<span className="flex items-center gap-1"><Star size={13} />{t("Mandatory")}</span>} />
            <button onClick={() => act.favourite(inf.id)} className="flex items-center gap-1.5 text-[13.5px]"><Heart size={15} className={c.favourites.includes(inf.id) ? "fill-bad text-bad" : "text-ink-3"} />{t("Favourite")}</button>
          </div>
          <p className="text-[12px] text-ink-3">{t("Locked and mandatory influencers are never removed or replaced by recommendations, scenarios or the assistant.")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("Collaboration fee")} (${cur})`}><NumberInput value={a.fee} onChange={(n) => act.patch(inf.id, (x) => { x.fee = n; }, `fee${inf.id}`)} /></Field>
            <Field label={t("Fee status")}><Select value={a.feeStatus} onChange={(e) => act.patch(inf.id, (x) => { x.feeStatus = e.target.value as "quoted"; })}><option value="estimated">{t("Estimated")}</option><option value="quoted">{t("Quoted")}</option><option value="confirmed">{t("Confirmed")}</option></Select></Field>
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{t("Deliverables")}</div>
            <div className="space-y-1.5">{a.deliverables.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2"><Select className="flex-1" value={d.format} onChange={(e) => act.patch(inf.id, (x) => { x.deliverables[i].format = e.target.value as ContentFormat; x.deliverables[i].durationSec = formatInfo(e.target.value as ContentFormat).defaultDuration; })}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{t(f.label)}</option>)}</Select>
                <NumberInput aria-label={t("Quantity")} className="!w-16 text-center" value={d.count} onChange={(n) => act.patch(inf.id, (x) => { x.deliverables[i].count = Math.max(1, Math.min(30, n)); }, `dc${d.id}`)} />
                <IconButton label={t("Remove")} onClick={() => act.patch(inf.id, (x) => { x.deliverables.splice(i, 1); })}><Trash2 size={14} /></IconButton></div>))}</div>
            <Button size="sm" variant="ghost" className="mt-1.5" icon={<Plus size={13} />} onClick={() => act.patch(inf.id, (x) => { x.deliverables.push({ id: uid("d"), format: "reel", platform: inf.platform, count: 1, durationSec: 45 }); })}>{t("Add deliverable")}</Button>
          </div>
          <Field label={t("Personal notes")}><Textarea rows={2} value={a.notes} onChange={(e) => act.patch(inf.id, (x) => { x.notes = e.target.value; }, `n${inf.id}`)} /></Field>
        </div>
      )}

      <Segmented className="mt-5" value={tab} onChange={setTab} options={[{ id: "fit", label: t("Campaign fit") }, { id: "audience", label: t("Audience") }, { id: "content", label: t("Content") }, ...(a?.plan ? [{ id: "plan" as const, label: t("Content plan") }] : [])]} />
      <div className="mt-4">
        {tab === "fit" && s && <div className="space-y-4">
          <div className="space-y-3">{s.criteria.map((cr) => (
            <div key={cr.key}><div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]"><span className="font-medium">{t(WEIGHT_LABELS[cr.key])} <span className="font-normal text-ink-3">· {c.weights[cr.key]}%</span></span><span className="num font-semibold">{cr.missing ? <Badge>{t("No data")}</Badge> : cr.score}</span></div>
              <Progress value={cr.score} tone={cr.missing ? undefined : cr.score >= 70 ? "good" : cr.score < 40 ? "warn" : "accent"} /><p className="mt-1 text-[12px] text-ink-2">{cr.note}</p></div>))}</div>
          {!!s.reasons.length && <div><div className="mb-1.5 text-[12.5px] font-semibold">{t("Why recommended")}</div><ul className="space-y-1">{s.reasons.map((r) => <li key={r} className="flex gap-2 text-[13px]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-good" />{r}</li>)}</ul></div>}
          {!!s.concerns.length && <div><div className="mb-1.5 text-[12.5px] font-semibold">{t("Concerns and weaknesses")}</div><ul className="space-y-1">{s.concerns.map((r) => <li key={r} className="flex gap-2 text-[13px]"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />{r}</li>)}</ul></div>}
          {!!s.missing.length && <Note>{t("Missing data")}: {s.missing.join(" · ")}. {t("Criteria without data score a neutral 50.")} {t("Score confidence")}: {Math.round(s.confidence * 100)}%.</Note>}
          <div><div className="mb-1.5 text-[12.5px] font-semibold">{t("Fit by audience segment")}</div><ShareBars data={s.segments.map((x) => ({ name: x.name, value: x.share }))} max={1} /></div>
          <Note>{t("Estimated contribution")}: {compact(fc.reach)} {t("unique reach")}, {compact(fc.engagements)} {t("engagements")} · {t("basis")}: {fc.basis === "views" ? t("average views") : t("followers × format reach rate")}{fc.assumedEngagement ? ` · ${t("engagement rate assumed from tier benchmark")}` : ""}. {t("Estimated fee")} {money(s.estFee, cur)}.</Note>
        </div>}
        {tab === "audience" && (inf.audience ? <div className="space-y-5">
          {inf.audience.credibility != null && <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3"><span className="text-[13px]">{t("Audience authenticity (estimated real followers)")}</span><span className="num text-[19px] font-semibold">{pct(inf.audience.credibility, 0)}</span></div>}
          {([["Location", inf.audience.countries], ["Cities", inf.audience.cities], ["Age", inf.audience.ages], ["Gender", inf.audience.genders], ["Language", inf.audience.languages], ["Interests", inf.audience.interests]] as const).filter(([, l]) => l?.length).map(([label, list]) => <div key={label}><div className="mb-2 text-[12.5px] font-semibold">{t(label)}</div><ShareBars data={list!.slice(0, 6).map((x) => ({ name: x.name, value: x.weight }))} /></div>)}
          {!!inf.growth?.length && <div><div className="mb-2 text-[12.5px] font-semibold">{t("Audience growth")}</div><div className="flex items-end gap-1.5" style={{ height: 70 }}>{inf.growth.map((g) => { const min = Math.min(...inf.growth!.map((x) => x.followers)) * 0.97, max = Math.max(...inf.growth!.map((x) => x.followers)); return <div key={g.month} className="flex flex-1 flex-col items-center gap-1" title={`${g.month}: ${compact(g.followers)}`}><div className="w-full rounded-t bg-accent/70" style={{ height: `${8 + ((g.followers - min) / Math.max(1, max - min)) * 46}px` }} /><span className="text-[10px] text-ink-3">{g.month.slice(5)}</span></div>; })}</div></div>}
        </div> : <Note>{t("No audience analytics for this profile. Connect Modash to retrieve them, or continue with the data you have — the match score marks what is missing.")}</Note>)}
        {tab === "content" && <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{inf.categories.map((x) => <Badge key={x}>{x}</Badge>)}{inf.contentStyle && <Badge tone="accent">{inf.contentStyle}</Badge>}</div>
          {inf.sponsoredPerformance != null && <Note>{t("Sponsored content performs at {p}% of organic content.", { p: Math.round(inf.sponsoredPerformance * 100) })}</Note>}
          {inf.recentPosts?.length ? inf.recentPosts.map((p, i) => <div key={i} className="rounded-xl border p-3"><p className="text-[13px]">{p.caption || "—"}</p><div className="mt-1.5 flex flex-wrap gap-3 text-[12px] text-ink-3">{p.date && <span>{fmtDate(p.date.slice(0, 10))}</span>}{p.likes != null && <span>{compact(p.likes)} {t("likes")}</span>}{p.views != null && <span>{compact(p.views)} {t("views")}</span>}{p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="text-accent">{t("Open")}</a>}</div></div>) : <p className="text-[13px] text-ink-3">{t("No recent content available.")}</p>}
        </div>}
        {tab === "plan" && a?.plan && <dl className="space-y-3 text-[13px]">{([["Campaign role", a.plan.role], ["Objective", a.plan.objective], ["Creative concept", a.plan.concept], ["Opening hook", a.plan.hook], ["Storyline", a.plan.storyline], ["Call to action", a.plan.cta]] as const).map(([k, v]) => <div key={k}><dt className="text-[12px] font-medium text-ink-3">{t(k)}</dt><dd>{v}</dd></div>)}</dl>}
      </div>
    </Sheet>
  );
}
