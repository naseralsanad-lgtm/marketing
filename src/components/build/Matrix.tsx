"use client";
import { useState } from "react";
import { AlertTriangle, Grid3x3, Info, Wand2 } from "lucide-react";
import type { MsgLevel } from "@/lib/types";
import type { Model } from "@/lib/model";
import { MESSAGE_TYPE_LABEL } from "@/lib/analysis";
import { distributeMessages } from "@/lib/content";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Avatar, Badge, Button, Card, Empty, Note, SectionTitle, useUI } from "@/components/ui";
import { cx } from "@/lib/utils";

export function Matrix({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const t = useT(); const { toast, confirm } = useUI(); const update = useStore((s) => s.update); const [highlight, setHighlight] = useState<string | null>(null);
  const c = model.campaign; const cols = c.assignments.filter((a) => model.lib[a.influencerId]);
  if (!cols.length || !model.matrix.length) return <Empty icon={<Grid3x3 size={22} />} title={t(!cols.length ? "Select influencers first" : "No messages to assign")} text={t(!cols.length ? "The matrix shows how campaign messages are spread across your selected creators." : "Add a factsheet or messages in Step 1 to build the matrix.")} />;
  const cycle = (infId: string, msgId: string) => {
    const a = c.assignments.find((x) => x.influencerId === infId); if (a?.plan?.locked) { toast(t("This creator’s content is locked. Unlock it in the Content tab to change assignments."), { tone: "warn" }); return; }
    update(c.id, (d) => { const x = d.assignments.find((y) => y.influencerId === infId)!; const cur = x.messages[msgId]; if (!cur) x.messages[msgId] = "primary"; else if (cur === "primary") x.messages[msgId] = "supporting"; else delete x.messages[msgId]; });
  };
  const auto = async (onlyGaps: boolean) => {
    if (!onlyGaps && !(await confirm({ title: t("Reassign all messages?"), text: t("Existing assignments will be replaced for creators whose content is not locked. You can undo this."), confirmLabel: t("Reassign") }))) return;
    const dist = distributeMessages(onlyGaps ? c : { ...c, assignments: c.assignments.map((a) => (a.plan?.locked ? a : { ...a, messages: {} })) }, model.lib, model.scores);
    update(c.id, (d) => { for (const a of d.assignments) { if (a.plan?.locked) continue; if (!onlyGaps) { a.messages = dist[a.influencerId] ?? {}; continue; }
      for (const r of model.matrix) if ((r.status === "uncovered" || r.status === "no_owner") && dist[a.influencerId]?.[r.message.id] === "primary" && !d.assignments.some((x) => x.messages[r.message.id] === "primary")) a.messages[r.message.id] = "primary"; } });
    toast(t(onlyGaps ? "Gaps filled" : "Messages reassigned"), { action: { label: t("Undo"), run: () => useStore.getState().undo(c.id) } });
  };
  const critical = model.alerts.filter((a) => a.level !== "info");
  return (
    <div className="space-y-4">
      <SectionTitle title={t("Message coverage matrix")} hint={t("Rows are messages and services; columns are creators. Click a cell to cycle: empty → primary owner → supporting → empty.")}
        action={<><Button icon={<Wand2 size={14} />} disabled={!critical.length} onClick={() => auto(true)}>{t("Fill gaps only")}</Button><Button variant="ghost" onClick={() => auto(false)}>{t("Reassign all…")}</Button></>} />
      {model.alerts.length > 0 ? <div className="space-y-1.5">{model.alerts.slice(0, 6).map((a, i) => <button key={i} onClick={() => setHighlight(a.messageId)} className="block w-full text-start"><Note tone={a.level === "critical" ? "bad" : a.level === "warning" ? "warn" : "neutral"} icon={a.level === "info" ? <Info size={14} /> : <AlertTriangle size={14} />}>{a.text}</Note></button>)}{model.alerts.length > 6 && <p className="text-[12px] text-ink-3">+{model.alerts.length - 6} {t("more")}</p>}</div>
        : <Note tone="good">{t("Every message has a primary owner and there is no unnecessary duplication.")}</Note>}
      <Card className="overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead><tr>
            <th className="sticky start-0 top-0 z-20 min-w-[280px] border-b border-e bg-surface px-3 py-2 text-start align-bottom text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{t("Message / service")}</th>
            {cols.map((a) => { const i = model.lib[a.influencerId]; return <th key={i.id} className="sticky top-0 z-10 w-[58px] min-w-[58px] border-b bg-surface px-1 py-2 align-bottom font-normal"><button onClick={() => onOpen(i.id)} className="flex w-full flex-col items-center gap-1" title={`${i.name}${a.plan?.locked ? " (locked)" : ""}`}><Avatar name={i.name} src={i.avatarUrl} size={28} /><span className="w-full truncate text-[10.5px] text-ink-2">{i.name.split(" ")[0]}</span></button></th>; })}
            <th className="sticky top-0 z-10 min-w-[150px] border-b bg-surface px-3 py-2 text-start align-bottom text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{t("Segments reached")}</th>
          </tr></thead>
          <tbody>{model.matrix.map((r) => (
            <tr key={r.message.id} className={cx(highlight === r.message.id && "bg-warn-soft/50")}>
              <td className={cx("sticky start-0 z-10 border-b border-e bg-surface px-3 py-2", highlight === r.message.id && "!bg-warn-soft")}>
                <div className="line-clamp-2" title={r.message.text}>{r.message.text}</div>
                <div className="mt-1 flex flex-wrap gap-1"><Badge>{t(MESSAGE_TYPE_LABEL[r.message.type])}</Badge>{r.message.priority === "mandatory" && <Badge tone="bad">{t("Mandatory")}</Badge>}{r.message.priority === "high" && <Badge tone="warn">{t("High priority")}</Badge>}
                  {r.status === "uncovered" && <Badge tone="bad">{t("Uncovered")}</Badge>}{r.status === "no_owner" && <Badge tone="warn">{t("No owner")}</Badge>}{r.status === "duplicate" && <Badge>{t("Duplication")}</Badge>}</div>
              </td>
              {cols.map((a) => { const l = a.messages[r.message.id] as MsgLevel | undefined; return (
                <td key={a.influencerId} className="border-b p-1 text-center"><button aria-label={`${model.lib[a.influencerId].name}: ${l ?? "not assigned"}`} onClick={() => cycle(a.influencerId, r.message.id)} className={cx("mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition hover:scale-110", l === "primary" ? "bg-accent text-white" : l === "supporting" ? "bg-accent-soft text-accent" : "bg-surface-2 text-transparent hover:text-ink-3", a.plan?.locked && "opacity-60")}>{l === "primary" ? "P" : l === "supporting" ? "S" : "+"}</button></td>); })}
              <td className="border-b px-3 py-2 text-[11.5px] text-ink-2">{r.segments.join(", ") || "—"}</td>
            </tr>))}</tbody>
        </table>
      </Card>
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-3"><span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">P</span>{t("Primary message ownership")}</span><span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded bg-accent-soft text-[10px] font-bold text-accent">S</span>{t("Supporting coverage")}</span><span>{t("Restrictions apply to every creator and are listed in each brief. Calls to action are intentionally repeated.")}</span></div>
    </div>
  );
}
