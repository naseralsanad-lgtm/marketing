"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, Check, Lightbulb, Plus, RefreshCw, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import type { AudienceSegment, Brief, Budget, Campaign, Platform, Tier } from "@/lib/types";
import { AGE_GROUPS, CAMPAIGN_TYPES, CATEGORIES, COUNTRIES, CURRENCIES, LANGUAGES, OBJECTIVES, PLATFORMS, TIERS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { useModel, useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { allocationsTotal, budgetTotal, recommendAllocation } from "@/lib/budget";
import { recommendPlatforms, recommendTierMix } from "@/lib/scoring";
import { buildSummary } from "@/lib/analysis";
import { summaryContext } from "@/lib/aiContext";
import { api } from "@/lib/api";
import { Factsheet } from "@/components/brief/Factsheet";
import { Badge, Button, Card, Chip, ChipGroup, Field, IconButton, Input, Note, NumberInput, Progress, SectionTitle, Segmented, Select, SourceBadge, TagInput, Textarea, Toggle, useUI } from "@/components/ui";
import { cx, money, uid } from "@/lib/utils";

const SECTIONS = [
  { id: "info", label: "Campaign information" }, { id: "objectives", label: "Objectives" }, { id: "budget", label: "Budget" }, { id: "audience", label: "Target audience" },
  { id: "platforms", label: "Platforms" }, { id: "prefs", label: "Influencer preferences" }, { id: "factsheet", label: "Factsheet and messages" }, { id: "summary", label: "Strategic summary" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function briefErrors(b: Brief): Partial<Record<string, string>> {
  const e: Record<string, string> = {};
  if (!b.name.trim()) e.name = "Give the campaign a name.";
  if (!b.type) e.type = "Choose a campaign type.";
  if (!b.startDate || !b.endDate) e.dates = "Set the campaign start and end dates.";
  else if (b.endDate < b.startDate) e.dates = "The end date is before the start date.";
  if (b.eventStart && b.eventEnd && b.eventEnd < b.eventStart) e.event = "The event ends before it starts.";
  if (b.eventStart && b.startDate && (b.eventStart < b.startDate || (b.endDate && b.eventStart > b.endDate))) e.event = "The event falls outside the campaign dates.";
  if (!b.objectives.length) e.objectives = "Select at least one objective.";
  return e;
}
const sectionDone = (id: SectionId, c: Campaign): boolean => {
  const b = c.brief;
  switch (id) {
    case "info": return !!(b.name && b.type && b.startDate && b.endDate);
    case "objectives": return b.objectives.length > 0;
    case "budget": return budgetTotal(b.budget) > 0;
    case "audience": return b.segments.length > 0;
    case "platforms": return b.recommendPlatforms || b.platforms.length > 0;
    case "prefs": return b.prefs.categories.length > 0 || b.prefs.tiers.length > 0 || b.prefs.minFollowers > 0;
    case "factsheet": return c.messages.length > 0;
    case "summary": return !!b.summary;
  }
};

export default function BriefPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const t = useT(); const { toast } = useUI();
  const model = useModel(id); const update = useStore((s) => s.update);
  const [section, setSection] = useState<SectionId>("info"); const [showErrors, setShowErrors] = useState(false);
  if (!model) return null;
  const c = model.campaign, b = c.brief;
  const set = (fn: (b: Brief) => void, label?: string) => update(id, (d) => fn(d.brief), label);
  const errors = briefErrors(b); const err = (k: string) => (showErrors && errors[k] ? t(errors[k]!) : undefined);
  const idx = SECTIONS.findIndex((s) => s.id === section);
  const build = () => {
    if (Object.keys(errors).length) { setShowErrors(true); setSection(errors.objectives && !errors.name && !errors.type && !errors.dates && !errors.event ? "objectives" : "info"); toast(t("A few essential details are missing."), { tone: "warn" }); return; }
    if (!b.summary) set((x) => { x.summary = buildSummary(x, c.messages); x.summaryOrigin = "generated"; });
    router.push(`/campaigns/${id}/build`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start lg:overflow-visible">
        {SECTIONS.map((s, i) => { const done = sectionDone(s.id, c); return (
          <button key={s.id} onClick={() => setSection(s.id)} className={cx("flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-start text-[13.5px] transition", section === s.id ? "bg-surface font-medium shadow-card" : "text-ink-2 hover:bg-surface/60")}>
            <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold", done ? "bg-good text-white" : section === s.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-3")}>{done ? <Check size={11} /> : i + 1}</span>{t(s.label)}
          </button>); })}
        <div className="mt-3 hidden rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-ink-2 lg:block"><Lightbulb size={14} className="mb-1 text-warn" />{t("Only the name, type, dates and one objective are required. Leave the rest blank and the planner will recommend sensible options.")}</div>
      </nav>

      <div className="min-w-0 space-y-6">
        <div key={section} className="fade-up space-y-6">
          {section === "info" && <>
            <Card className="p-5">
              <SectionTitle title={t("Campaign information")} hint={t("The essentials. Everything is saved as you type.")} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("Campaign or event name")} required error={err("name")}><Input value={b.name} onChange={(e) => update(id, (d) => { if (!d.deck.title || d.deck.title === d.brief.name) d.deck.title = e.target.value; d.brief.name = e.target.value; }, "name")} placeholder={t("e.g. National Reading Month 2027")} /></Field>
                <Field label={t("Organisation or brand")}><Input value={b.organisation} onChange={(e) => set((x) => { x.organisation = e.target.value; }, "org")} /></Field>
                <Field label={t("Campaign type")} required error={err("type")} className="md:col-span-2"><div className="flex flex-wrap gap-2">{CAMPAIGN_TYPES.map((ty) => <Chip key={ty} active={b.type === ty} onClick={() => set((x) => { x.type = ty; })}>{t(ty)}</Chip>)}</div></Field>
                <Field label={t("Campaign description")} className="md:col-span-2"><Textarea value={b.description} onChange={(e) => set((x) => { x.description = e.target.value; }, "desc")} placeholder={t("What is this campaign, in a sentence or two?")} /></Field>
                <Field label={t("Campaign location")}><Input value={b.location} onChange={(e) => set((x) => { x.location = e.target.value; }, "loc")} placeholder={t("e.g. Dubai, United Arab Emirates")} /></Field>
                <div />
                <Field label={t("Campaign start")} required error={err("dates")}><Input type="date" value={b.startDate} onChange={(e) => set((x) => { x.startDate = e.target.value; if (!x.publishStart) x.publishStart = e.target.value; })} /></Field>
                <Field label={t("Campaign end")} required><Input type="date" value={b.endDate} min={b.startDate} onChange={(e) => set((x) => { x.endDate = e.target.value; if (!x.publishEnd) x.publishEnd = e.target.value; })} /></Field>
                <Field label={t("Event start (if applicable)")} error={err("event")}><Input type="date" value={b.eventStart} onChange={(e) => set((x) => { x.eventStart = e.target.value; if (!x.eventEnd || x.eventEnd < e.target.value) x.eventEnd = e.target.value; })} /></Field>
                <Field label={t("Event end")}><Input type="date" value={b.eventEnd} min={b.eventStart} onChange={(e) => set((x) => { x.eventEnd = e.target.value; })} /></Field>
                <Field label={t("Publishing period — from")} hint={t("When influencer content can go live.")}><Input type="date" value={b.publishStart} onChange={(e) => set((x) => { x.publishStart = e.target.value; })} /></Field>
                <Field label={t("Publishing period — to")}><Input type="date" value={b.publishEnd} min={b.publishStart} onChange={(e) => set((x) => { x.publishEnd = e.target.value; })} /></Field>
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle title={t("Story and requirements")} hint={t("Optional — a factsheet in step 7 can fill most of this in.")} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("Campaign background")} className="md:col-span-2"><Textarea value={b.background} onChange={(e) => set((x) => { x.background = e.target.value; }, "bg")} /></Field>
                <Field label={t("Main campaign message")}><Textarea value={b.mainMessage} onChange={(e) => set((x) => { x.mainMessage = e.target.value; }, "mm")} /></Field>
                <Field label={t("Desired call to action")}><Textarea value={b.cta} onChange={(e) => set((x) => { x.cta = e.target.value; }, "cta")} /></Field>
                {(b.eventStart || /event/i.test(b.type)) && <>
                  <Field label={t("Pre-event requirements")}><Textarea value={b.preEvent} onChange={(e) => set((x) => { x.preEvent = e.target.value; }, "pre")} /></Field>
                  <Field label={t("During-event requirements")}><Textarea value={b.duringEvent} onChange={(e) => set((x) => { x.duringEvent = e.target.value; }, "dur")} /></Field>
                  <Field label={t("Post-event requirements")} className="md:col-span-2"><Textarea value={b.postEvent} onChange={(e) => set((x) => { x.postEvent = e.target.value; }, "post")} /></Field>
                </>}
              </div>
            </Card>
          </>}

          {section === "objectives" && <Objectives b={b} set={set} error={err("objectives")} />}
          {section === "budget" && <BudgetSection b={b} set={set} />}
          {section === "audience" && <Audience b={b} set={set} />}
          {section === "platforms" && <Platforms b={b} set={set} />}
          {section === "prefs" && <Prefs b={b} set={set} />}
          {section === "factsheet" && <Factsheet c={c} />}
          {section === "summary" && <Summary id={id} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button variant="ghost" disabled={idx === 0} onClick={() => setSection(SECTIONS[idx - 1].id)}>{t("Back")}</Button>
          <div className="flex items-center gap-2">
            {showErrors && Object.keys(errors).length > 0 && <span className="flex items-center gap-1 text-[12.5px] text-bad"><AlertCircle size={13} />{t(Object.values(errors)[0]!)}</span>}
            {idx < SECTIONS.length - 1 ? <Button onClick={() => setSection(SECTIONS[idx + 1].id)}>{t("Continue")}</Button> : null}
            <Button variant="primary" size={idx === SECTIONS.length - 1 ? "lg" : "md"} icon={<ArrowRight size={15} className="rtl:rotate-180" />} onClick={build}>{t("Build My Campaign")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type SetBrief = (fn: (b: Brief) => void, label?: string) => void;

function Objectives({ b, set, error }: { b: Brief; set: SetBrief; error?: string }) {
  const t = useT();
  const move = (i: number, d: number) => set((x) => { const [o] = x.objectives.splice(i, 1); x.objectives.splice(i + d, 0, o); });
  return (
    <>
      <Card className="p-5">
        <SectionTitle title={t("Campaign objectives")} hint={t("Select all that apply, then order them. Priority shapes the budget split, creator mix and scenarios.")} />
        <div className="flex flex-wrap gap-2">{OBJECTIVES.map((o) => <Chip key={o} active={b.objectives.includes(o)} onClick={() => set((x) => { x.objectives = x.objectives.includes(o) ? x.objectives.filter((y) => y !== o) : [...x.objectives, o]; })}>{t(o)}</Chip>)}</div>
        {error && <p className="mt-2 text-[12.5px] text-bad">{error}</p>}
        {b.objectives.length > 0 && <div className="mt-5"><div className="mb-2 text-[12.5px] font-medium text-ink-2">{t("Priority order")}</div>
          <ol className="divide-y rounded-xl border">{b.objectives.map((o, i) => (
            <li key={o} className="flex items-center gap-3 px-3 py-2"><span className="num flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold">{i + 1}</span><span className="flex-1 text-[13.5px]">{t(o)}</span>
              <IconButton label={t("Move up")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></IconButton><IconButton label={t("Move down")} disabled={i === b.objectives.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></IconButton></li>))}</ol></div>}
      </Card>
      <Card className="p-5">
        <SectionTitle title={t("KPIs and targets")} hint={t("Measurable targets appear in the plan and the presentation.")} action={<Button size="sm" icon={<Plus size={14} />} onClick={() => set((x) => { x.kpis.push({ id: uid("k"), label: "", target: "" }); })}>{t("Add KPI")}</Button>} />
        {b.kpis.length ? <div className="space-y-2">{b.kpis.map((k, i) => (
          <div key={k.id} className="flex gap-2"><Input value={k.label} placeholder={t("KPI, e.g. App downloads")} onChange={(e) => set((x) => { x.kpis[i].label = e.target.value; }, `kl${k.id}`)} /><Input value={k.target} placeholder={t("Target, e.g. 150,000")} className="max-w-[200px]" onChange={(e) => set((x) => { x.kpis[i].target = e.target.value; }, `kt${k.id}`)} /><IconButton label={t("Delete")} onClick={() => set((x) => { x.kpis.splice(i, 1); })}><Trash2 size={14} /></IconButton></div>))}</div>
          : <p className="text-[13px] text-ink-3">{t("No KPIs yet.")}</p>}
      </Card>
    </>
  );
}

const LINES: { key: keyof Budget; label: string }[] = [{ key: "influencer", label: "Influencer collaborations" }, { key: "production", label: "Content production" }, { key: "amplification", label: "Paid amplification" }, { key: "travel", label: "Travel and accommodation" }, { key: "additional", label: "Additional expenses" }, { key: "contingency", label: "Contingency" }];

function BudgetSection({ b, set }: { b: Brief; set: SetBrief }) {
  const t = useT(); const bud = b.budget; const [why, setWhy] = useState<string[] | null>(null);
  const alloc = allocationsTotal(bud); const total = budgetTotal(bud); const net = bud.mode === "total" ? bud.total / (1 + bud.taxRate / 100) : alloc;
  const unallocated = bud.mode === "total" ? net - alloc : 0;
  return (
    <Card className="p-5">
      <SectionTitle title={t("Budget")} hint={t("Enter one fixed total, or build the budget line by line.")} action={<Segmented size="sm" value={bud.mode} onChange={(m) => set((x) => { x.budget.mode = m; if (m === "total" && !x.budget.total) x.budget.total = Math.round(allocationsTotal(x.budget) * (1 + x.budget.taxRate / 100)); })} options={[{ id: "total", label: t("Fixed total") }, { id: "allocations", label: t("Individual allocations") }]} />} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("Total campaign budget")} hint={bud.mode === "allocations" ? t("Calculated from the lines below, plus tax.") : t("Including taxes.")}>{bud.mode === "total" ? <NumberInput value={bud.total} onChange={(n) => set((x) => { x.budget.total = n; }, "bt")} className="!text-[18px] font-semibold" /> : <div className="field num bg-surface-2 !text-[18px] font-semibold">{total.toLocaleString("en-US")}</div>}</Field>
        <Field label={t("Currency")}><Select value={bud.currency} onChange={(e) => set((x) => { x.budget.currency = e.target.value; })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label={t("Applicable taxes (%)")}><NumberInput value={bud.taxRate} onChange={(n) => set((x) => { x.budget.taxRate = Math.min(100, n); }, "tx")} /></Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><div className="text-[13.5px] font-medium">{t("Allocation")}</div>
        <Button size="sm" variant="soft" icon={<Wand2 size={14} />} disabled={bud.mode === "total" && !bud.total} onClick={() => { const base = bud.mode === "total" ? b : { ...b, budget: { ...bud, total } }; const r = recommendAllocation(base); set((x) => { Object.assign(x.budget, r.budget, { mode: x.budget.mode, total: x.budget.total }); }); setWhy(r.rationale); }}>{t("Recommend a split")}</Button></div>
      {bud.mode === "total" && !bud.total && <p className="mt-1 text-[12.5px] text-ink-3">{t("Enter a total to get a recommended split.")}</p>}
      <div className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
        {LINES.map((l) => { const v = bud[l.key] as number; return (
          <div key={l.key}><div className="mb-1.5 flex items-center justify-between text-[12.5px]"><span className="font-medium text-ink-2">{t(l.label)}</span><span className="num text-ink-3">{net > 0 ? `${Math.round((v / net) * 100)}%` : ""}</span></div>
            <NumberInput aria-label={t(l.label)} value={v} onChange={(n) => set((x) => { (x.budget[l.key] as number) = n; }, `b${l.key}`)} /><div className="mt-1.5"><Progress value={net > 0 ? (v / net) * 100 : 0} /></div></div>); })}
      </div>
      {bud.mode === "total" && bud.total > 0 && alloc > 0 && <Note className="mt-4" tone={unallocated < -1 ? "bad" : unallocated > net * 0.02 ? "warn" : "good"}>{unallocated < -1 ? t("Allocations exceed the total by {v} (after {tax}% tax).", { v: money(-unallocated, bud.currency), tax: bud.taxRate }) : unallocated > net * 0.02 ? t("{v} of the pre-tax budget is not yet allocated.", { v: money(unallocated, bud.currency) }) : t("The budget is fully allocated: {net} before tax + {tax} tax.", { net: money(net, bud.currency), tax: money(bud.total - net, bud.currency) })}</Note>}
      {why && <div className="mt-4 rounded-xl border bg-surface-2 p-3.5"><div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-accent" />{t("Why this split")}<SourceBadge source="estimated" /></div><ul className="space-y-1 text-[12.5px] text-ink-2">{why.map((w) => <li key={w}>• {w}</li>)}</ul></div>}
    </Card>
  );
}

const newSegment = (n: number): AudienceSegment => ({ id: uid("seg"), name: "", role: n === 0 ? "primary" : "secondary", priority: Math.min(5, n + 1), coverageTarget: n === 0 ? 100 : 0, countries: ["United Arab Emirates"], cities: [], communities: [], ageGroups: [], gender: "all", languages: [], interests: [], professions: [], lifestyle: "", behaviours: "" });

function Audience({ b, set }: { b: Brief; set: SetBrief }) {
  const t = useT(); const [open, setOpen] = useState<string | null>(b.segments[0]?.id ?? null);
  const total = b.segments.reduce((s, x) => s + x.coverageTarget, 0);
  const seg = (id: string, fn: (s: AudienceSegment) => void, label?: string) => set((x) => { const s = x.segments.find((y) => y.id === id); if (s) fn(s); }, label);
  return (
    <div className="space-y-4">
      <SectionTitle className="!mb-0" title={t("Target audience")} hint={t("Define each audience segment separately. The recommended creator mix will address every segment in proportion — not just maximise total reach.")}
        action={<><Button size="sm" disabled={!b.segments.length} onClick={() => set((x) => { const n = x.segments.length; const each = Math.floor(100 / n); x.segments.forEach((s, i) => { s.coverageTarget = i === 0 ? 100 - each * (n - 1) : each; }); })}>{t("Split evenly")}</Button><Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => { const s = newSegment(b.segments.length); set((x) => { x.segments.push(s); }); setOpen(s.id); }}>{t("Add segment")}</Button></>} />
      {!b.segments.length && <Card className="p-8 text-center"><Users size={22} className="mx-auto mb-2 text-ink-3" /><div className="text-[15px] font-semibold">{t("No audience segments yet")}</div><p className="mx-auto mt-1 max-w-md text-[13px] text-ink-2">{t("For example: Emirati citizens, Arabic-speaking residents, English-speaking expatriates and Hindi-speaking communities — each with its own priority.")}</p></Card>}
      {b.segments.length > 0 && total !== 100 && <Note tone="warn">{t("Desired coverage adds up to {n}%. Targets are normalised to 100% when measuring coverage.", { n: total })}</Note>}
      {b.segments.map((s) => (
        <Card key={s.id} className="overflow-hidden">
          <div className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5" onClick={() => setOpen(open === s.id ? null : s.id)}>
            <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{s.name || t("Untitled segment")}</div><div className="truncate text-[12.5px] text-ink-3">{[...s.languages, ...s.ageGroups.slice(0, 3), ...s.countries.slice(0, 2)].join(" · ") || t("No criteria yet")}</div></div>
            <Badge tone={s.role === "primary" ? "accent" : "neutral"}>{t(s.role === "primary" ? "Primary" : "Secondary")}</Badge><Badge>P{s.priority}</Badge><span className="num w-12 text-end text-[15px] font-semibold">{s.coverageTarget}%</span>
            <IconButton label={t("Delete")} onClick={(e) => { e.stopPropagation(); set((x) => { x.segments = x.segments.filter((y) => y.id !== s.id); }); }}><Trash2 size={14} /></IconButton>
          </div>
          {open === s.id && <div className="grid gap-4 border-t px-5 py-4 md:grid-cols-2">
            <Field label={t("Segment name")}><Input value={s.name} autoFocus={!s.name} onChange={(e) => seg(s.id, (x) => { x.name = e.target.value; }, `sn${s.id}`)} placeholder={t("e.g. Arabic-speaking residents")} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("Role")}><Select value={s.role} onChange={(e) => seg(s.id, (x) => { x.role = e.target.value as "primary"; })}><option value="primary">{t("Primary")}</option><option value="secondary">{t("Secondary")}</option></Select></Field>
              <Field label={t("Priority")}><Select value={s.priority} onChange={(e) => seg(s.id, (x) => { x.priority = +e.target.value; })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 1 ? ` (${t("highest")})` : ""}</option>)}</Select></Field>
              <Field label={t("Coverage %")}><NumberInput value={s.coverageTarget} onChange={(n) => seg(s.id, (x) => { x.coverageTarget = Math.min(100, n); }, `sc${s.id}`)} /></Field>
            </div>
            <Field label={t("Countries")}><TagInput value={s.countries} onChange={(v) => seg(s.id, (x) => { x.countries = v; })} placeholder={Object.keys(COUNTRIES).slice(0, 3).join(", ")} /></Field>
            <Field label={t("Cities and regions")}><TagInput value={s.cities} onChange={(v) => seg(s.id, (x) => { x.cities = v; })} placeholder="Dubai, Abu Dhabi" /></Field>
            <Field label={t("Languages")} className="md:col-span-2"><ChipGroup options={LANGUAGES} value={s.languages} onChange={(v) => seg(s.id, (x) => { x.languages = v; })} labels={(o) => t(o)} /></Field>
            <Field label={t("Age groups")}><ChipGroup options={AGE_GROUPS} value={s.ageGroups} onChange={(v) => seg(s.id, (x) => { x.ageGroups = v; })} /></Field>
            <Field label={t("Gender")}><Segmented size="sm" value={s.gender} onChange={(v) => seg(s.id, (x) => { x.gender = v; })} options={[{ id: "all", label: t("All") }, { id: "female", label: t("Female") }, { id: "male", label: t("Male") }]} /></Field>
            <Field label={t("Nationalities or cultural communities")} hint={t("Used as a label. Matching uses audience language and location data only — never inferred from an influencer’s profile.")}><TagInput value={s.communities} onChange={(v) => seg(s.id, (x) => { x.communities = v; })} /></Field>
            <Field label={t("Interests")}><TagInput value={s.interests} onChange={(v) => seg(s.id, (x) => { x.interests = v; })} placeholder="Family, Technology" /></Field>
            <Field label={t("Professions")}><TagInput value={s.professions} onChange={(v) => seg(s.id, (x) => { x.professions = v; })} /></Field>
            <Field label={t("Lifestyle")}><Input value={s.lifestyle} onChange={(e) => seg(s.id, (x) => { x.lifestyle = e.target.value; }, `sl${s.id}`)} /></Field>
            <Field label={t("Audience behaviours")} className="md:col-span-2"><Input value={s.behaviours} onChange={(e) => seg(s.id, (x) => { x.behaviours = e.target.value; }, `sb${s.id}`)} placeholder={t("e.g. Heavy Snapchat users; prefers video guides")} /></Field>
          </div>}
        </Card>
      ))}
    </div>
  );
}

function Platforms({ b, set }: { b: Brief; set: SetBrief }) {
  const t = useT(); const rec = useMemo(() => recommendPlatforms(b), [b]);
  return (
    <Card className="p-5">
      <SectionTitle title={t("Platform selection")} hint={t("Choose platforms yourself, or let the planner recommend them from your objectives and audience.")} />
      <Toggle checked={b.recommendPlatforms} onChange={(v) => set((x) => { x.recommendPlatforms = v; })} label={<span className="font-medium">{t("Recommend Platforms")}</span>} />
      <div className="mt-4 flex flex-wrap gap-2">{PLATFORMS.map((p) => <Chip key={p.id} active={b.platforms.includes(p.id)} onClick={() => set((x) => { x.platforms = x.platforms.includes(p.id) ? x.platforms.filter((y) => y !== p.id) : [...x.platforms, p.id]; x.recommendPlatforms = false; })}>{p.label}</Chip>)}</div>
      <div className="mt-5 rounded-xl border bg-surface-2 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-accent" />{t("Recommended for this brief")}<SourceBadge source="estimated" />
          <Button size="sm" className="ms-auto" onClick={() => set((x) => { x.platforms = rec.slice(0, 4).map((r) => r.platform as Platform); x.recommendPlatforms = false; })}>{t("Use these")}</Button></div>
        <ul className="space-y-1.5">{rec.slice(0, 5).map((r, i) => <li key={r.platform} className="flex gap-2 text-[13px]"><span className={cx("w-20 shrink-0 font-medium capitalize", i > 3 && "text-ink-3")}>{PLATFORMS.find((p) => p.id === r.platform)?.label}</span><span className="text-ink-2">{r.why}</span></li>)}</ul>
        <p className="mt-3 text-[12px] text-ink-3">{t("Modash discovery covers Instagram, TikTok and YouTube. Creators on other platforms can be added manually or by CSV.")}</p>
      </div>
    </Card>
  );
}

function Prefs({ b, set }: { b: Brief; set: SetBrief }) {
  const t = useT(); const p = b.prefs; const mix = useMemo(() => recommendTierMix(b), [b]);
  return (
    <Card className="p-5">
      <SectionTitle title={t("Influencer preferences")} hint={t("All optional. Leave blank to let the planner recommend the optimal mix.")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("Preferred influencer categories")} className="md:col-span-2"><ChipGroup options={CATEGORIES} value={p.categories} onChange={(v) => set((x) => { x.prefs.categories = v; })} labels={(o) => t(o)} /></Field>
        <Field label={t("Influencer tiers")} className="md:col-span-2"><div className="flex flex-wrap gap-2">{TIERS.map((ti) => <Chip key={ti.id} active={p.tiers.includes(ti.id)} title={`${ti.min.toLocaleString()}${isFinite(ti.max) ? ` – ${ti.max.toLocaleString()}` : "+"}`} onClick={() => set((x) => { x.prefs.tiers = x.prefs.tiers.includes(ti.id) ? x.prefs.tiers.filter((y) => y !== ti.id) : [...x.prefs.tiers, ti.id as Tier]; })}>{t(ti.label)}</Chip>)}</div>
          {!p.tiers.length && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2"><Sparkles size={13} className="text-accent" />{t("Recommended mix")}: {mix.map((m) => <span key={m.tier}><b className="num font-semibold text-ink">{m.share}%</b> {m.tier} <span className="text-ink-3">({m.why})</span></span>)}</div>}</Field>
        <Field label={t("Minimum follower count")}><NumberInput value={p.minFollowers} placeholder={t("No minimum")} onChange={(n) => set((x) => { x.prefs.minFollowers = n; }, "pf")} /></Field>
        <Field label={t("Minimum engagement rate (%)")}><NumberInput value={p.minEngagement} placeholder={t("No minimum")} onChange={(n) => set((x) => { x.prefs.minEngagement = Math.min(100, n); }, "pe")} /></Field>
        <Field label={t("Preferred content language")}><ChipGroup options={LANGUAGES.slice(0, 6)} value={p.languages} onChange={(v) => set((x) => { x.prefs.languages = v; })} labels={(o) => t(o)} /></Field>
        <Field label={t("Required number of influencers")}><NumberInput value={p.count} placeholder={t("Let the planner decide")} onChange={(n) => set((x) => { x.prefs.count = n || null; }, "pc")} /></Field>
        <Field label={t("Geographic relevance")}><Input value={p.geo} onChange={(e) => set((x) => { x.prefs.geo = e.target.value; }, "pg")} placeholder={t("e.g. UAE-based creators preferred")} /></Field>
        <Field label={t("Content style")}><Input value={p.contentStyle} onChange={(e) => set((x) => { x.prefs.contentStyle = e.target.value; }, "ps")} placeholder={t("e.g. Authentic, educational, family-safe")} /></Field>
        <Field label={t("Brand suitability requirements")} className="md:col-span-2"><Textarea rows={2} value={p.brandRequirements} onChange={(e) => set((x) => { x.prefs.brandRequirements = e.target.value; }, "pb")} /></Field>
        <Field label={t("Previously approved influencers")} hint={t("Handles, separated by commas.")}><TagInput value={p.approvedHandles} onChange={(v) => set((x) => { x.prefs.approvedHandles = v.map((h) => h.replace(/^@/, "")); })} placeholder="@handle" /></Field>
        <Field label={t("Influencers to exclude")}><TagInput value={p.excludedHandles} onChange={(v) => set((x) => { x.prefs.excludedHandles = v.map((h) => h.replace(/^@/, "")); })} placeholder="@handle" /></Field>
        <Field label={t("Competitor affiliations to avoid")} className="md:col-span-2"><TagInput value={p.competitors} onChange={(v) => set((x) => { x.prefs.competitors = v; })} placeholder={t("Brand names")} /></Field>
      </div>
    </Card>
  );
}

function Summary({ id }: { id: string }) {
  const t = useT(); const { toast } = useUI(); const model = useModel(id)!; const status = useStatus(); const update = useStore((s) => s.update); const [busy, setBusy] = useState(false);
  const b = model.campaign.brief;
  const generate = async (ai: boolean) => {
    if (ai) { setBusy(true); try { const r = await api<{ summary: string }>("/api/ai/summary", { method: "POST", json: { context: summaryContext(model) } }); update(id, (d) => { d.brief.summary = r.summary; d.brief.summaryOrigin = "ai"; }); } catch (e) { toast((e as Error).message, { tone: "bad" }); } setBusy(false); return; }
    update(id, (d) => { d.brief.summary = buildSummary(d.brief, d.messages); d.brief.summaryOrigin = "generated"; });
  };
  return (
    <Card className="p-5">
      <SectionTitle title={t("Strategic campaign summary")} hint={t("Generated from your brief and messaging library. Edit freely — it appears in the presentation’s executive summary.")}
        action={<><Button size="sm" icon={<RefreshCw size={13} />} onClick={() => generate(false)}>{t(b.summary ? "Regenerate" : "Generate")}</Button>{status?.ai.configured && <Button size="sm" variant="soft" loading={busy} icon={<Sparkles size={13} />} onClick={() => generate(true)}>{t("Write with AI")}</Button>}</>} />
      {b.summary ? <><div className="mb-2 flex gap-1.5">{b.summaryOrigin === "ai" ? <SourceBadge source="ai" /> : b.summaryOrigin === "edited" ? <Badge>{t("Edited")}</Badge> : <Badge>{t("Generated from your brief")}</Badge>}</div>
        <Textarea rows={12} value={b.summary} onChange={(e) => update(id, (d) => { d.brief.summary = e.target.value; d.brief.summaryOrigin = "edited"; }, "summary")} className="!text-[14px] leading-relaxed" /></>
        : <div className="rounded-xl border border-dashed p-8 text-center"><p className="mb-3 text-[13.5px] text-ink-2">{t("Create a summary of the strategy so far.")}</p><Button variant="primary" onClick={() => generate(false)}>{t("Generate summary")}</Button></div>}
    </Card>
  );
}
