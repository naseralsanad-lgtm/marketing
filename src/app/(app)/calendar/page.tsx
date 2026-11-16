"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Page } from "@/components/Shell";
import { CalendarView, Legend, type CalItem } from "@/components/CalendarView";
import { Card, Empty, Select, useUI } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/utils";

export default function CalendarPage() {
  const t = useT(); const router = useRouter(); const { toast } = useUI(); const campaigns = useStore((s) => s.campaigns); const lib = useStore((s) => s.library); const update = useStore((s) => s.update);
  const [cid, setCid] = useState("");
  const list = useMemo(() => Object.values(campaigns).filter((c) => c.status !== "archived"), [campaigns]);
  const items = useMemo<CalItem[]>(() => list.filter((c) => !cid || c.id === cid).flatMap((c) => c.events.map((ev) => ({ ev: list.length > 1 && !cid ? { ...ev, title: `${ev.title} · ${c.brief.name}` } : ev, campaignId: c.id, who: ev.influencerId ? lib[ev.influencerId]?.name : undefined }))), [list, cid, lib]);
  const today = todayISO(); const next = items.map((i) => i.ev.date).filter((d) => d >= today).sort()[0] ?? items.map((i) => i.ev.date).sort()[0] ?? today;
  return (
    <Page wide title={t("Calendar")} subtitle={t("Attendance, deadlines and publishing across all campaigns. Drag an activity to reschedule it.")}
      actions={list.length > 1 ? <Select className="w-64" aria-label={t("Campaign")} value={cid} onChange={(e) => setCid(e.target.value)}><option value="">{t("All campaigns")}</option>{list.map((c) => <option key={c.id} value={c.id}>{c.brief.name || t("Untitled campaign")}</option>)}</Select> : undefined}>
      {!items.length ? <Empty icon={<CalendarDays size={22} />} title={t("No scheduled activity yet")} text={t("Generate a schedule in a campaign’s Build step and it will appear here.")} /> : (
        <Card className="overflow-hidden"><div className="border-b px-4 py-3"><Legend types={items.map((i) => i.ev.type)} /></div>
          <CalendarView key={cid + next} items={items} initialDate={next} views={["day", "week", "month"]} defaultView="month"
            onOpen={(it) => router.push(`/campaigns/${it.campaignId}/build?tab=schedule`)}
            onMove={(it, date, start) => { update(it.campaignId, (d) => { const e = d.events.find((x) => x.id === it.ev.id); if (e) { e.date = date; if (start) e.start = start; e.auto = false; } }); toast(t("Moved to {d}", { d: fmtDate(date, { day: "numeric", month: "short" }) }), { action: { label: t("Undo"), run: () => useStore.getState().undo(it.campaignId) } }); }} />
        </Card>)}
    </Page>
  );
}
