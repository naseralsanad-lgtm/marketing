import type { Campaign, Influencer, ScheduleEvent } from "./types";
import { formatInfo } from "./constants";
import { addDays, dateRange, diffDays, rng, uid } from "./utils";

const clampDate = (d: string, a: string, b: string) => (a && d < a ? a : b && d > b ? b : d);
const hm = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** Build the working schedule from the content plan. Only auto-generated events are replaced. */
export function generateSchedule(c: Campaign, lib: Record<string, Influencer>): ScheduleEvent[] {
  const b = c.brief;
  const manual = c.events.filter((e) => !e.auto);
  const start = b.publishStart || b.startDate, end = b.publishEnd || b.endDate;
  if (!start || !end) return manual;
  const evDays = b.eventStart ? dateRange(b.eventStart, b.eventEnd || b.eventStart) : [];
  const preEnd = evDays.length ? addDays(evDays[0], -1) : end;
  const postStart = evDays.length ? addDays(evDays[evDays.length - 1], 1) : start;
  const locs = c.locations.length ? c.locations : [b.location || "Venue"];
  const out: ScheduleEvent[] = [];
  const add = (e: Omit<ScheduleEvent, "id" | "auto">) => out.push({ ...e, id: uid("ev"), auto: true });
  const stageSlots: Record<string, number> = {};
  c.assignments.forEach((a, idx) => {
    const inf = lib[a.influencerId]; if (!inf) return;
    const r = rng(inf.id); const first = inf.name.split(" ")[0];
    const day = evDays.length ? evDays[idx % evDays.length] : undefined;
    const loc = locs[idx % locs.length];
    let attended = false;
    a.deliverables.forEach((d, di) => {
      const info = formatInfo(d.format);
      const onSite = ["event_attendance", "story_coverage", "stage_speaker", "panel", "podcast", "interview", "live"].includes(d.format) && !!day;
      if (onSite && !attended) {
        attended = true;
        const arrive = 9 + ((idx * 2) % 6);
        add({ type: "attendance", title: `${first} on site`, influencerId: inf.id, date: day!, start: hm(arrive), end: hm(arrive + 4), location: loc });
        add({ type: "filming", title: `Filming — ${first}`, influencerId: inf.id, date: day!, start: hm(arrive, 30), end: hm(arrive + 1, 30), location: loc });
      }
      if (onSite && ["stage_speaker", "panel", "podcast", "interview", "live"].includes(d.format)) {
        const type = d.format === "podcast" ? "podcast" : d.format === "interview" ? "interview" : d.format === "live" ? "live" : "stage";
        const venue = type === "stage" ? locs.find((l) => /stage/i.test(l)) ?? loc : type === "podcast" ? locs.find((l) => /podcast|studio/i.test(l)) ?? loc : loc;
        const key = `${day}|${venue}`; const slot = (stageSlots[key] = (stageSlots[key] ?? 0) + 1);
        const h = 11 + slot * 2;
        add({ type, title: `${info.label} — ${first}`, influencerId: inf.id, date: day!, start: hm(h), end: hm(h + 1), location: venue });
      }
      // publishing + production deadlines
      let publish = d.publishDate;
      if (!publish) {
        if (info.phase === "pre") publish = clampDate(addDays(preEnd, -Math.floor(r() * Math.min(6, Math.max(1, diffDays(start, preEnd))))), start, end);
        else if (info.phase === "post") publish = clampDate(addDays(postStart, 1 + Math.floor(r() * 3)), start, end);
        else if (info.phase === "during" && day) publish = d.format === "podcast" ? clampDate(addDays(day, 4), start, end) : day;
        else { const span = Math.max(1, diffDays(start, end)); publish = addDays(start, Math.floor(((idx * 3 + di * 5 + r() * 3) % span))); }
      }
      const liveFormat = ["story_coverage", "event_attendance", "live", "stage_speaker", "panel"].includes(d.format);
      if (!liveFormat) {
        add({ type: "submission", title: `Submit ${info.label.toLowerCase()} — ${first}`, influencerId: inf.id, date: addDays(publish, -5) });
        add({ type: "approval", title: `Approve ${info.label.toLowerCase()} — ${first}`, influencerId: inf.id, date: addDays(publish, -2) });
      }
      if (!["stage_speaker", "panel"].includes(d.format))
        add({ type: info.phase === "pre" ? "pre_event" : info.phase === "post" ? "post_event" : "publish", title: `Publish ${info.label.toLowerCase()}${d.count > 1 ? ` ×${d.count}` : ""} — ${first}`, influencerId: inf.id, date: publish, notes: d.platform });
    });
  });
  return [...manual, ...out].sort((x, y) => (x.date + (x.start ?? "")).localeCompare(y.date + (y.start ?? "")));
}

export interface Conflict { level: "critical" | "warning" | "info"; kind: string; text: string; eventIds: string[]; date?: string }

export function findConflicts(c: Campaign, lib: Record<string, Influencer>): Conflict[] {
  const out: Conflict[] = []; const b = c.brief;
  const name = (id?: string) => (id && lib[id]?.name) || "Unassigned";
  const timed = c.events.filter((e) => e.start && e.influencerId);
  const byKey: Record<string, ScheduleEvent[]> = {};
  for (const e of timed) (byKey[`${e.influencerId}|${e.date}`] ??= []).push(e);
  for (const list of Object.values(byKey)) {
    const s = list.filter((e) => e.type !== "attendance").sort((x, y) => x.start!.localeCompare(y.start!));
    for (let i = 0; i < s.length - 1; i++) if ((s[i].end ?? s[i].start!) > s[i + 1].start!)
      out.push({ level: "critical", kind: "Overlapping commitments", text: `${name(s[i].influencerId)}: “${s[i].title}” overlaps “${s[i + 1].title}”`, eventIds: [s[i].id, s[i + 1].id], date: s[i].date });
    const att = list.find((e) => e.type === "attendance");
    if (att) for (const e of s) if (e.start! < att.start! || (e.end ?? e.start!) > (att.end ?? "23:59"))
      out.push({ level: "warning", kind: "Scheduling conflict", text: `${name(e.influencerId)}: “${e.title}” (${e.start}) falls outside their attendance window ${att.start}–${att.end}`, eventIds: [e.id, att.id], date: e.date });
  }
  // same location, same time, different people on stage/podcast
  const venue: Record<string, ScheduleEvent[]> = {};
  for (const e of c.events.filter((x) => x.start && x.location && ["stage", "podcast", "interview"].includes(x.type))) (venue[`${e.date}|${e.location}`] ??= []).push(e);
  for (const list of Object.values(venue)) { const s = list.sort((x, y) => x.start!.localeCompare(y.start!)); for (let i = 0; i < s.length - 1; i++) if ((s[i].end ?? s[i].start!) > s[i + 1].start! && s[i].influencerId !== s[i + 1].influencerId) out.push({ level: "critical", kind: "Scheduling conflict", text: `${s[i].location} is double-booked: “${s[i].title}” and “${s[i + 1].title}”`, eventIds: [s[i].id, s[i + 1].id], date: s[i].date }); }
  // production timelines
  for (const a of c.assignments) {
    const mine = c.events.filter((e) => e.influencerId === a.influencerId);
    if (!mine.length) { out.push({ level: "warning", kind: "Missing assignments", text: `${name(a.influencerId)} has no scheduled activity`, eventIds: [] }); continue; }
    const film = mine.filter((e) => e.type === "filming").sort((x, y) => x.date.localeCompare(y.date))[0];
    for (const s of mine.filter((e) => e.type === "submission")) {
      if (film && s.date >= film.date && diffDays(film.date, s.date) < 2 && /highlight|podcast|interview/i.test(s.title)) out.push({ level: "warning", kind: "Unrealistic production timeline", text: `${name(a.influencerId)}: only ${diffDays(film.date, s.date)} day(s) between filming and “${s.title}”`, eventIds: [film.id, s.id], date: s.date });
      if (b.startDate && s.date < b.startDate) out.push({ level: "warning", kind: "Unrealistic production timeline", text: `“${s.title}” is due before the campaign starts`, eventIds: [s.id], date: s.date });
    }
    const pubs = mine.filter((e) => ["publish", "pre_event", "post_event"].includes(e.type));
    for (const p of pubs) {
      const key = p.title.replace(/^Publish /, "").split(" — ")[0].replace(/ ×\d+$/, "");
      const appr = mine.find((e) => e.type === "approval" && e.title.includes(key));
      if (appr && appr.date > p.date) out.push({ level: "critical", kind: "Publishing deadline", text: `${name(a.influencerId)}: “${p.title}” is scheduled before its approval`, eventIds: [p.id, appr.id], date: p.date });
      const end = b.publishEnd || b.endDate, start = b.publishStart || b.startDate;
      if ((end && p.date > end) || (start && p.date < start)) out.push({ level: "warning", kind: "Publishing deadline", text: `“${p.title}” falls outside the publishing period`, eventIds: [p.id], date: p.date });
    }
  }
  if (b.eventStart) for (const d of dateRange(b.eventStart, b.eventEnd || b.eventStart))
    if (c.assignments.length && !c.events.some((e) => e.date === d && e.type === "attendance")) out.push({ level: "warning", kind: "Attendance gap", text: `No influencer is scheduled to attend on ${d}`, eventIds: [], date: d });
  const order = { critical: 0, warning: 1, info: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}
