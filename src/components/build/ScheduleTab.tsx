"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, MapPin, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import type { EventType, ScheduleEvent } from "@/lib/types";
import type { Model } from "@/lib/model";
import { EVENT_TYPES } from "@/lib/constants";
import { generateSchedule } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { CalendarView, Legend, type CalItem } from "@/components/CalendarView";
import { Badge, Button, Card, Empty, Field, Input, Modal, Note, SectionTitle, Select, TagInput, Textarea, useUI } from "@/components/ui";
import { fmtDate, uid, openDoc } from "@/lib/utils";

export function EventEditor({ ev, model, onClose }: { ev: ScheduleEvent | null; model: Model; onClose: () => void }) {
  const t = useT(); const update = useStore((s) => s.update); const c = model.campaign;
  const [d, setD] = useState<ScheduleEvent | null>(ev); const [last, setLast] = useState(ev?.id);
  if (ev?.id !== last) { setLast(ev?.id); setD(ev); }
  if (!d) return null;
  const isNew = !c.events.some((e) => e.id === d.id);
  const save = () => { update(c.id, (x) => { const i = x.events.findIndex((e) => e.id === d.id); const next = { ...d, auto: false }; if (i >= 0) x.events[i] = next; else x.events.push(next); if (d.location && !x.locations.includes(d.location)) x.locations.push(d.location); }); onClose(); };
  return (
    <Modal open onClose={onClose} title={t(isNew ? "Add activity" : "Edit activity")} footer={<>{!isNew && <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => { update(c.id, (x) => { x.events = x.events.filter((e) => e.id !== d.id); }); onClose(); }}>{t("Delete")}</Button>}<span className="flex-1" /><Button onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" disabled={!d.title || !d.date} onClick={save}>{t("Save")}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Activity type")}><Select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as EventType })}>{EVENT_TYPES.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}</Select></Field>
        <Field label={t("Influencer")}><Select value={d.influencerId ?? ""} onChange={(e) => setD({ ...d, influencerId: e.target.value || undefined })}><option value="">{t("Unassigned / whole team")}</option>{model.selected.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
        <Field label={t("Title")} className="sm:col-span-2"><Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
        <Field label={t("Date")}><Input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={t("Start / arrival")}><Input type="time" value={d.start ?? ""} onChange={(e) => setD({ ...d, start: e.target.value || undefined })} /></Field><Field label={t("End / departure")}><Input type="time" value={d.end ?? ""} onChange={(e) => setD({ ...d, end: e.target.value || undefined })} /></Field></div>
        <Field label={t("Location, stand or stage")} className="sm:col-span-2"><Input list="mp-locations" value={d.location ?? ""} onChange={(e) => setD({ ...d, location: e.target.value || undefined })} /><datalist id="mp-locations">{c.locations.map((l) => <option key={l} value={l} />)}</datalist></Field>
        <Field label={t("Notes")} className="sm:col-span-2"><Textarea rows={2} value={d.notes ?? ""} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function ScheduleTab({ model }: { model: Model }) {
  const t = useT(); const { toast, confirm } = useUI(); const update = useStore((s) => s.update); const c = model.campaign; const b = c.brief;
  const [edit, setEdit] = useState<ScheduleEvent | null>(null); const [who, setWho] = useState(""); const [type, setType] = useState("");
  const flagged = useMemo(() => new Set(model.conflicts.flatMap((x) => x.eventIds)), [model.conflicts]);
  const items = useMemo<CalItem[]>(() => c.events.filter((e) => (!who || e.influencerId === who) && (!type || e.type === type)).map((ev) => ({ ev, campaignId: c.id, who: ev.influencerId ? model.lib[ev.influencerId]?.name : undefined, flagged: flagged.has(ev.id) })), [c.events, c.id, who, type, flagged, model.lib]);
  const regen = async () => {
    const manual = c.events.filter((e) => !e.auto).length;
    if (c.events.length && !(await confirm({ title: t("Regenerate the schedule?"), text: t("Auto-generated activities are rebuilt from the current deliverables. The {n} activities you added or moved yourself are kept. You can undo this.", { n: manual }), confirmLabel: t("Regenerate") }))) return;
    update(c.id, (d) => { d.events = generateSchedule(d, model.lib); }); toast(t("Schedule generated"));
  };
  if (!model.selected.length) return <Empty icon={<CalendarDays size={22} />} title={t("Select influencers first")} text={t("The schedule is generated from each creator’s deliverables.")} />;
  return (
    <div className="space-y-4">
      <SectionTitle title={t("Attendance and publishing schedule")} hint={t("Drag activities to another day (or hour in the daily view). Double-click a day to add one. Conflicts are detected automatically.")}
        action={<><Button icon={<Printer size={14} />} onClick={() => openDoc(`/print/${c.id}?doc=schedule`)}>{t("Print attendance")}</Button><Button icon={<Plus size={14} />} onClick={() => setEdit({ id: uid("ev"), type: "event", title: "", date: b.eventStart || b.startDate })}>{t("Add activity")}</Button><Button variant="primary" icon={<Wand2 size={14} />} onClick={regen}>{t(c.events.length ? "Regenerate" : "Generate schedule")}</Button></>} />
      <Card className="p-4"><Field label={<span className="flex items-center gap-1.5"><MapPin size={13} />{t("Event locations, stands and stages")}</span>} hint={t("Used when assigning creators to specific areas.")}><TagInput value={c.locations} onChange={(v) => update(c.id, (d) => { d.locations = v; })} placeholder={t("e.g. Main Stage, Podcast Studio, Stand B12")} /></Field></Card>
      {!c.events.length ? <Empty icon={<CalendarDays size={22} />} title={t("No schedule yet")} text={t("Generate attendance, filming slots, submission and approval deadlines and publishing dates from the content plan.")} action={<Button variant="primary" onClick={regen}>{t("Generate schedule")}</Button>} /> : <>
        {model.conflicts.length > 0 ? (
          <Card className="p-4"><div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold"><AlertTriangle size={15} className="text-warn" />{model.conflicts.length} {t("scheduling issue(s) detected")}</div>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">{model.conflicts.map((x, i) => <li key={i} className="flex items-start gap-2 text-[12.5px]"><Badge tone={x.level === "critical" ? "bad" : "warn"} className="shrink-0">{t(x.kind)}</Badge><button className="text-start hover:text-accent" onClick={() => { const e = c.events.find((y) => y.id === x.eventIds[0]); if (e) setEdit(e); }}>{x.text}{x.date ? ` · ${fmtDate(x.date, { day: "numeric", month: "short" })}` : ""}</button></li>)}</ul></Card>
        ) : <Note tone="good">{t("No scheduling conflicts, overlapping commitments or attendance gaps detected.")}</Note>}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Select className="w-48" aria-label={t("Influencer")} value={who} onChange={(e) => setWho(e.target.value)}><option value="">{t("All influencers")}</option>{model.selected.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
            <Select className="w-48" aria-label={t("Activity type")} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("All activities")}</option>{EVENT_TYPES.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}</Select>
            <div className="ms-auto"><Legend types={c.events.map((e) => e.type)} /></div>
          </div>
          <CalendarView items={items} initialDate={b.eventStart || b.publishStart || b.startDate} range={b.startDate && b.endDate ? { start: b.startDate, end: b.endDate } : undefined} highlight={b.eventStart ? { start: b.eventStart, end: b.eventEnd || b.eventStart } : undefined}
            rows={(who ? model.selected.filter((i) => i.id === who) : model.selected).map((i) => ({ id: i.id, label: i.name }))} defaultView="timeline"
            onOpen={(it) => setEdit(it.ev)} onCreate={(date) => setEdit({ id: uid("ev"), type: "event", title: "", date })}
            onMove={(it, date, start) => { update(c.id, (d) => { const e = d.events.find((x) => x.id === it.ev.id); if (!e) return; if (start && e.start && e.end) { const dur = (Number(e.end.slice(0, 2)) * 60 + Number(e.end.slice(3))) - (Number(e.start.slice(0, 2)) * 60 + Number(e.start.slice(3))); const s = Number(start.slice(0, 2)) * 60 + dur; e.end = `${String(Math.min(23, Math.floor(s / 60))).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; } if (start) e.start = start; e.date = date; e.auto = false; }); toast(t("Moved to {d}", { d: fmtDate(date, { day: "numeric", month: "short" }) }), { action: { label: t("Undo"), run: () => useStore.getState().undo(c.id) } }); }} />
        </Card>
      </>}
      <EventEditor ev={edit} model={model} onClose={() => setEdit(null)} />
    </div>
  );
}
