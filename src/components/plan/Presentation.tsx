"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileDown, FileSpreadsheet, FileText, GripVertical, Languages, Maximize2, Pencil, Presentation as PresIcon, Printer, RotateCcw, Upload, Users, X } from "lucide-react";
import type { Model } from "@/lib/model";
import { SLIDES } from "@/lib/constants";
import { buildDeck, deckContentStrings, type Slide } from "@/lib/deck/build";
import { exportPptx } from "@/lib/export/pptx";
import { exportWorkbook, shortlistCSV } from "@/lib/export/xlsx";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { DeckFont, SlideView } from "./SlideView";
import { Badge, Button, Card, Field, IconButton, Input, Modal, Note, Segmented, Textarea, useUI } from "@/components/ui";
import { cx, download, slug, openDoc } from "@/lib/utils";

const readDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

export function Presentation({ model }: { model: Model }) {
  const t = useT(); const { toast } = useUI(); const status = useStatus(); const update = useStore((s) => s.update);
  const c = model.campaign, d = c.deck; const slides = useMemo(() => buildDeck(model), [model]);
  const [cur, setCur] = useState(0); const [busy, setBusy] = useState<string | null>(null); const [edit, setEdit] = useState<Slide | null>(null); const [full, setFull] = useState(false); const [drag, setDrag] = useState<string | null>(null);
  const logo = useRef<HTMLInputElement>(null), font = useRef<HTMLInputElement>(null);
  const idx = Math.min(cur, Math.max(0, slides.length - 1)); const slide = slides[idx];
  const set = (fn: (x: typeof d) => void, label?: string) => update(c.id, (x) => fn(x.deck), label);
  const file = `${slug(d.title || c.brief.name)}`;
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast(`${t("Export failed")}: ${(e as Error).message}`, { tone: "bad" }); } setBusy(null); };
  const move = (id: string, dir: number) => set((x) => { const i = x.order.indexOf(id), j = i + dir; if (j < 0 || j >= x.order.length) return; [x.order[i], x.order[j]] = [x.order[j], x.order[i]]; });
  const translate = () => run("tr", async () => {
    const strings = deckContentStrings(model).filter((s) => !d.translations?.[s]);
    if (!strings.length) { toast(t("Content is already translated.")); return; }
    const map: Record<string, string> = {};
    for (let i = 0; i < strings.length; i += 120) { const part = strings.slice(i, i + 120); const r = await api<{ items: { key: string; text: string }[] }>("/api/ai/translate", { method: "POST", json: { to: "Arabic", items: part.map((text, k) => ({ key: String(i + k), text })) } }); for (const it of r.items) { const src = strings[Number(it.key)]; if (src && it.text) map[src] = it.text; } }
    set((x) => { x.translations = { ...x.translations, ...map }; }); toast(t("{n} content items translated to Arabic", { n: Object.keys(map).length }));
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr_300px]">
      <DeckFont deck={d} />
      {/* slide list */}
      <Card className="max-h-[78vh] overflow-y-auto p-2 xl:sticky xl:top-28 xl:self-start">
        <div className="flex items-center justify-between px-2 py-1.5"><span className="text-[12.5px] font-semibold">{t("Slides")} <span className="num font-normal text-ink-3">{SLIDES.length - d.hidden.length}/{SLIDES.length}</span></span>
          <button className="text-[12px] text-accent" onClick={() => set((x) => { x.hidden = []; x.order = SLIDES.map((s) => s.id); })}>{t("Reset")}</button></div>
        <ul>{d.order.map((id, i) => { const meta = SLIDES.find((s) => s.id === id); if (!meta) return null; const hidden = d.hidden.includes(id); const pages = slides.filter((s) => s.base === id); const active = slide?.base === id; return (
          <li key={id} draggable onDragStart={() => setDrag(id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag && drag !== id) set((x) => { const from = x.order.indexOf(drag); x.order.splice(from, 1); x.order.splice(x.order.indexOf(id), 0, drag); }); setDrag(null); }}
            className={cx("group flex items-center gap-1 rounded-lg px-1 py-1 text-[12.5px]", active && "bg-accent-soft", hidden && "opacity-45")}>
            <GripVertical size={13} className="shrink-0 cursor-grab text-ink-3" />
            <button className="min-w-0 flex-1 truncate text-start" onClick={() => { const k = slides.findIndex((s) => s.base === id); if (k >= 0) setCur(k); }}><span className="num text-ink-3">{String(i + 1).padStart(2, "0")}</span> {t(meta.title)}{pages.length > 1 && <span className="text-ink-3"> ×{pages.length}</span>}{!hidden && !pages.length && <span className="text-ink-3"> · {t("no data")}</span>}</button>
            <span className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><IconButton label={t("Move up")} className="!h-6 !w-6" onClick={() => move(id, -1)}><ArrowUp size={12} /></IconButton><IconButton label={t("Move down")} className="!h-6 !w-6" onClick={() => move(id, 1)}><ArrowDown size={12} /></IconButton></span>
            <IconButton label={hidden ? t("Include slide") : t("Hide slide")} className="!h-6 !w-6" onClick={() => set((x) => { x.hidden = hidden ? x.hidden.filter((h) => h !== id) : [...x.hidden, id]; })}>{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</IconButton>
          </li>); })}</ul>
      </Card>

      {/* preview */}
      <div className="min-w-0 space-y-3">
        {slide ? <>
          <div className="overflow-hidden rounded-2xl border shadow-card"><SlideView slide={slide} deck={d} page={idx + 1} total={slides.length} campaign={c.brief.name} /></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={idx === 0} onClick={() => setCur(idx - 1)}>{t("Previous")}</Button><span className="num text-[12.5px] text-ink-2">{idx + 1} / {slides.length}</span><Button size="sm" disabled={idx >= slides.length - 1} onClick={() => setCur(idx + 1)}>{t("Next")}</Button>
            <span className="flex-1" />
            {d.overrides[slide.id] && <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => set((x) => { delete x.overrides[slide.id]; })}>{t("Reset slide")}</Button>}
            <Button size="sm" icon={<Pencil size={13} />} onClick={() => setEdit(slide)}>{t("Edit slide")}</Button>
            <Button size="sm" icon={<Maximize2 size={13} />} onClick={() => setFull(true)}>{t("Preview")}</Button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{slides.map((s, i) => <button key={s.id} onClick={() => setCur(i)} aria-label={`${t("Slide")} ${i + 1}`} className={cx("overflow-hidden rounded-lg border transition", i === idx ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100")}><SlideView slide={s} deck={d} /></button>)}</div>
        </> : <Note>{t("All slides are hidden. Switch some back on in the list.")}</Note>}
        {model.dataQuality.demo > 0 && <Note tone="warn">{t("This presentation includes demonstration profiles. Slides that list creators carry a note that the figures are illustrative.")}</Note>}
      </div>

      {/* settings + export */}
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="text-[13.5px] font-semibold">{t("Presentation settings")}</div>
          <Field label={t("Presentation title")}><Input value={d.title} onChange={(e) => set((x) => { x.title = e.target.value; }, "dt")} /></Field>
          <Field label={t("Subtitle")}><Input value={d.subtitle} onChange={(e) => set((x) => { x.subtitle = e.target.value; }, "ds")} /></Field>
          <Field label={t("Language")}><Segmented size="sm" value={d.language} onChange={(v) => set((x) => { x.language = v; })} options={[{ id: "en", label: "English" }, { id: "ar", label: "العربية" }, { id: "bilingual", label: t("Bilingual") }]} /></Field>
          {d.language !== "en" && <div className="space-y-2"><p className="text-[12px] text-ink-3">{d.language === "ar" ? t("Arabic decks are right-to-left with Arabic headings and labels. Campaign content stays in the language it was written in unless translated.") : t("Bilingual decks show headings and key labels in English and Arabic.")}</p>
            {d.language === "ar" && (status?.ai.configured ? <Button size="sm" variant="soft" loading={busy === "tr"} icon={<Languages size={13} />} onClick={translate}>{t("Translate content with AI")}</Button> : <p className="text-[12px] text-ink-3">{t("Add an Anthropic API key to translate campaign content automatically.")}</p>)}
            {!!Object.keys(d.translations ?? {}).length && <Badge tone="accent">{Object.keys(d.translations!).length} {t("AI translations — review before presenting")}</Badge>}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Brand colour")}><div className="flex items-center gap-2"><input type="color" aria-label={t("Brand colour")} value={d.brandColor} onChange={(e) => set((x) => { x.brandColor = e.target.value; }, "bc")} className="h-9 w-10 cursor-pointer rounded-lg border bg-surface p-0.5" /><span className="num text-[12px] text-ink-3">{d.brandColor}</span></div></Field>
            <Field label={t("Accent colour")}><div className="flex items-center gap-2"><input type="color" aria-label={t("Accent colour")} value={d.accentColor} onChange={(e) => set((x) => { x.accentColor = e.target.value; }, "ac")} className="h-9 w-10 cursor-pointer rounded-lg border bg-surface p-0.5" /><span className="num text-[12px] text-ink-3">{d.accentColor}</span></div></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Upload size={13} />} onClick={() => logo.current?.click()}>{t(d.logoDataUrl ? "Replace logo" : "Upload logo")}</Button>{d.logoDataUrl && <IconButton label={t("Remove logo")} onClick={() => set((x) => { x.logoDataUrl = undefined; })}><X size={14} /></IconButton>}
            <Button size="sm" icon={<Upload size={13} />} onClick={() => font.current?.click()}>{d.fontName ? d.fontName : t("Upload font")}</Button>{d.fontName && <IconButton label={t("Remove font")} onClick={() => set((x) => { x.fontName = undefined; x.fontDataUrl = undefined; })}><X size={14} /></IconButton>}
          </div>
          <input ref={logo} type="file" hidden accept="image/png,image/jpeg,image/svg+xml" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 1_500_000) { toast(t("Logo must be under 1.5 MB."), { tone: "bad" }); return; } if (f.type === "image/svg+xml") { toast(t("SVG logos are shown in the preview and PDF; PowerPoint needs PNG or JPEG."), { tone: "warn" }); } const url = await readDataUrl(f); set((x) => { x.logoDataUrl = url; }); }} />
          <input ref={font} type="file" hidden accept=".ttf,.otf,.woff,.woff2" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 2_500_000) { toast(t("Font file must be under 2.5 MB."), { tone: "bad" }); return; } const url = await readDataUrl(f); set((x) => { x.fontName = f.name.replace(/\.[^.]+$/, "").replace(/[^\w \-]/g, ""); x.fontDataUrl = url; }); }} />
          {d.fontName && <p className="text-[12px] text-ink-3">{t("Custom fonts apply to the preview and PDF. PowerPoint files reference the font by name, so it must be installed on the presenting computer.")}</p>}
        </Card>
        <Card className="space-y-2 p-4">
          <div className="text-[13.5px] font-semibold">{t("Export")}</div>
          <Button variant="primary" className="w-full" loading={busy === "pptx"} icon={<PresIcon size={15} />} disabled={!slides.length} onClick={() => run("pptx", async () => { const pngLogo = d.logoDataUrl?.startsWith("data:image/svg") ? { ...d, logoDataUrl: undefined } : d; download(`${file}.pptx`, await exportPptx(slides, pngLogo, c.brief.name)); toast(t("PowerPoint downloaded — fully editable text, tables and charts")); })}>{t("PowerPoint (.pptx)")}</Button>
          <Button className="w-full" icon={<FileDown size={15} />} disabled={!slides.length} onClick={() => openDoc(`/print/${c.id}?doc=deck&auto=1`)}>{t("PDF")}</Button>
          <Button className="w-full" loading={busy === "xlsx"} icon={<FileSpreadsheet size={15} />} onClick={() => run("xlsx", async () => { download(`${file}-planning-workbook.xlsx`, await exportWorkbook(model)); toast(t("Excel workbook downloaded")); })}>{t("Excel planning workbook")}</Button>
          <Button className="w-full" icon={<Users size={15} />} disabled={!model.selected.length} onClick={() => { download(`${file}-influencer-shortlist.csv`, shortlistCSV(model), "text/csv;charset=utf-8"); toast(t("CSV shortlist downloaded")); }}>{t("CSV influencer shortlist")}</Button>
          <Button className="w-full" icon={<FileText size={15} />} disabled={!model.selected.length} onClick={() => openDoc(`/print/${c.id}?doc=briefs`)}>{t("Individual influencer briefs")}</Button>
          <Button className="w-full" icon={<Printer size={15} />} disabled={!c.events.length} onClick={() => openDoc(`/print/${c.id}?doc=schedule`)}>{t("Printable attendance schedule")}</Button>
          <p className="pt-1 text-[11.5px] text-ink-3">{t("PDF, briefs and schedules open a print view — choose “Save as PDF” in the print dialog.")}</p>
        </Card>
      </div>

      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={t("Edit slide")} footer={<Button variant="primary" onClick={() => setEdit(null)}>{t("Done")}</Button>}>
        {edit && (() => { const live = slides.find((s) => s.id === edit.id) ?? edit; const blocks = [...live.left, ...(live.right ?? [])].filter((b) => b.t === "bullets" || b.t === "text"); return (
          <div className="space-y-4">
            <Field label={t("Slide title")}><Input value={live.title} onChange={(e) => set((x) => { (x.overrides[live.id] ??= {}).title = e.target.value; }, `st${live.id}`)} /></Field>
            {blocks.map((b, k) => <Field key={k} label={("heading" in b && b.heading) || `${t("Text block")} ${k + 1}`} hint={b.t === "bullets" ? t("One bullet per line.") : undefined}><Textarea rows={5} value={b.t === "bullets" ? b.items.join("\n") : b.text} onChange={(e) => set((x) => { const o = (x.overrides[live.id] ??= {}); (o.bullets ??= {})[k] = e.target.value.split("\n"); }, `sb${live.id}${k}`)} /></Field>)}
            <Note>{t("Tables, figures and charts are generated from the campaign — edit them in the plan and the slide updates automatically. Title and text edits here apply only to this slide and can be reset.")}</Note>
          </div>); })()}
      </Modal>
      {full && slide && <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-4" onClick={() => setFull(false)} onKeyDown={(e) => { if (e.key === "ArrowRight") setCur(Math.min(slides.length - 1, idx + 1)); if (e.key === "ArrowLeft") setCur(Math.max(0, idx - 1)); if (e.key === "Escape") setFull(false); }} tabIndex={0} ref={(el) => el?.focus()}>
        <div className="mb-2 flex items-center justify-between text-white"><span className="num text-[13px]">{idx + 1} / {slides.length}</span><button aria-label={t("Close")} className="rounded-full p-2 hover:bg-white/10"><X size={18} /></button></div>
        <div className="flex min-h-0 flex-1 items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button aria-label={t("Previous")} className="rounded-full p-3 text-white hover:bg-white/10 disabled:opacity-20" disabled={idx === 0} onClick={() => setCur(idx - 1)}>‹</button>
          <div className="w-full overflow-hidden rounded-xl" style={{ maxWidth: "min(100%, calc((100vh - 120px) * 16 / 9))" }}><SlideView slide={slide} deck={d} page={idx + 1} total={slides.length} campaign={c.brief.name} /></div>
          <button aria-label={t("Next")} className="rounded-full p-3 text-white hover:bg-white/10 disabled:opacity-20" disabled={idx >= slides.length - 1} onClick={() => setCur(idx + 1)}>›</button>
        </div>
      </div>}
    </div>
  );
}
