"use client";
import type { DeckConfig } from "@/lib/types";
import type { Block, Slide } from "@/lib/deck/build";
import { compact, cx } from "@/lib/utils";

export const DECK_COLORS = ["#0a84ff", "#30b0c7", "#34c759", "#ff9f0a", "#bf5af2", "#ff375f", "#8e8e93", "#ac8e68"];
const hasArabic = (s: string) => /[\u0600-\u06ff]/.test(s);

function BlockView({ b, deck }: { b: Block; deck: DeckConfig }) {
  const heading = "heading" in b && b.heading ? <div className="s-label" style={{ marginBottom: "0.7cqw", color: deck.brandColor }}>{b.heading}</div> : null;
  if (b.t === "kpis") return <div style={{ display: "grid", gridTemplateColumns: `repeat(${b.items.length > 4 ? 2 : Math.min(b.items.length, 4) > 2 && b.items.length <= 4 ? b.items.length : 2}, 1fr)`, gap: "1.6cqw 2cqw" }}>{b.items.map((k) => <div key={k.label}><div className="s-kpi num" style={{ color: deck.brandColor }}>{k.value}</div><div className="s-label" style={{ marginTop: "0.5cqw" }}>{k.label}</div></div>)}</div>;
  if (b.t === "bullets") return <div>{heading}<ul>{b.items.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul></div>;
  if (b.t === "text") return <div>{heading}<p style={{ whiteSpace: "pre-wrap", fontSize: b.text.length > 700 ? "1.12cqw" : b.text.length > 400 ? "1.25cqw" : "1.4cqw" }}>{b.text.length > 1300 ? b.text.slice(0, 1300) + "…" : b.text}</p></div>;
  if (b.t === "table") { const total = (b.widths ?? b.head.map(() => 1)).reduce((x, y) => x + y, 0); return (
    <div>{heading}<table style={{ tableLayout: "fixed" }}><colgroup>{b.head.map((_, i) => <col key={i} style={{ width: `${(((b.widths?.[i] ?? 1) / total) * 100).toFixed(2)}%` }} />)}</colgroup>
      <thead><tr>{b.head.map((h, i) => <th key={i} style={b.matrix && i > 0 ? { textAlign: "center", padding: "0.4cqw 0.1cqw", fontSize: "0.8cqw", overflow: "hidden", textOverflow: "ellipsis" } : undefined}>{h}</th>)}</tr></thead>
      <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => b.matrix && ci > 0 ? <td key={ci} style={{ textAlign: "center", padding: "0.3cqw" }}>{cell && <span style={{ display: "inline-flex", width: "1.7cqw", height: "1.7cqw", alignItems: "center", justifyContent: "center", borderRadius: "0.4cqw", fontWeight: 700, fontSize: "0.9cqw", background: cell === "P" ? deck.brandColor : `color-mix(in srgb, ${deck.brandColor} 16%, #fff)`, color: cell === "P" ? "#fff" : deck.brandColor }}>{cell}</span>}</td> : <td key={ci} style={ci === 0 ? { fontWeight: 550 } : undefined}>{cell}</td>)}</tr>)}</tbody></table></div>); }
  const max = Math.max(...b.values, 0.0001), sum = b.values.reduce((x, y) => x + y, 0) || 1;
  const fmt = (v: number) => (b.unit === "pct" ? `${Math.round(b.kind === "pie" ? (v / sum) * 100 : v)}%` : compact(v));
  if (b.kind === "bar") return <div>{heading}<div style={{ display: "grid", gap: "0.65cqw" }}>{b.labels.map((l, i) => <div key={l + i} style={{ display: "grid", gridTemplateColumns: "32% 1fr 12%", alignItems: "center", gap: "1cqw", fontSize: "1.05cqw" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span><span style={{ height: "1.1cqw", background: "#f0f0f3", borderRadius: "0.6cqw", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(b.values[i] / max) * 100}%`, background: deck.accentColor, borderRadius: "0.6cqw" }} /></span><span className="num" style={{ fontWeight: 600, textAlign: "end" }}>{fmt(b.values[i])}</span></div>)}</div></div>;
  const R = 42, C = 2 * Math.PI * R; const starts = b.values.map((_, i) => b.values.slice(0, i).reduce((x, y) => x + y, 0) / sum);
  return <div>{heading}<div style={{ display: "flex", alignItems: "center", gap: "2.4cqw" }}><svg viewBox="0 0 100 100" style={{ width: "15cqw", height: "15cqw", transform: "rotate(-90deg)", flexShrink: 0 }}>{b.values.map((v, i) => <circle key={i} cx="50" cy="50" r={R} fill="none" strokeWidth="14" stroke={DECK_COLORS[i % DECK_COLORS.length]} strokeDasharray={`${(v / sum) * C} ${C}`} strokeDashoffset={-starts[i] * C} />)}</svg>
    <div style={{ display: "grid", gap: "0.55cqw", fontSize: "1.08cqw", minWidth: 0, flex: 1 }}>{b.labels.map((l, i) => <div key={l + i} style={{ display: "flex", alignItems: "center", gap: "0.7cqw" }}><span style={{ width: "0.9cqw", height: "0.9cqw", borderRadius: "0.22cqw", background: DECK_COLORS[i % DECK_COLORS.length], flexShrink: 0 }} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span><span className="num" style={{ fontWeight: 600 }}>{fmt(b.values[i])}</span></div>)}</div></div></div>;
}

export function SlideView({ slide, deck, page, total, campaign, className }: { slide: Slide; deck: DeckConfig; page?: number; total?: number; campaign?: string; className?: string }) {
  const rtl = deck.language === "ar";
  const style = { "--deck-accent": deck.accentColor, ...(deck.fontName ? { "--deck-font": `"${deck.fontName}", var(--font-sans)` } : {}) } as React.CSSProperties;
  if (slide.kind === "cover") return (
    <div className={cx("slide", className)} dir={rtl || hasArabic(slide.title) ? "rtl" : "ltr"} style={{ ...style, background: deck.brandColor, color: "#fff" }}>
      <div className="slide-inner" style={{ justifyContent: "space-between", padding: "6cqw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>{deck.logoDataUrl ? <img src={deck.logoDataUrl} alt="" style={{ maxHeight: "6cqw", maxWidth: "22cqw", objectFit: "contain", background: "#fff", borderRadius: "0.8cqw", padding: "0.8cqw" }} /> /* eslint-disable-line @next/next/no-img-element */ : <span />}<span style={{ fontSize: "1.1cqw", opacity: 0.75, letterSpacing: ".08em", textTransform: "uppercase" }}>{slide.subtitle}</span></div>
        <div><div style={{ width: "6cqw", height: "0.5cqw", background: deck.accentColor, borderRadius: "1cqw", marginBottom: "2.2cqw" }} /><h2 style={{ fontSize: slide.title.length > 44 ? "4.2cqw" : "5.4cqw", lineHeight: 1.05, maxWidth: "76cqw" }}>{slide.title}</h2><div style={{ marginTop: "2cqw", fontSize: "1.5cqw", opacity: 0.85 }}>{slide.meta?.join("   ·   ")}</div></div>
      </div>
    </div>);
  return (
    <div className={cx("slide", className)} dir={rtl ? "rtl" : "ltr"} style={style}>
      <div className="slide-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2cqw", marginBottom: "2.2cqw" }}>
          <div style={{ minWidth: 0 }}><div style={{ width: "3.2cqw", height: "0.36cqw", background: deck.accentColor, borderRadius: "1cqw", marginBottom: "1cqw" }} /><h2 style={{ color: deck.brandColor }}>{slide.title}</h2>{slide.subtitle && <div className="s-sub">{slide.subtitle}</div>}</div>
          {deck.logoDataUrl && <img src={deck.logoDataUrl} alt="" style={{ maxHeight: "3.6cqw", maxWidth: "14cqw", objectFit: "contain" }} /> /* eslint-disable-line @next/next/no-img-element */}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: slide.right?.length ? "1.15fr 1fr" : "1fr", gap: "3.4cqw", overflow: "hidden" }}>
          <div style={{ display: "grid", gap: "1.8cqw", alignContent: "start", minWidth: 0 }}>{slide.left.map((b, i) => <BlockView key={i} b={b} deck={deck} />)}</div>
          {!!slide.right?.length && <div style={{ display: "grid", gap: "1.8cqw", alignContent: "start", minWidth: 0 }}>{slide.right.map((b, i) => <BlockView key={i} b={b} deck={deck} />)}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", marginTop: "1.2cqw", fontSize: "0.92cqw", color: "#8e8e93" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.note ?? ""}</span><span style={{ flexShrink: 0 }}>{campaign}{page ? `  ·  ${page}${total ? ` / ${total}` : ""}` : ""}</span></div>
      </div>
    </div>);
}

export function DeckFont({ deck }: { deck: DeckConfig }) {
  if (!deck.fontName || !deck.fontDataUrl) return null;
  return <style>{`@font-face{font-family:"${deck.fontName.replace(/["\\]/g, "")}";src:url(${deck.fontDataUrl});font-display:swap;}`}</style>;
}
