"use client";
import { useMemo, useState } from "react";
import { FolderKanban, LayoutTemplate, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Page, useCreateCampaign } from "@/components/Shell";
import { CampaignCard, campaignPhase } from "@/components/CampaignCard";
import { Button, Card, Empty, IconButton, Input, SectionTitle, Segmented } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export default function Campaigns() {
  const t = useT(); const campaigns = useStore((s) => s.campaigns); const templates = useStore((s) => s.templates); const deleteTemplate = useStore((s) => s.deleteTemplate);
  const createCampaign = useCreateCampaign();
  const [filter, setFilter] = useState<"all" | "Active" | "Upcoming" | "Draft" | "Completed" | "Archived">("all"); const [q, setQ] = useState("");
  const list = useMemo(() => Object.values(campaigns).filter((c) => (filter === "all" ? c.status !== "archived" : campaignPhase(c).label === filter) && `${c.brief.name} ${c.brief.organisation}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [campaigns, filter, q]);
  return (
    <Page title={t("My Campaigns")} subtitle={t("Edit, duplicate, archive and reuse your campaigns.")} actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => createCampaign()}>{t("Create Campaign")}</Button>}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={filter} onChange={setFilter} options={(["all", "Active", "Upcoming", "Draft", "Completed", "Archived"] as const).map((x) => ({ id: x, label: t(x === "all" ? "All" : x) }))} />
        <div className="relative ms-auto w-full max-w-xs"><Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search campaigns")} className="!ps-8" /></div>
      </div>
      {list.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
        : <Empty icon={<FolderKanban size={22} />} title={t("No campaigns here")} text={t("Create a campaign or change the filter.")} action={<Button variant="primary" onClick={() => createCampaign()}>{t("Create Campaign")}</Button>} />}
      <section className="mt-10">
        <SectionTitle title={t("Templates")} hint={t("Reusable briefs — objectives, audience, budget split and preferences — without dates or names.")} />
        {templates.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{templates.map((tp) => (
          <Card key={tp.id} className="flex items-center gap-3 p-4"><LayoutTemplate size={18} className="shrink-0 text-ink-3" /><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{tp.name}</div><div className="text-[12px] text-ink-3">{tp.brief.type || "—"} · {fmtDate(tp.createdAt.slice(0, 10))}</div></div>
            <Button size="sm" onClick={() => createCampaign({ fromTemplate: tp })}>{t("Use")}</Button><IconButton label={t("Delete")} onClick={() => deleteTemplate(tp.id)}><Trash2 size={14} /></IconButton></Card>))}</div>
          : <p className="rounded-2xl border border-dashed p-6 text-center text-[13px] text-ink-3">{t("No templates yet. Use the template icon on any campaign card to save one.")}</p>}
      </section>
    </Page>
  );
}
