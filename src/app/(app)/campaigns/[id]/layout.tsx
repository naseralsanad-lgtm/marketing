"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Check, ChevronLeft, History, Redo2, Sparkles, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useModel } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Assistant } from "@/components/Assistant";
import { Badge, Button, Empty, IconButton, Input, Modal, useUI } from "@/components/ui";
import { cx, fmtDate } from "@/lib/utils";

const STEPS = [{ n: "01", key: "brief", label: "Campaign Brief" }, { n: "02", key: "build", label: "Build Campaign" }, { n: "03", key: "plan", label: "Campaign Plan" }];
const WorkspaceCtx = createContext<{ openAssistant: (focusId?: string) => void }>({ openAssistant: () => {} });
export const useWorkspace = () => useContext(WorkspaceCtx);

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>(); const path = usePathname(); const router = useRouter(); const t = useT(); const { toast, confirm } = useUI();
  const model = useModel(id);
  const { update, undo, redo, canUndo, canRedo, saveVersion, restoreVersion } = useStore.getState();
  useStore((s) => s.tick);
  const [assistant, setAssistant] = useState<{ open: boolean; focusId?: string }>({ open: false });
  const [versions, setVersions] = useState(false); const [vLabel, setVLabel] = useState("");
  const current = STEPS.findIndex((s) => path.endsWith(`/${s.key}`));
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); if (e.shiftKey) redo(id); else undo(id); } };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [id, undo, redo]);
  useEffect(() => { if (model && current >= 0 && model.campaign.step !== current + 1) useStore.setState((s) => ({ campaigns: { ...s.campaigns, [id]: { ...s.campaigns[id], step: (current + 1) as 1 } } })); }, [current, id, model?.campaign.step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return <div className="p-8"><Empty title={t("Campaign not found")} text={t("It may have been deleted, or it lives in another browser.")} action={<Link href="/campaigns"><Button variant="primary">{t("My Campaigns")}</Button></Link>} /></div>;
  const c = model.campaign;
  return (
    <WorkspaceCtx.Provider value={{ openAssistant: (focusId) => setAssistant({ open: true, focusId }) }}>
      <div className="flex min-h-full flex-col">
        <header className="glass no-print sticky top-0 z-30 border-b">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-8">
            <Link href="/campaigns" aria-label={t("My Campaigns")} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2"><ChevronLeft size={18} className="rtl:rotate-180" /></Link>
            <div className="min-w-0 flex-1">
              <input aria-label={t("Campaign name")} value={c.brief.name} placeholder={t("Untitled campaign")} onChange={(e) => update(id, (d) => { d.brief.name = e.target.value; if (!d.deck.title || d.deck.title === c.brief.name) d.deck.title = e.target.value; }, "name")} className="inline-edit max-w-full truncate text-[16px] font-semibold" />
              <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                {c.isDemo && <Badge tone="warn">{t("Demonstration campaign")}</Badge>}
                <span className="flex items-center gap-1"><Check size={11} />{t("Saved")} {new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <nav aria-label={t("Progress")} className="order-last flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto">
              {STEPS.map((s, i) => (
                <button key={s.key} onClick={() => router.push(`/campaigns/${id}/${s.key}`)} aria-current={i === current ? "step" : undefined} className={cx("group flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-3.5 ps-1.5 text-[13px] transition", i === current ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}>
                  <span className={cx("num flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", i === current ? "bg-bg/20" : i < current ? "bg-good-soft text-good" : "bg-surface-2")}>{i < current ? <Check size={12} /> : s.n}</span>
                  <span className="font-medium">{t(s.label)}</span>
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-0.5">
              <IconButton label={t("Undo")} disabled={!canUndo(id)} onClick={() => undo(id)}><Undo2 size={16} /></IconButton>
              <IconButton label={t("Redo")} disabled={!canRedo(id)} onClick={() => redo(id)}><Redo2 size={16} /></IconButton>
              <IconButton label={t("Version history")} onClick={() => setVersions(true)}><History size={16} /></IconButton>
              <Button variant="soft" size="sm" icon={<Sparkles size={14} />} className="ms-1" onClick={() => setAssistant({ open: true })}>{t("Assistant")}</Button>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">{children}</div>
      </div>
      <Assistant open={assistant.open} focusId={assistant.focusId} onClose={() => setAssistant({ open: false })} model={model} />
      <Modal open={versions} onClose={() => setVersions(false)} title={t("Version history")}>
        <p className="mb-3 text-[13px] text-ink-2">{t("Every change is saved automatically. Save a named version before major changes so you can return to it.")}</p>
        <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); saveVersion(id, vLabel.trim() || `${t("Version")} ${c.versions.length + 1}`); setVLabel(""); toast(t("Version saved")); }}>
          <Input value={vLabel} onChange={(e) => setVLabel(e.target.value)} placeholder={t("Version name, e.g. “Before client review”")} /><Button variant="primary" type="submit">{t("Save version")}</Button>
        </form>
        {c.versions.length ? <ul className="divide-y rounded-xl border">{c.versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div className="min-w-0"><div className="truncate text-[13.5px] font-medium">{v.label}</div><div className="text-[12px] text-ink-3">{fmtDate(v.at.slice(0, 10))} · {new Date(v.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></div>
            <Button size="sm" onClick={async () => { if (await confirm({ title: t("Restore this version?"), text: t("The campaign will return to this saved state. You can undo this."), confirmLabel: t("Restore") })) { restoreVersion(id, v.id); setVersions(false); toast(t("Version restored")); } }}>{t("Restore")}</Button></li>))}</ul>
          : <div className="rounded-xl border border-dashed p-6 text-center text-[13px] text-ink-3">{t("No saved versions yet.")}</div>}
      </Modal>
    </WorkspaceCtx.Provider>
  );
}
