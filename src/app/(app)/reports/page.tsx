"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Presentation as PresIcon, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeModel } from "@/lib/model";
import { buildDeck } from "@/lib/deck/build";
import { exportPptx } from "@/lib/export/pptx";
import { exportWorkbook, shortlistCSV } from "@/lib/export/xlsx";
import { SLIDES } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { Page } from "@/components/Shell";
import { SlideView } from "@/components/plan/SlideView";
import { Badge, Button, Card, Empty, useUI } from "@/components/ui";
import { compact, download, fmtDate, money, slug, openDoc } from "@/lib/utils";

export default function Reports() {
  const t = useT(); const { toast } = useUI(); const campaigns = useStore((s) => s.campaigns); const lib = useStore((s) => s.library); const [busy, setBusy] = useState("");
  const rows = useMemo(() => Object.values(campaigns).filter((c) => c.status !== "archived" && c.assignments.length).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => { const m = computeModel(c, lib); return { c, m, slides: buildDeck(m) }; }), [campaigns, lib]);
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast(`${t("Export failed")}: ${(e as Error).message}`, { tone: "bad" }); } setBusy(""); };
  return (
    <Page title={t("Reports & Presentations")} subtitle={t("Leadership-ready presentations and planning exports for every campaign with a selected creator mix.")}>
      {!rows.length ? <Empty icon={<PresIcon size={22} />} title={t("No presentations yet")} text={t("Once a campaign has selected influencers, its presentation and exports are available here.")} action={<Link href="/campaigns"><Button variant="primary">{t("My Campaigns")}</Button></Link>} /> : (
        <div className="space-y-4">{rows.map(({ c, m, slides }) => { const file = slug(c.deck.title || c.brief.name); return (
          <Card key={c.id} className="grid gap-5 p-5 md:grid-cols-[300px_1fr]">
            <Link href={`/campaigns/${c.id}/plan`} className="block overflow-hidden rounded-xl border">{slides[0] && <SlideView slide={slides[0]} deck={c.deck} />}</Link>
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-[18px] font-semibold">{c.deck.title || c.brief.name}</h3>{c.isDemo && <Badge tone="warn">{t("Demo")}</Badge>}<Badge>{{ en: "English", ar: "العربية", bilingual: t("Bilingual") }[c.deck.language]}</Badge></div>
              <p className="text-[13px] text-ink-2">{slides.length} {t("slides")} ({SLIDES.length - c.deck.hidden.length} {t("sections")}) · {t("Updated")} {fmtDate(c.updatedAt.slice(0, 10))}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]"><span><b className="num">{m.selected.length}</b> {t("influencers")}</span><span><b className="num">{money(m.budget.grand, m.budget.currency)}</b> {t("planned")}</span><span><b className="num">{compact(m.forecast.expected.reach)}</b> {t("est. reach")}</span></div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link href={`/campaigns/${c.id}/plan`}><Button variant="primary" size="sm">{t("Open presentation")}</Button></Link>
                <Button size="sm" loading={busy === c.id + "p"} icon={<PresIcon size={13} />} onClick={() => run(c.id + "p", async () => download(`${file}.pptx`, await exportPptx(slides, c.deck.logoDataUrl?.startsWith("data:image/svg") ? { ...c.deck, logoDataUrl: undefined } : c.deck, c.brief.name)))}>PowerPoint</Button>
                <Button size="sm" icon={<FileDown size={13} />} onClick={() => openDoc(`/print/${c.id}?doc=deck&auto=1`)}>PDF</Button>
                <Button size="sm" loading={busy === c.id + "x"} icon={<FileSpreadsheet size={13} />} onClick={() => run(c.id + "x", async () => download(`${file}-planning-workbook.xlsx`, await exportWorkbook(m)))}>Excel</Button>
                <Button size="sm" icon={<Users size={13} />} onClick={() => download(`${file}-influencer-shortlist.csv`, shortlistCSV(m), "text/csv;charset=utf-8")}>CSV</Button>
              </div>
            </div>
          </Card>); })}</div>)}
    </Page>
  );
}
