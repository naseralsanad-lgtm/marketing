"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { AppRoot } from "@/components/Shell";
import { useModel } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { buildDeck } from "@/lib/deck/build";
import { formatInfo, platformLabel } from "@/lib/constants";
import { DeckFont, SlideView } from "@/components/plan/SlideView";
import { Button } from "@/components/ui";
import { compact, fmtDate, IS_PREVIEW, money } from "@/lib/utils";

function Doc() {
  const { id } = useParams<{ id: string }>(); const sp = useSearchParams(); const t = useT(); const model = useModel(id); const router = useRouter();
  const doc = sp.get("doc") ?? "deck"; const auto = sp.get("auto") === "1";
  const slides = useMemo(() => (model && doc === "deck" ? buildDeck(model) : []), [model, doc]);
  useEffect(() => { if (model) document.title = `${model.campaign.brief.name} — ${doc === "deck" ? "Presentation" : doc === "briefs" ? "Influencer briefs" : "Attendance schedule"}`; if (model && auto && !IS_PREVIEW) { const x = setTimeout(() => window.print(), 900); return () => clearTimeout(x); } }, [model, auto, doc]);
  if (!model) return <p className="p-8">{t("Campaign not found")}</p>;
  const c = model.campaign, b = c.brief, cur = model.budget.currency;
  const bar = <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-surface px-5 py-3"><div className="text-[14px] font-semibold">{b.name}</div>{IS_PREVIEW ? <div className="flex items-center gap-3"><span className="text-[12.5px] text-ink-2">{t("Printing and PDF export work in the hosted version.")}</span><Button variant="primary" onClick={() => router.back()}>{t("Back")}</Button></div> : <div className="flex items-center gap-3"><span className="text-[12.5px] text-ink-2">{t("Choose “Save as PDF” as the destination to export a PDF.")}</span><Button variant="primary" onClick={() => window.print()}>{t("Print / Save as PDF")}</Button></div>}</div>;
  if (doc === "deck") return (<div style={{ background: "#fff" }}><DeckFont deck={c.deck} />{bar}<div className="mx-auto max-w-[1100px] space-y-6 p-6 print:max-w-none print:space-y-0 print:p-0">{slides.map((s, i) => <div key={s.id} className="print-page overflow-hidden rounded-xl border shadow-card print:rounded-none print:border-0 print:shadow-none"><SlideView slide={s} deck={c.deck} page={i + 1} total={slides.length} campaign={b.name} /></div>)}</div></div>);
  const portrait = <style>{`@media print { @page { size: A4 portrait; margin: 14mm; } }`}</style>;
  const byMsg = Object.fromEntries(c.messages.map((m) => [m.id, m]));
  if (doc === "briefs") return (
    <div className="bg-white text-black" style={{ colorScheme: "light" }}>{portrait}{bar}
      <div className="mx-auto max-w-[820px] p-8 print:max-w-none print:p-0">
        {c.assignments.filter((a) => model.lib[a.influencerId]).map((a) => { const i = model.lib[a.influencerId], p = a.plan; const evs = c.events.filter((e) => e.influencerId === i.id).sort((x, y) => (x.date + (x.start ?? "")).localeCompare(y.date + (y.start ?? "")));
          const prim = Object.entries(a.messages).filter(([, l]) => l === "primary").map(([k]) => byMsg[k]).filter(Boolean), sup = Object.entries(a.messages).filter(([, l]) => l === "supporting").map(([k]) => byMsg[k]).filter(Boolean);
          const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-5 border-b border-neutral-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{children}</h3>;
          return (
            <article key={i.id} className="mb-10 text-[13px] leading-relaxed" style={{ breakAfter: "page" }}>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">{t("Influencer brief")} · {b.name}</div>
              <h2 className="text-[24px] font-semibold">{i.name}</h2><div className="text-neutral-600">@{i.handle} · {platformLabel(i.platform)} · {compact(i.followers)} {t("followers")}{p ? ` · ${p.role}` : ""}</div>
              <H>{t("Campaign")}</H><p>{b.description || b.mainMessage}</p><p className="mt-1"><b>{t("Dates")}:</b> {fmtDate(b.startDate)} – {fmtDate(b.endDate)}{b.eventStart ? ` · ${t("Event")}: ${fmtDate(b.eventStart)} – ${fmtDate(b.eventEnd)}` : ""}{b.location ? ` · ${b.location}` : ""}</p>
              {p && <><H>{t("Your role and objective")}</H><p><b>{p.role}.</b> {p.objective}</p><H>{t("Creative concept")}</H><p>{p.concept}</p><p className="mt-1"><b>{t("Opening hook")}:</b> {p.hook}</p><p className="mt-1 whitespace-pre-wrap"><b>{t("Suggested storyline")}:</b> {p.storyline}</p></>}
              <H>{t("Messages")}</H>{prim.length + sup.length ? <ul className="list-disc ps-5">{prim.map((m) => <li key={m.id}><b>{t("Primary")}:</b> {m.text}</li>)}{sup.map((m) => <li key={m.id}>{t("Supporting")}: {m.text}</li>)}</ul> : <p>{b.mainMessage || "—"}</p>}
              {!!p?.mandatoryInfo.filter(Boolean).length && <><H>{t("Mandatory information and restrictions")}</H><ul className="list-disc ps-5">{p.mandatoryInfo.filter(Boolean).map((x, k) => <li key={k}>{x}</li>)}</ul></>}
              <H>{t("Call to action")}</H><p>{p?.cta || b.cta || "—"}</p>
              <H>{t("Deliverables")}</H><table className="w-full"><tbody>{a.deliverables.map((d) => <tr key={d.id} className="border-b border-neutral-200"><td className="py-1">{d.count}× {t(formatInfo(d.format).label)}</td><td>{platformLabel(d.platform)}</td><td>{d.durationSec ? (d.durationSec >= 120 ? `${Math.round(d.durationSec / 60)} min` : `${d.durationSec}s`) : ""}</td></tr>)}</tbody></table>
              {!!evs.length && <><H>{t("Schedule")}</H><table className="w-full"><tbody>{evs.map((e) => <tr key={e.id} className="border-b border-neutral-200"><td className="w-28 py-1">{fmtDate(e.date, { weekday: "short", day: "numeric", month: "short" })}</td><td className="w-24">{e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : ""}</td><td>{e.title.split(" — ")[0]}</td><td>{e.location ?? ""}</td></tr>)}</tbody></table></>}
              {p && <><H>{t("Production and approvals")}</H><p>{p.filming}</p><p>{p.approval}</p></>}
              <H>{t("Commercials")}</H><p>{t("Fee")}: {money(a.fee, cur)} ({t(a.feeStatus === "confirmed" ? "Confirmed" : a.feeStatus === "quoted" ? "Quoted" : "Estimated")})</p>
            </article>); })}
      </div>
    </div>);
  const days = [...new Set(c.events.filter((e) => ["attendance", "filming", "event", "stage", "podcast", "interview", "live"].includes(e.type)).map((e) => e.date))].sort();
  return (
    <div className="bg-white text-black" style={{ colorScheme: "light" }}>{portrait}{bar}
      <div className="mx-auto max-w-[820px] p-8 text-[12.5px] print:max-w-none print:p-0">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500">{t("Influencer attendance schedule")}</div><h2 className="mb-1 text-[24px] font-semibold">{b.name}</h2><div className="mb-6 text-neutral-600">{b.location}{b.eventStart ? ` · ${fmtDate(b.eventStart)} – ${fmtDate(b.eventEnd)}` : ""}</div>
        {!days.length && <p>{t("No on-site activities are scheduled.")}</p>}
        {days.map((d) => (
          <section key={d} className="mb-7" style={{ breakInside: "avoid" }}>
            <h3 className="mb-2 border-b-2 border-black pb-1 text-[15px] font-semibold">{fmtDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
            <table className="w-full"><thead><tr className="text-start text-[10.5px] uppercase tracking-wider text-neutral-500"><th className="py-1 text-start">{t("Time")}</th><th className="text-start">{t("Influencer")}</th><th className="text-start">{t("Activity")}</th><th className="text-start">{t("Location")}</th><th className="text-start">{t("Notes")}</th></tr></thead>
              <tbody>{c.events.filter((e) => e.date === d && ["attendance", "filming", "event", "stage", "podcast", "interview", "live"].includes(e.type)).sort((x, y) => (x.start ?? "").localeCompare(y.start ?? "")).map((e) => <tr key={e.id} className="border-b border-neutral-200 align-top"><td className="w-24 py-1.5 tabular-nums">{e.start ?? "—"}{e.end ? `–${e.end}` : ""}</td><td className="w-40 font-medium">{e.influencerId ? model.lib[e.influencerId]?.name : "—"}</td><td>{e.title.split(" — ")[0]}</td><td className="w-36">{e.location ?? ""}</td><td className="w-32">{e.notes ?? ""}</td></tr>)}</tbody></table>
          </section>))}
      </div>
    </div>);
}
export default function PrintPage() { return <AppRoot bare><Suspense><Doc /></Suspense></AppRoot>; }
