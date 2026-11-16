"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ScheduleEvent } from "@/lib/types";
import { eventInfo } from "@/lib/constants";
import { useLang, useT } from "@/lib/i18n";
import { Button, IconButton, Segmented } from "@/components/ui";
import { addDays, cx, dateRange, fmtDate, parseISO, startOfWeek, todayISO, toISO } from "@/lib/utils";

export type CalView = "day" | "week" | "month" | "timeline";
export interface CalItem { ev: ScheduleEvent; campaignId: string; who?: string; flagged?: boolean }
interface Props {
  items: CalItem[]; initialDate: string; range?: { start: string; end: string }; highlight?: { start: string; end: string };
  rows?: { id: string; label: string }[];
  onMove?: (item: CalItem, date: string, start?: string) => void; onOpen?: (item: CalItem) => void; onCreate?: (date: string) => void;
  views?: CalView[]; defaultView?: CalView;
}
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

export function CalendarView({ items, initialDate, range, highlight, rows, onMove, onOpen, onCreate, views = ["day", "week", "month", "timeline"], defaultView = "month" }: Props) {
  const t = useT(); const locale = useLang() === "ar" ? "ar-AE" : "en-GB";
  const [view, setView] = useState<CalView>(defaultView); const [cursor, setCursor] = useState(initialDate || todayISO()); const [over, setOver] = useState<string | null>(null);
  const byDate = useMemo(() => { const m: Record<string, CalItem[]> = {}; for (const it of items) (m[it.ev.date] ??= []).push(it); for (const k in m) m[k].sort((a, b) => (a.ev.start ?? "99").localeCompare(b.ev.start ?? "99")); return m; }, [items]);
  const today = todayISO();
  const step = (d: number) => { if (view === "month") { const x = parseISO(cursor); x.setDate(1); x.setMonth(x.getMonth() + d); setCursor(toISO(x)); } else setCursor(addDays(cursor, d * (view === "week" ? 7 : view === "timeline" ? 14 : 1))); };
  const drop = (e: React.DragEvent, date: string, start?: string) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const it = items.find((x) => x.ev.id === id); if (it && onMove && (it.ev.date !== date || (start && it.ev.start !== start))) onMove(it, date, start); };
  const dropProps = (key: string, date: string, start?: string) => onMove ? { onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (over !== key) setOver(key); }, onDragLeave: () => setOver((o) => (o === key ? null : o)), onDrop: (e: React.DragEvent) => drop(e, date, start) } : {};
  const inHl = (d: string) => highlight && d >= highlight.start && d <= highlight.end;

  // NOTE: a render function, not a component — a component defined here would be re-mounted on every
  // state change (e.g. drag-over highlighting), which cancels an in-progress native drag.
  const pill = (it: CalItem, full?: boolean) => { const info = eventInfo(it.ev.type); return (
    <button key={it.ev.id} draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.ev.id); e.dataTransfer.effectAllowed = "move"; }} onClick={(e) => { e.stopPropagation(); onOpen?.(it); }} title={`${it.ev.title}${it.ev.start ? ` · ${it.ev.start}${it.ev.end ? `–${it.ev.end}` : ""}` : ""}${it.ev.location ? ` · ${it.ev.location}` : ""}`}
      className={cx("flex w-full items-center gap-1.5 rounded-md px-1.5 py-[3px] text-start text-[11.5px] leading-tight transition hover:brightness-95", onMove && "cursor-grab active:cursor-grabbing", it.flagged && "ring-1 ring-bad")} style={{ background: `color-mix(in srgb, ${info.color} 16%, var(--surface))` }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: info.color }} />
      {it.ev.start && <span className="num shrink-0 text-ink-3">{it.ev.start}</span>}<span className={cx("min-w-0", full ? "" : "truncate")}>{it.ev.title}</span>
    </button>); };

  let title = ""; let body: React.ReactNode = null;
  if (view === "month") {
    const first = parseISO(cursor); first.setDate(1); const month = first.getMonth(); const gridStart = startOfWeek(toISO(first)); const days = dateRange(gridStart, addDays(gridStart, 41));
    title = first.toLocaleDateString(locale, { month: "long", year: "numeric" });
    body = <div className="grid grid-cols-7 border-s border-t">
      {days.slice(0, 7).map((d) => <div key={d} className="border-b border-e bg-surface-2 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{parseISO(d).toLocaleDateString(locale, { weekday: "short" })}</div>)}
      {days.map((d) => { const list = byDate[d] ?? []; const out = parseISO(d).getMonth() !== month; return (
        <div key={d} {...dropProps(d, d)} onDoubleClick={() => onCreate?.(d)} className={cx("min-h-[104px] border-b border-e p-1 transition-colors", out && "bg-surface-2/50", inHl(d) && "bg-accent-soft/40", over === d && "!bg-accent-soft")}>
          <button onClick={() => { setCursor(d); setView("day"); }} className={cx("num mb-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px]", d === today ? "bg-bad font-semibold text-white" : out ? "text-ink-3" : "hover:bg-surface-2")}>{parseISO(d).getDate()}</button>
          <div className="space-y-0.5">{list.slice(0, 3).map((it) => pill(it))}{list.length > 3 && <button className="px-1.5 text-[11px] text-ink-3 hover:text-accent" onClick={() => { setCursor(d); setView("day"); }}>+{list.length - 3} {t("more")}</button>}</div>
        </div>); })}
    </div>;
  } else if (view === "week") {
    const ws = startOfWeek(cursor); const days = dateRange(ws, addDays(ws, 6)); title = `${fmtDate(ws, { day: "numeric", month: "short" }, locale)} – ${fmtDate(days[6], { day: "numeric", month: "short", year: "numeric" }, locale)}`;
    body = <div className="grid grid-cols-1 border-s border-t sm:grid-cols-7">{days.map((d) => (
      <div key={d} {...dropProps(d, d)} onDoubleClick={() => onCreate?.(d)} className={cx("min-h-[120px] border-b border-e p-1.5 sm:min-h-[420px]", inHl(d) && "bg-accent-soft/40", over === d && "!bg-accent-soft")}>
        <button onClick={() => { setCursor(d); setView("day"); }} className="mb-2 flex items-baseline gap-1.5"><span className="text-[11px] uppercase text-ink-3">{parseISO(d).toLocaleDateString(locale, { weekday: "short" })}</span><span className={cx("num flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold", d === today && "bg-bad text-white")}>{parseISO(d).getDate()}</span></button>
        <div className="space-y-1">{(byDate[d] ?? []).map((it) => pill(it, true))}</div>
      </div>))}</div>;
  } else if (view === "day") {
    title = fmtDate(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, locale); const list = byDate[cursor] ?? []; const allDay = list.filter((x) => !x.ev.start);
    body = <div className="border-t">
      <div {...dropProps("allday", cursor)} className={cx("flex gap-3 border-b px-3 py-2", over === "allday" && "bg-accent-soft")}><span className="w-14 shrink-0 pt-0.5 text-[11px] uppercase text-ink-3">{t("All day")}</span><div className="grid flex-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">{allDay.map((it) => pill(it, true))}{!allDay.length && <span className="text-[12px] text-ink-3">—</span>}</div></div>
      {HOURS.map((h) => { const hh = `${String(h).padStart(2, "0")}:00`; const at = list.filter((x) => x.ev.start && Number(x.ev.start.slice(0, 2)) === h); return (
        <div key={h} {...dropProps(hh, cursor, hh)} onDoubleClick={() => onCreate?.(cursor)} className={cx("flex min-h-[44px] gap-3 border-b px-3 py-1.5", over === hh && "bg-accent-soft")}><span className="num w-14 shrink-0 pt-0.5 text-[11.5px] text-ink-3">{hh}</span><div className="grid flex-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">{at.map((it) => <div key={it.ev.id}>{pill(it, true)}{(it.ev.location || it.who) && <div className="px-1.5 text-[10.5px] text-ink-3">{[it.who, it.ev.location, it.ev.end && `→ ${it.ev.end}`].filter(Boolean).join(" · ")}</div>}</div>)}</div></div>); })}
    </div>;
  } else {
    const start = range?.start ?? startOfWeek(cursor); const end = range?.end ?? addDays(start, 34); const days = dateRange(start, end);
    title = `${fmtDate(start, { day: "numeric", month: "short" }, locale)} – ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" }, locale)}`;
    const rws = rows?.length ? rows : [{ id: "", label: t("All") }];
    body = <div className="overflow-x-auto border-t"><table className="border-separate border-spacing-0 text-[11.5px]"><thead><tr>
      <th className="sticky start-0 z-10 min-w-[150px] border-b border-e bg-surface px-3 py-2 text-start font-medium text-ink-3">{t("Campaign timeline")}</th>
      {days.map((d) => { const dt = parseISO(d); return <th key={d} className={cx("min-w-[34px] border-b border-e px-0.5 py-1 font-normal", inHl(d) && "bg-accent-soft", [5, 6].includes(dt.getDay()) && !inHl(d) && "bg-surface-2/60")}><div className="text-[9.5px] uppercase text-ink-3">{dt.getDate() === 1 || d === start ? dt.toLocaleDateString(locale, { month: "short" }) : dt.toLocaleDateString(locale, { weekday: "narrow" })}</div><div className={cx("num", d === today && "font-bold text-bad")}>{dt.getDate()}</div></th>; })}
    </tr></thead><tbody>{rws.map((r) => (
      <tr key={r.id}><td className="sticky start-0 z-10 max-w-[180px] truncate border-b border-e bg-surface px-3 py-1.5 font-medium">{r.label}</td>
        {days.map((d) => { const list = (byDate[d] ?? []).filter((x) => !rows?.length || (x.ev.influencerId ?? "") === r.id || (r.id === "" && !x.ev.influencerId)); const key = `${r.id}|${d}`; return (
          <td key={d} {...dropProps(key, d)} className={cx("h-9 border-b border-e p-0.5 align-middle", inHl(d) && "bg-accent-soft/40", over === key && "!bg-accent-soft")}><div className="flex flex-wrap justify-center gap-0.5">{list.map((it) => <button key={it.ev.id} draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.ev.id); }} onClick={() => onOpen?.(it)} title={`${it.ev.title}${it.ev.start ? ` · ${it.ev.start}` : ""}`} className={cx("h-3.5 w-3.5 rounded-[4px] transition hover:scale-125", onMove && "cursor-grab", it.flagged && "ring-2 ring-bad")} style={{ background: eventInfo(it.ev.type).color }} />)}</div></td>); })}
      </tr>))}</tbody></table></div>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center"><IconButton label={t("Previous")} onClick={() => step(-1)}><ChevronLeft size={16} className="rtl:rotate-180" /></IconButton><IconButton label={t("Next")} onClick={() => step(1)}><ChevronRight size={16} className="rtl:rotate-180" /></IconButton></div>
        <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{title}</h3>
        <Button size="sm" variant="ghost" onClick={() => setCursor(today)}>{t("Today")}</Button>
        <Segmented size="sm" value={view} onChange={setView} options={views.map((v) => ({ id: v, label: t({ day: "Daily", week: "Weekly", month: "Monthly", timeline: "Timeline" }[v]) }))} />
      </div>
      {body}
    </div>
  );
}

export function Legend({ types }: { types: ScheduleEvent["type"][] }) {
  const t = useT();
  return <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-2">{[...new Set(types)].map((ty) => <span key={ty} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: eventInfo(ty).color }} />{t(eventInfo(ty).label)}</span>)}</div>;
}
