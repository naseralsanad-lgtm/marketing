"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Sparkles, Undo2, X } from "lucide-react";
import type { Op, Proposal } from "@/lib/types";
import type { Model } from "@/lib/model";
import { localAssistant, type AssistantReply } from "@/lib/assistant";
import { impactOf } from "@/lib/ops";
import { assistantContext } from "@/lib/aiContext";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useFmt, useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Badge, Button, Note, Sheet, useUI } from "./ui";
import { cx, uid } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; text: string; proposals?: (Proposal & { state?: "accepted" | "rejected" })[]; engine?: string };
const SUGGESTIONS = ["Identify weaknesses in the current campaign.", "Make sure every service in the factsheet is covered.", "Increase our coverage among Hindi-speaking residents.", "Reduce the campaign budget by 20%.", "Create a more balanced mix of influencers.", "Recommend a better publishing schedule.", "Generate a shorter presentation for senior management."];

const VALID_OPS = new Set(["add_influencer", "remove_influencer", "replace_influencer", "set_fee", "set_budget", "assign_message", "add_deliverable", "remove_deliverable", "move_event", "hide_slides", "regenerate_schedule"]);
/** AI output is untrusted: keep only well-formed operations that reference ids which exist in this campaign. */
function sanitise(raw: Record<string, unknown>[], m: Model): Op[] {
  const out: Op[] = []; const c = m.campaign;
  for (const o of raw) {
    if (!VALID_OPS.has(String(o.op))) continue;
    const inf = typeof o.influencerId === "string" && m.lib[o.influencerId] ? o.influencerId : null;
    switch (o.op) {
      case "add_influencer": case "remove_influencer": if (inf) out.push({ op: o.op, influencerId: inf }); break;
      case "replace_influencer": if (inf && typeof o.toId === "string" && m.lib[o.toId]) out.push({ op: "replace_influencer", influencerId: inf, toId: o.toId }); break;
      case "set_fee": if (inf && typeof o.fee === "number" && o.fee >= 0) out.push({ op: "set_fee", influencerId: inf, fee: o.fee }); break;
      case "set_budget": if (typeof o.field === "string" && o.field in c.brief.budget && o.field !== "currency" && o.field !== "mode" && typeof o.value === "number" && o.value >= 0) out.push({ op: "set_budget", field: o.field as "total", value: o.value }); break;
      case "assign_message": if (inf && c.messages.some((x) => x.id === o.messageId) && ["primary", "supporting", "none"].includes(String(o.level))) out.push({ op: "assign_message", influencerId: inf, messageId: String(o.messageId), level: o.level as "primary" }); break;
      case "add_deliverable": if (inf && typeof o.format === "string") out.push({ op: "add_deliverable", influencerId: inf, format: o.format as "reel", count: Math.max(1, Math.min(10, Number(o.count) || 1)) }); break;
      case "remove_deliverable": if (inf && typeof o.format === "string") out.push({ op: "remove_deliverable", influencerId: inf, format: o.format as "reel" }); break;
      case "move_event": if (c.events.some((e) => e.id === o.eventId) && /^\d{4}-\d{2}-\d{2}$/.test(String(o.date))) out.push({ op: "move_event", eventId: String(o.eventId), date: String(o.date) }); break;
      case "hide_slides": if (Array.isArray(o.slideIds)) out.push({ op: "hide_slides", slideIds: o.slideIds.map(String) }); break;
      case "regenerate_schedule": out.push({ op: "regenerate_schedule" }); break;
    }
  }
  return out;
}

export function Assistant({ open, onClose, model, focusId }: { open: boolean; onClose: () => void; model: Model; focusId?: string }) {
  const t = useT(); const { toast } = useUI(); const status = useStatus(); const fmt = useFmt(model.budget.currency);
  const applyOps = useStore((s) => s.applyOps); const undo = useStore((s) => s.undo);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  const id = model.campaign.id;

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    setText(""); setMsgs((m) => [...m, { id: uid("u"), role: "user", text: q }]); setBusy(true);
    let r: AssistantReply | null = null;
    if (status?.ai.configured) {
      try {
        const res = await api<{ reply: string; proposals: { title: string; rationale: string; ops: Record<string, unknown>[]; notes: string[] }[] }>("/api/ai/assistant", { method: "POST", json: { text: q, context: assistantContext(model), focusId } });
        r = { reply: res.reply, engine: "claude", proposals: res.proposals.map((p) => ({ id: uid("p"), title: p.title, rationale: p.rationale, notes: p.notes, ops: sanitise(p.ops, model) })).filter((p) => p.ops.length) };
      } catch (e) { toast(`${(e as Error).message} ${t("Using the built-in assistant instead.")}`, { tone: "warn" }); }
    }
    r ??= localAssistant(q, model, focusId);
    setMsgs((m) => [...m, { id: uid("a"), role: "assistant", text: r!.reply, proposals: r!.proposals, engine: r!.engine }]); setBusy(false);
  };
  const decide = (mid: string, pid: string, state: "accepted" | "rejected") => setMsgs((ms) => ms.map((m) => m.id !== mid ? m : { ...m, proposals: m.proposals?.map((p) => p.id === pid ? { ...p, state } : p) }));
  const accept = (mid: string, p: Proposal) => {
    const skipped = applyOps(id, p.ops, p.title); decide(mid, p.id, "accepted");
    toast(skipped.length ? `${t("Applied with exceptions")}: ${skipped[0]}` : t("Changes applied"), { tone: skipped.length ? "warn" : undefined, action: { label: t("Undo"), run: () => { undo(id); decide(mid, p.id, "rejected"); } } });
  };

  return (
    <Sheet open={open} onClose={onClose} width={480} title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-accent" />{t("Campaign Assistant")}<Badge tone={status?.ai.configured ? "accent" : "neutral"}>{status?.ai.configured ? "Claude" : t("Built-in")}</Badge></span>}
      footer={<form className="flex w-full items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} rows={1} placeholder={t("Ask for a change or a second opinion…")} className="field max-h-32 min-h-[38px] flex-1 resize-none !rounded-2xl" />
        <button type="submit" aria-label={t("Send")} disabled={!text.trim() || busy} className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-white transition disabled:opacity-30"><ArrowUp size={17} /></button>
      </form>}>
      {!msgs.length && (
        <div className="space-y-4">
          <p className="text-[13.5px] text-ink-2">{t("I know this campaign’s brief, audience, budget, selected influencers and messaging. Ask me to change something — I’ll show the proposed changes and their impact before anything is applied.")}</p>
          {!status?.ai.configured && <Note>{t("Running with the built-in assistant, which understands common planning requests. Add an Anthropic API key for open-ended requests.")}</Note>}
          <div className="flex flex-col items-start gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-2xl border bg-surface px-3.5 py-2 text-start text-[13px] transition hover:bg-surface-2">{t(s)}</button>)}</div>
        </div>
      )}
      <div className="space-y-4">
        {msgs.map((m) => (
          <div key={m.id} className={cx("fade-up", m.role === "user" && "flex justify-end")}>
            {m.role === "user" ? <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-accent px-3.5 py-2 text-[13.5px] text-white">{m.text}</div> : (
              <div className="space-y-3">
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.text}</div>
                {m.proposals?.map((p) => <ProposalCard key={p.id} p={p} model={model} fmt={fmt} onAccept={() => accept(m.id, p)} onReject={() => decide(m.id, p.id, "rejected")} />)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="flex gap-1.5 py-2">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-ink-3" style={{ animationDelay: `${i * 150}ms` }} />)}</div>}
        <div ref={end} />
      </div>
    </Sheet>
  );
}

function ProposalCard({ p, model, fmt, onAccept, onReject }: { p: Proposal & { state?: string }; model: Model; fmt: ReturnType<typeof useFmt>; onAccept: () => void; onReject: () => void }) {
  const t = useT();
  const [impact] = useState(() => impactOf(model.campaign, p.ops, model.lib, fmt));
  return (
    <div className={cx("rounded-2xl border p-3.5", p.state === "rejected" && "opacity-50")}>
      <div className="flex items-start justify-between gap-2"><div className="text-[14px] font-semibold">{p.title}</div><Badge>{p.ops.length} {t(p.ops.length === 1 ? "change" : "changes")}</Badge></div>
      <p className="mt-1 text-[12.5px] text-ink-2">{p.rationale}</p>
      {!!p.notes?.length && <ul className="mt-2 space-y-0.5 text-[12.5px]">{p.notes.slice(0, 8).map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-ink-3">•</span>{n}</li>)}{p.notes.length > 8 && <li className="text-ink-3">+{p.notes.length - 8} {t("more")}</li>}</ul>}
      <div className="mt-3 rounded-xl bg-surface-2 p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("Anticipated impact")}</div>
        {impact.rows.length ? <table className="w-full text-[12.5px]"><tbody>{impact.rows.map((r) => <tr key={r.label}><td className="py-0.5 pe-2 text-ink-2">{r.label}</td><td className="num py-0.5 text-end text-ink-3">{r.before}</td><td className="px-1 text-ink-3">→</td><td className={cx("num py-0.5 text-end font-medium", r.better === true && "text-good", r.better === false && "text-warn")}>{r.after}</td></tr>)}</tbody></table> : <div className="text-[12.5px] text-ink-3">{t("No change to headline figures.")}</div>}
        {impact.skipped.map((s, i) => <div key={i} className="mt-1 text-[12px] text-warn">{s}</div>)}
        <div className="mt-1.5 text-[11px] text-ink-3">{t("Estimates, not guaranteed outcomes.")}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {p.state === "accepted" ? <Badge tone="good"><Check size={12} />{t("Applied")}</Badge> : p.state === "rejected" ? <Badge><Undo2 size={12} />{t("Not applied")}</Badge> : <><Button size="sm" variant="primary" icon={<Check size={13} />} onClick={onAccept}>{t("Accept")}</Button><Button size="sm" variant="ghost" icon={<X size={13} />} onClick={onReject}>{t("Reject")}</Button></>}
      </div>
    </div>
  );
}
