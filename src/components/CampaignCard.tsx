"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, LayoutTemplate, Pencil, Trash2 } from "lucide-react";
import type { Campaign } from "@/lib/types";
import { useStore } from "@/lib/store";
import { budgetTotal } from "@/lib/budget";
import { useT } from "@/lib/i18n";
import { Badge, Card, IconButton, useUI, type Tone } from "./ui";
import { fmtShort, moneyCompact, todayISO } from "@/lib/utils";

export function campaignPhase(c: Campaign): { label: string; tone: Tone } {
  const today = todayISO();
  if (c.status === "archived") return { label: "Archived", tone: "neutral" };
  if (!c.brief.startDate) return { label: "Draft", tone: "neutral" };
  if (c.brief.endDate && c.brief.endDate < today) return { label: "Completed", tone: "neutral" };
  if (c.brief.startDate > today) return c.assignments.length ? { label: "Upcoming", tone: "accent" } : { label: "Draft", tone: "neutral" };
  return { label: "Active", tone: "good" };
}

export function CampaignCard({ c }: { c: Campaign }) {
  const t = useT(); const router = useRouter(); const { confirm, toast } = useUI();
  const { duplicate, remove, update, saveTemplate } = useStore.getState();
  const phase = campaignPhase(c); const total = budgetTotal(c.brief.budget);
  const step = ["Campaign Brief", "Build Campaign", "Campaign Plan"][c.step - 1];
  return (
    <Card className="group flex flex-col p-5 transition-shadow hover:shadow-pop">
      <Link href={`/campaigns/${c.id}`} className="block min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-1.5"><Badge tone={phase.tone}>{t(phase.label)}</Badge>{c.isDemo && <Badge tone="warn">{t("Demo")}</Badge>}<span className="text-[11.5px] text-ink-3">{t(step)}</span></div>
        <h3 className="truncate text-[17px] font-semibold">{c.brief.name || t("Untitled campaign")}</h3>
        <p className="truncate text-[13px] text-ink-2">{c.brief.organisation || "—"}{c.brief.type ? ` · ${t(c.brief.type)}` : ""}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
          <div><div className="text-ink-3">{t("Budget")}</div><div className="num text-[15px] font-semibold">{total ? moneyCompact(total, c.brief.budget.currency) : "—"}</div></div>
          <div><div className="text-ink-3">{t("Influencers")}</div><div className="num text-[15px] font-semibold">{c.assignments.length}</div></div>
          <div><div className="text-ink-3">{t("Dates")}</div><div className="text-[13px] font-medium">{c.brief.startDate ? `${fmtShort(c.brief.startDate)} – ${fmtShort(c.brief.endDate)}` : "—"}</div></div>
        </div>
      </Link>
      <div className="mt-4 flex items-center gap-0.5 border-t pt-3">
        <IconButton label={t("Edit")} onClick={() => router.push(`/campaigns/${c.id}`)}><Pencil size={15} /></IconButton>
        <IconButton label={t("Duplicate")} onClick={() => { const id = duplicate(c.id); toast(t("Campaign duplicated")); router.push(`/campaigns/${id}/brief`); }}><Copy size={15} /></IconButton>
        <IconButton label={t("Save as template")} onClick={() => { saveTemplate(c.id, c.brief.name || t("Untitled campaign")); toast(t("Saved as a reusable template")); }}><LayoutTemplate size={15} /></IconButton>
        <IconButton label={c.status === "archived" ? t("Restore") : t("Archive")} onClick={() => { update(c.id, (d) => { d.status = d.status === "archived" ? "draft" : "archived"; }); toast(c.status === "archived" ? t("Campaign restored") : t("Campaign archived")); }}>{c.status === "archived" ? <ArchiveRestore size={15} /> : <Archive size={15} />}</IconButton>
        <span className="flex-1" />
        <IconButton label={t("Delete")} className="hover:!text-bad" onClick={async () => { if (await confirm({ title: t("Delete this campaign?"), text: t("“{name}” and its plan, schedule and presentation settings will be permanently deleted. Influencers stay in your library.", { name: c.brief.name || t("Untitled campaign") }), confirmLabel: t("Delete"), danger: true })) { remove(c.id); toast(t("Campaign deleted")); } }}><Trash2 size={15} /></IconButton>
      </div>
    </Card>
  );
}
