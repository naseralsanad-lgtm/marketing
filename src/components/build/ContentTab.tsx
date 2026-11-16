"use client";
import { useState } from "react";
import { ChevronDown, Lock, LockOpen, PenLine, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import type { ContentPlan } from "@/lib/types";
import type { Model } from "@/lib/model";
import { formatInfo, platformLabel } from "@/lib/constants";
import { distributeMessages, generatePlan } from "@/lib/content";
import { forecastInfluencer } from "@/lib/forecast";
import { contentContext } from "@/lib/aiContext";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Input, Note, SectionTitle, Select, SourceBadge, Textarea, useUI } from "@/components/ui";
import { compact, cx, fmtShort } from "@/lib/utils";

export function ContentTab({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus(); const update = useStore((s) => s.update);
  const c = model.campaign; const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const live = c.assignments.filter((a) => model.lib[a.influencerId]);
  const byMsg = Object.fromEntries(c.messages.map((m) => [m.id, m]));

  const aiPlans = async (ids: string[]) => {
    const r = await api<{ plans: (Omit<ContentPlan, "origin" | "variant" | "mandatoryInfo"> & { influencerId: string })[] }>("/api/ai/content", { method: "POST", json: { context: contentContext(model, ids), language: undefined } });
    return Object.fromEntries(r.plans.filter((p) => ids.includes(p.influencerId)).map((p) => [p.influencerId, p]));
  };
  const generateAll = async () => {
    const hasAssign = live.some((a) => Object.keys(a.messages).length); const hasPlans = live.some((a) => a.plan);
    if ((hasAssign || hasPlans) && !(await confirm({ title: t("Regenerate the content plan?"), text: t("Messages will be redistributed and concepts rewritten for every creator whose content is not locked. Locked content is left untouched. You can undo this."), confirmLabel: t("Regenerate") }))) return;
    setBusy("all");
    const dist = distributeMessages(c, model.lib, model.scores);
    update(c.id, (d) => { for (const a of d.assignments) { if (a.plan?.locked) continue; a.messages = dist[a.influencerId] ?? {}; const inf = model.lib[a.influencerId]; if (inf) a.plan = generatePlan(a, inf, d, model.scores[a.influencerId], a.plan?.variant ?? 0); } });
    if (status?.ai.configured) {
      try {
        const fresh = useStore.getState().campaigns[c.id]; const ids = fresh.assignments.filter((a) => !a.plan?.locked).map((a) => a.influencerId);
        const plans = await aiPlans(ids);
        update(c.id, (d) => { for (const a of d.assignments) { const p = plans[a.influencerId]; if (p && a.plan && !a.plan.locked) Object.assign(a.plan, { role: p.role, objective: p.objective, topic: p.topic, concept: p.concept, storyline: p.storyline, hook: p.hook, talkingPoints: p.talkingPoints, cta: p.cta, filming: p.filming, approval: p.approval, origin: "ai" }); } });
      } catch (e) { toast(`${(e as Error).message} ${t("Kept the built-in plans.")}`, { tone: "warn" }); }
    }
    setBusy(null); toast(t("Content plan generated for {n} creators", { n: live.filter((a) => !a.plan?.locked).length }));
  };
  const regenerate = async (id: string) => {
    setBusy(id);
    update(c.id, (d) => { const a = d.assignments.find((x) => x.influencerId === id); const inf = model.lib[id]; if (a && inf && !a.plan?.locked) a.plan = generatePlan(a, inf, d, model.scores[id], (a.plan?.variant ?? 0) + 1); });
    if (status?.ai.configured) { try { const p = (await aiPlans([id]))[id]; if (p) update(c.id, (d) => { const a = d.assignments.find((x) => x.influencerId === id); if (a?.plan) Object.assign(a.plan, { ...p, influencerId: undefined, origin: "ai" }); }); } catch (e) { toast((e as Error).message, { tone: "warn" }); } }
    setBusy(null);
  };
  const setPlan = (id: string, fn: (p: ContentPlan) => void, label: string) => update(c.id, (d) => { const a = d.assignments.find((x) => x.influencerId === id); if (a?.plan) { fn(a.plan); a.plan.origin = "edited"; } }, label);

  if (!live.length) return <Empty icon={<PenLine size={22} />} title={t("Select influencers first")} text={t("Content plans are written for each selected creator.")} />;
  const noPlan = live.filter((a) => !a.plan).length;
  return (
    <div className="space-y-4">
      <SectionTitle title={t("Intelligent content assignment")} hint={t("Each creator gets a distinct role, messages and creative concept shaped by their style and audience. Edit anything, regenerate, reassign or lock.")}
        action={<Button variant="primary" loading={busy === "all"} icon={<Wand2 size={14} />} onClick={generateAll}>{t(noPlan === live.length ? "Generate content plan" : "Regenerate all")}</Button>} />
      {!c.messages.length && <Note tone="warn">{t("The messaging library is empty, so concepts use only the main message from the brief. Add a factsheet in Step 1 for message-level assignment.")}</Note>}
      {noPlan > 0 && noPlan < live.length && <Note>{t("{n} creator(s) have no plan yet — regenerate all, or use the regenerate button on their card.", { n: noPlan })}</Note>}
      <div className="space-y-3">
        {live.map((a) => { const inf = model.lib[a.influencerId]; const p = a.plan; const isOpen = open === inf.id; const fc = forecastInfluencer(inf, a);
          const prim = Object.entries(a.messages).filter(([, l]) => l === "primary").map(([id]) => byMsg[id]).filter(Boolean); const sup = Object.entries(a.messages).filter(([, l]) => l === "supporting").map(([id]) => byMsg[id]).filter(Boolean);
          const seg = c.brief.segments.find((s) => s.id === p?.segmentId);
          return (
            <Card key={inf.id} className="overflow-hidden">
              <div className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3.5" onClick={() => setOpen(isOpen ? null : inf.id)}>
                <button onClick={(e) => { e.stopPropagation(); onOpen(inf.id); }}><Avatar name={inf.name} src={inf.avatarUrl} size={40} /></button>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[15px] font-semibold">{inf.name}</span>{p && <Badge tone="accent">{p.role}</Badge>}{p?.locked && <Badge><Lock size={10} />{t("Locked")}</Badge>}{p && (p.origin === "ai" ? <SourceBadge source="ai" /> : p.origin === "edited" ? <Badge>{t("Edited")}</Badge> : null)}</div>
                  <div className="truncate text-[12.5px] text-ink-2">{p ? p.concept : t("No content plan yet")}</div></div>
                <div className="hidden text-end text-[12px] text-ink-3 sm:block"><div>{a.deliverables.map((d) => `${d.count}× ${t(formatInfo(d.format).label)}`).join(", ")}</div><div>{prim.length} {t("primary")} · {sup.length} {t("supporting")}</div></div>
                <ChevronDown size={16} className={cx("shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} />
              </div>
              {isOpen && (p ? (
                <div className="fade-up border-t px-4 py-4">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" loading={busy === inf.id} disabled={p.locked} icon={<RefreshCw size={13} />} onClick={() => regenerate(inf.id)}>{t("Regenerate concept")}</Button>
                    <Button size="sm" variant={p.locked ? "soft" : "secondary"} icon={p.locked ? <Lock size={13} /> : <LockOpen size={13} />} onClick={() => update(c.id, (d) => { const x = d.assignments.find((y) => y.influencerId === inf.id); if (x?.plan) x.plan.locked = !x.plan.locked; })}>{t(p.locked ? "Locked" : "Lock concept")}</Button>
                    <span className="ms-auto text-[12px] text-ink-3">{t("Est. performance")}: {compact(fc.reach)} {t("reach")} · {compact(fc.views)} {t("views")} · {compact(fc.engagements)} {t("engagements")} <SourceBadge source="estimated" /></span>
                  </div>
                  <fieldset disabled={p.locked} className="grid gap-4 md:grid-cols-2 disabled:opacity-70">
                    <Field label={t("Campaign role")}><Input value={p.role} onChange={(e) => setPlan(inf.id, (x) => { x.role = e.target.value; }, `pr${inf.id}`)} /></Field>
                    <Field label={t("Target audience segment")}><Select value={p.segmentId ?? ""} onChange={(e) => setPlan(inf.id, (x) => { x.segmentId = e.target.value || undefined; }, `ps${inf.id}`)}><option value="">{t("General audience")}</option>{c.brief.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                    <Field label={t("Primary communication objective")} className="md:col-span-2"><Textarea rows={1} value={p.objective} onChange={(e) => setPlan(inf.id, (x) => { x.objective = e.target.value; }, `po${inf.id}`)} /></Field>
                    <Field label={t("Assigned service or topic")}><Input value={p.topic} onChange={(e) => setPlan(inf.id, (x) => { x.topic = e.target.value; }, `pt${inf.id}`)} /></Field>
                    <Field label={t("Opening hook")}><Input value={p.hook} onChange={(e) => setPlan(inf.id, (x) => { x.hook = e.target.value; }, `ph${inf.id}`)} /></Field>
                    <Field label={t("Creative concept")}><Textarea value={p.concept} onChange={(e) => setPlan(inf.id, (x) => { x.concept = e.target.value; }, `pc${inf.id}`)} /></Field>
                    <Field label={t("Suggested storyline")}><Textarea value={p.storyline} onChange={(e) => setPlan(inf.id, (x) => { x.storyline = e.target.value; }, `py${inf.id}`)} /></Field>
                    <Field label={t("Key talking points")} hint={t("One per line.")}><Textarea value={p.talkingPoints.join("\n")} onChange={(e) => setPlan(inf.id, (x) => { x.talkingPoints = e.target.value.split("\n"); }, `pp${inf.id}`)} /></Field>
                    <Field label={t("Mandatory information")} hint={t("Mandatory messages and communication restrictions. One per line.")}><Textarea value={p.mandatoryInfo.join("\n")} onChange={(e) => setPlan(inf.id, (x) => { x.mandatoryInfo = e.target.value.split("\n"); }, `pm${inf.id}`)} /></Field>
                    <Field label={t("Call to action")}><Textarea rows={1} value={p.cta} onChange={(e) => setPlan(inf.id, (x) => { x.cta = e.target.value; }, `pa${inf.id}`)} /></Field>
                    <Field label={t("Filming requirements")}><Textarea rows={1} value={p.filming} onChange={(e) => setPlan(inf.id, (x) => { x.filming = e.target.value; }, `pf${inf.id}`)} /></Field>
                    <Field label={t("Approval requirements")} className="md:col-span-2"><Textarea rows={1} value={p.approval} onChange={(e) => setPlan(inf.id, (x) => { x.approval = e.target.value; }, `pv${inf.id}`)} /></Field>
                  </fieldset>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div><div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{t("Assigned campaign messages")}</div>
                      {prim.length + sup.length ? <ul className="space-y-1.5 text-[12.5px]">{[...prim.map((m) => ({ m, l: "primary" })), ...sup.map((m) => ({ m, l: "supporting" }))].map(({ m, l }) => <li key={m.id} className="flex gap-2"><Badge tone={l === "primary" ? "accent" : "neutral"} className="h-fit shrink-0">{t(l === "primary" ? "Primary" : "Supporting")}</Badge><span>{m.text}</span></li>)}</ul> : <p className="text-[12.5px] text-ink-3">{t("None — assign in the Messages matrix.")}</p>}</div>
                    <div><div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{t("Deliverables")}</div>
                      <table className="w-full text-[12.5px]"><thead><tr className="text-ink-3"><th className="pb-1 text-start font-normal">{t("Format")}</th><th className="pb-1 text-start font-normal">{t("Platform")}</th><th className="pb-1 text-start font-normal">{t("Qty")}</th><th className="pb-1 text-start font-normal">{t("Duration")}</th><th className="pb-1 text-start font-normal">{t("Publish")}</th></tr></thead>
                        <tbody>{a.deliverables.map((d) => { const pub = c.events.find((e) => e.influencerId === inf.id && ["publish", "pre_event", "post_event"].includes(e.type) && e.title.toLowerCase().includes(formatInfo(d.format).label.toLowerCase())); return <tr key={d.id} className="border-t"><td className="py-1">{t(formatInfo(d.format).label)}</td><td>{platformLabel(d.platform)}</td><td className="num">{d.count}</td><td className="num">{d.durationSec ? (d.durationSec >= 120 ? `${Math.round(d.durationSec / 60)} min` : `${d.durationSec}s`) : "—"}</td><td className="num">{d.publishDate ? fmtShort(d.publishDate) : pub ? fmtShort(pub.date) : "—"}</td></tr>; })}</tbody></table>
                      <button className="mt-1.5 text-[12.5px] text-accent" onClick={() => onOpen(inf.id)}>{t("Edit deliverables")}</button></div>
                  </div>
                </div>
              ) : <div className="border-t px-4 py-4"><Button size="sm" variant="primary" loading={busy === inf.id} icon={<Sparkles size={13} />} onClick={() => regenerate(inf.id)}>{t("Generate a plan for this creator")}</Button></div>)}
            </Card>); })}
      </div>
    </div>
  );
}
