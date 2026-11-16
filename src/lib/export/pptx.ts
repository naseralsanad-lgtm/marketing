import type { DeckConfig } from "../types";
import type { Block, Slide } from "../deck/build";

const W = 13.333, MX = 0.6;
const hex = (c: string) => c.replace("#", "").toUpperCase();
const COLORS = ["0A84FF", "30B0C7", "34C759", "FF9F0A", "BF5AF2", "FF375F", "8E8E93", "AC8E68"];

/**
 * Editable PowerPoint export: text boxes, native tables and native charts (no flattened screenshots).
 * Arabic decks use right-to-left paragraphs and an Arabic-capable font.
 */
export async function exportPptx(slides: Slide[], deck: DeckConfig, campaignName: string): Promise<Blob> {
  const Pptx = (await import("pptxgenjs")).default; const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE"; pptx.title = deck.title || campaignName; pptx.company = "Marketing Planner"; 
  const rtl = deck.language === "ar"; if (rtl) pptx.rtlMode = true;
  const font = deck.fontName || (deck.language === "en" ? "Helvetica Neue" : "Arial");
  const brand = hex(deck.brandColor), accent = hex(deck.accentColor);
  const base = { fontFace: font, color: "1D1D1F", rtlMode: rtl, align: (rtl ? "right" : "left") as "right" | "left", lang: rtl ? "ar-AE" : "en-GB" };

  slides.forEach((s, idx) => {
    const sl = pptx.addSlide();
    if (s.kind === "cover") {
      sl.background = { color: brand };
      if (deck.logoDataUrl) sl.addImage({ data: deck.logoDataUrl, x: MX, y: 0.55, w: 2.2, h: 0.9, sizing: { type: "contain", w: 2.2, h: 0.9 } });
      sl.addText((s.subtitle ?? "").toUpperCase(), { ...base, x: W - 6.6, y: 0.6, w: 6, h: 0.4, fontSize: 12, color: "FFFFFF", align: rtl ? "left" : "right", charSpacing: 2, transparency: 20 });
      sl.addShape(pptx.ShapeType.rect, { x: rtl ? W - MX - 0.8 : MX, y: 4.05, w: 0.8, h: 0.07, fill: { color: accent }, line: { color: accent, width: 0 } });
      sl.addText(s.title, { ...base, x: MX, y: 4.3, w: W - 2 * MX - 1.5, h: 1.7, fontSize: s.title.length > 44 ? 40 : 52, bold: true, color: "FFFFFF", valign: "top", fit: "shrink" });
      sl.addText((s.meta ?? []).join("   ·   "), { ...base, x: MX, y: 6.25, w: W - 2 * MX, h: 0.5, fontSize: 16, color: "FFFFFF", transparency: 12 });
      return;
    }
    sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: rtl ? W - MX - 0.45 : MX, y: 0.5, w: 0.45, h: 0.05, fill: { color: accent }, line: { color: accent, width: 0 } });
    sl.addText(s.title, { ...base, x: MX, y: 0.62, w: W - 2 * MX - (deck.logoDataUrl ? 2 : 0), h: 0.75, fontSize: 28, bold: true, color: brand, valign: "top", fit: "shrink" });
    if (deck.logoDataUrl) sl.addImage({ data: deck.logoDataUrl, x: rtl ? MX : W - MX - 1.7, y: 0.5, w: 1.7, h: 0.6, sizing: { type: "contain", w: 1.7, h: 0.6 } });
    const top = 1.6, bottom = 6.75, gap = 0.45; const two = !!s.right?.length;
    const lw = two ? (W - 2 * MX - gap) * 0.535 : W - 2 * MX, rw = W - 2 * MX - gap - lw;
    const cols: [Block[], number, number][] = [[s.left, rtl && two ? MX + rw + gap : MX, lw]]; if (two) cols.push([s.right!, rtl ? MX : MX + lw + gap, rw]);
    for (const [blocks, x, w] of cols) {
      const fixed = (b: Block) => (b.t === "kpis" ? (b.items.length > 4 ? 2.9 : b.items.length > 2 && w < 7 ? 2 : 1.15) : 0);
      const flex = blocks.filter((b) => !fixed(b)).length || 1; const avail = bottom - top - blocks.reduce((t, b) => t + fixed(b), 0) - 0.2 * (blocks.length - 1);
      let y = top;
      for (const b of blocks) {
        let h = fixed(b) || avail / flex;
        const heading = "heading" in b && b.heading;
        if (heading) { sl.addText(heading.toUpperCase(), { ...base, x, y, w, h: 0.3, fontSize: 10, bold: true, color: brand, charSpacing: 1 }); y += 0.34; h -= 0.34; }
        if (b.t === "kpis") {
          const per = b.items.length > 4 || (b.items.length > 2 && w < 7) ? 2 : b.items.length; const cw = w / per;
          b.items.forEach((k, i) => { const kx = x + (rtl ? per - 1 - (i % per) : i % per) * cw, ky = y + Math.floor(i / per) * 0.95;
            sl.addText(k.value, { ...base, x: kx, y: ky, w: cw - 0.1, h: 0.55, fontSize: 26, bold: true, color: brand, fit: "shrink" });
            sl.addText(k.label.toUpperCase(), { ...base, x: kx, y: ky + 0.52, w: cw - 0.1, h: 0.3, fontSize: 9, color: "6E6E73", charSpacing: 0.5 }); });
        } else if (b.t === "bullets") {
          sl.addText(b.items.filter(Boolean).map((t) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: true, paraSpaceAfter: 7 } })), { ...base, x, y, w, h, fontSize: 14, valign: "top", fit: "shrink" });
        } else if (b.t === "text") {
          sl.addText(b.text, { ...base, x, y, w, h, fontSize: b.text.length > 700 ? 12 : b.text.length > 400 ? 13 : 15, valign: "top", fit: "shrink", lineSpacingMultiple: 1.15 });
        } else if (b.t === "table") {
          const total = (b.widths ?? b.head.map(() => 1)).reduce((p, q) => p + q, 0); let colW = b.head.map((_, i) => ((b.widths?.[i] ?? 1) / total) * w);
          let head = b.head, rows = b.rows; if (rtl) { head = [...head].reverse(); rows = rows.map((r) => [...r].reverse()); colW = [...colW].reverse(); }
          const fs = b.rows.length > 9 || b.head.length > 7 ? 9 : 10.5;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cell = (text: string, o: Record<string, unknown> = {}): any => ({ text, options: { fontFace: font, fontSize: fs, color: "1D1D1F", valign: "middle" as const, align: (rtl ? "right" : "left") as "right" | "left", border: [{ type: "none" as const }, { type: "none" as const }, { type: "solid" as const, pt: 0.5, color: "E3E3E8" }, { type: "none" as const }], margin: [3, 5, 3, 5] as [number, number, number, number], ...o } });
          const data = [head.map((hd, i) => cell(hd.toUpperCase(), { bold: true, color: "6E6E73", fontSize: b.matrix && (rtl ? i < head.length - 1 : i > 0) ? 7 : 8.5, align: b.matrix && (rtl ? i < head.length - 1 : i > 0) ? "center" : rtl ? "right" : "left", border: [{ type: "none" }, { type: "none" }, { type: "solid", pt: 1, color: "C7C7CC" }, { type: "none" }] })),
            ...rows.map((r) => r.map((c, i) => { const isLabel = rtl ? i === r.length - 1 : i === 0; if (b.matrix && !isLabel) return cell(c, { align: "center", bold: true, color: c === "P" ? "FFFFFF" : brand, fill: c === "P" ? { color: brand } : c === "S" ? { color: "E8F0FB" } : undefined }); return cell(c, isLabel ? { bold: true } : {}); }))];
          sl.addTable(data, { x, y, w, colW, rowH: Math.min(0.42, Math.max(0.24, h / (b.rows.length + 1))) });
        } else {
          if (!b.values.some((v) => v > 0)) { sl.addText("—", { ...base, x, y, w, h: 0.4, fontSize: 12, color: "8E8E93" }); }
          else if (b.kind === "pie") sl.addChart(pptx.ChartType.doughnut, [{ name: heading || "Share", labels: b.labels, values: b.values }], { x, y, w, h: Math.min(h, 3.9), holeSize: 62, chartColors: COLORS.slice(0, b.values.length), showLegend: true, legendPos: rtl ? "l" : "r", legendFontFace: font, legendFontSize: 10, showPercent: b.unit === "pct", showValue: b.unit !== "pct", dataLabelColor: "FFFFFF", dataLabelFontSize: 9, dataBorder: { pt: 1, color: "FFFFFF" } });
          else sl.addChart(pptx.ChartType.bar, [{ name: heading || "Value", labels: b.labels, values: b.values }], { x, y, w, h: Math.min(h, 3.9), barDir: "bar", chartColors: [accent], catAxisLabelFontFace: font, catAxisLabelFontSize: 10, catAxisOrientation: "maxMin" as "minMax", valAxisHidden: true, valGridLine: { style: "none" }, showValue: true, dataLabelFontSize: 9, dataLabelFormatCode: b.unit === "pct" ? '0"%"' : "#,##0", barGapWidthPct: 60 });
        }
        y += h + 0.2;
      }
    }
    sl.addText(s.note ?? "", { ...base, x: MX, y: 6.92, w: W - 2 * MX - 3, h: 0.3, fontSize: 8.5, color: "8E8E93" });
    sl.addText(`${campaignName}  ·  ${idx + 1} / ${slides.length}`, { ...base, x: W - MX - 3, y: 6.92, w: 3, h: 0.3, fontSize: 8.5, color: "8E8E93", align: rtl ? "left" : "right" });
  });
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
