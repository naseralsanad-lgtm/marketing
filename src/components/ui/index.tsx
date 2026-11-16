"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Info, Loader2, X } from "lucide-react";
import { createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import type { DataSource } from "@/lib/types";
import { useT } from "@/lib/i18n";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "soft"; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode };
export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...p }: BtnProps) {
  return (
    <button {...p} disabled={disabled || loading} className={cx(
      "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none select-none",
      size === "sm" ? "h-7 px-3 text-[12.5px]" : size === "lg" ? "h-11 px-6 text-[15px]" : "h-9 px-4 text-[13.5px]",
      variant === "primary" && "bg-accent text-white hover:brightness-110 shadow-sm",
      variant === "secondary" && "bg-surface border border-line-strong hover:bg-surface-2",
      variant === "soft" && "bg-accent-soft text-accent hover:brightness-95",
      variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
      variant === "danger" && "bg-bad-soft text-bad hover:brightness-95", className)}>
      {loading ? <Loader2 size={14} className="spin" /> : icon}{children}
    </button>
  );
}
export function IconButton({ label, className, children, active, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return <button {...p} aria-label={label} title={label} className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 disabled:pointer-events-none", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink", className)}>{children}</button>;
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx("rounded-2xl border bg-surface shadow-card", className)}>{children}</div>;
}
export function SectionTitle({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div><h3 className="text-[17px] font-semibold">{title}</h3>{hint && <p className="mt-0.5 text-[13px] text-ink-2">{hint}</p>}</div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, error, required, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | false; required?: boolean; children: ReactNode; className?: string }) {
  // A <label> may only wrap a single form control. Groups (chips, segmented controls, tag inputs…) get a labelled group instead,
  // otherwise the first button would inherit the label as its accessible name and receive stray clicks.
  const single = isValidElement(children) && SINGLE_CONTROLS.has(children.type as never);
  const head = <span className="mb-1.5 flex items-center gap-1 text-[12.5px] font-medium text-ink-2">{label}{required && <span className="text-bad">*</span>}</span>;
  const foot = error ? <span className="mt-1 block text-[12px] text-bad">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-ink-3">{hint}</span> : null;
  if (single) return <label className={cx("block", className)}>{head}{children}{foot}</label>;
  return <div role="group" aria-label={typeof label === "string" ? label : undefined} className={cx("block", className)}>{head}{children}{foot}</div>;
}
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx("field", className)} />;
export function NumberInput({ value, onChange, className, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null | undefined; onChange: (n: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  const shown = raw ?? (value == null || value === 0 ? (p.placeholder ? "" : "0") : value.toLocaleString("en-US"));
  return <input {...p} inputMode="decimal" value={shown} onFocus={() => setRaw(value ? String(value) : "")} onBlur={() => setRaw(null)}
    onChange={(e) => { const s = e.target.value.replace(/[^\d.]/g, ""); setRaw(s); onChange(Number(s) || 0); }} className={cx("field num", className)} />;
}
export function Textarea({ className, autoGrow = true, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (!el || !autoGrow) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight + 2, 480) + "px"; }, [p.value, autoGrow]);
  return <textarea ref={ref} rows={3} {...p} className={cx("field resize-none", className)} />;
}
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("relative block", className)}>
      <select {...p} className="field appearance-none pe-8">{children}</select>
      <ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </span>
  );
}

const SINGLE_CONTROLS = new Set<unknown>([Input, NumberInput, Textarea, Select]);

export function Chip({ active, onClick, children, className, title }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string; title?: string }) {
  return <button type="button" title={title} aria-pressed={active} onClick={onClick} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-all active:scale-[.97]", active ? "border-accent bg-accent-soft text-accent font-medium" : "border-line-strong bg-surface text-ink hover:bg-surface-2", className)}>{active && <Check size={13} />}{children}</button>;
}
export function ChipGroup<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labels?: (o: T) => ReactNode }) {
  return <div className="flex flex-wrap gap-2">{options.map((o) => <Chip key={o} active={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>{labels ? labels(o) : o}</Chip>)}</div>;
}
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.split(",").map((x) => x.trim()).filter((x) => x && !value.includes(x)); if (v.length) onChange([...value, ...v]); setT(""); };
  return (
    <div className="field flex flex-wrap items-center gap-1.5 !py-1.5">
      {value.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 ps-2.5 pe-1 text-[12.5px]">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 text-ink-3 hover:text-ink"><X size={12} /></button></span>)}
      <input value={t} onChange={(e) => setT(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !t && value.length) onChange(value.slice(0, -1)); }} placeholder={value.length ? "" : placeholder} className="min-w-[120px] flex-1 bg-transparent py-0.5 outline-none placeholder:text-ink-3" />
    </div>
  );
}
export function Segmented<T extends string>({ options, value, onChange, size = "md", className }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string }) {
  return (
    <div role="tablist" className={cx("inline-flex max-w-full overflow-x-auto rounded-[10px] bg-surface-2 p-0.5", className)}>
      {options.map((o) => <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={cx("whitespace-nowrap rounded-lg font-medium transition-all", size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13px]", value === o.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>{o.label}</button>)}
    </div>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors", checked ? "bg-good" : "bg-line-strong")}>
        <span className={cx("absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all", checked ? "start-[20px]" : "start-[2px]")} />
      </button>
      {label && <span className="text-[13.5px]">{label}</span>}
    </label>
  );
}

const TONES = { neutral: "bg-surface-2 text-ink-2", accent: "bg-accent-soft text-accent", good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" };
export type Tone = keyof typeof TONES;
export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium", TONES[tone], className)}>{children}</span>;
}
/** Makes the provenance of every figure explicit. */
export function SourceBadge({ source, className }: { source: DataSource | "estimated" | "ai" | "quoted" | "confirmed"; className?: string }) {
  const t = useT();
  const map: Record<string, [string, Tone, string]> = {
    demo: ["Demo data", "warn", "Illustrative sample data — not verified analytics"], modash: ["Modash", "good", "Retrieved from the Modash API"], manual: ["Manual", "neutral", "Entered manually"], csv: ["CSV import", "neutral", "Imported from a CSV file"],
    estimated: ["Estimated", "neutral", "Calculated estimate — not a guaranteed outcome"], ai: ["AI-generated", "accent", "Generated by AI — review before use"], quoted: ["Quoted", "accent", "Fee quoted by the creator or agency"], confirmed: ["Confirmed", "good", "Fee confirmed"],
  };
  const [label, tone, title] = map[source];
  return <Badge tone={tone} title={t(title)} className={className}>{t(label)}</Badge>;
}

export function Stat({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn"; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="truncate text-[12px] font-medium text-ink-2">{label}</div>
      <div className={cx("num mt-1 truncate text-[26px] font-semibold leading-none", tone === "bad" && "text-bad", tone === "good" && "text-good", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}
export function Progress({ value, tone }: { value: number; tone?: "good" | "bad" | "warn" | "accent" }) {
  const c = tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : tone === "good" ? "bg-good" : "bg-accent";
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className={cx("h-full rounded-full transition-all duration-500", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">{icon}</div>}
      <div className="text-[15px] font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-md text-[13px] text-ink-2">{text}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
export function Note({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return <div className={cx("flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed", TONES[tone], className)}><span className="mt-0.5 shrink-0">{icon ?? <Info size={14} />}</span><div className="min-w-0 flex-1">{children}</div></div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] fade-up" />
        <Dialog.Content aria-describedby={undefined} className={cx("fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border bg-surface shadow-pop", wide ? "max-w-3xl" : "max-w-lg")}>
          <div className="flex items-center justify-between gap-4 border-b px-5 py-3.5"><Dialog.Title className="text-[16px] font-semibold">{title}</Dialog.Title><Dialog.Close asChild><IconButton label="Close"><X size={16} /></IconButton></Dialog.Close></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Sheet({ open, onClose, title, children, width = 520, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 fade-up" />
        <Dialog.Content aria-describedby={undefined} style={{ maxWidth: width }} className="fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s bg-surface shadow-pop fade-up">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-3.5"><Dialog.Title className="min-w-0 truncate text-[16px] font-semibold">{title}</Dialog.Title><Dialog.Close asChild><IconButton label="Close"><X size={16} /></IconButton></Dialog.Close></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- toasts + confirm -----------------------------------------------------------
type Toast = { id: number; text: string; tone?: Tone; action?: { label: string; run: () => void } };
type ConfirmOpts = { title: string; text?: string; confirmLabel?: string; danger?: boolean };
const Ctx = createContext<{ toast: (text: string, o?: Omit<Toast, "id" | "text">) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }>({ toast: () => {}, confirm: async () => false });
export const useUI = () => useContext(Ctx);
export function UIProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const toast = useCallback((text: string, o?: Omit<Toast, "id" | "text">) => { const id = Date.now() + Math.random(); setToasts((x) => [...x.slice(-3), { id, text, ...o }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), o?.action ? 7000 : 3800); }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConf({ ...o, resolve })), []);
  const done = (v: boolean) => { conf?.resolve(v); setConf(null); };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className="fade-up pointer-events-auto flex max-w-md items-center gap-3 rounded-full border bg-surface px-4 py-2.5 text-[13px] shadow-pop">
            <span className={cx("h-2 w-2 shrink-0 rounded-full", x.tone === "bad" ? "bg-bad" : x.tone === "warn" ? "bg-warn" : "bg-good")} />{x.text}
            {x.action && <button className="font-semibold text-accent" onClick={() => { x.action!.run(); setToasts((y) => y.filter((z) => z.id !== x.id)); }}>{x.action.label}</button>}
          </div>
        ))}
      </div>
      <Modal open={!!conf} onClose={() => done(false)} title={conf?.title ?? ""} footer={<><Button onClick={() => done(false)}>{t("Cancel")}</Button><Button variant={conf?.danger ? "danger" : "primary"} onClick={() => done(true)}>{conf?.confirmLabel ?? t("Confirm")}</Button></>}>
        <p className="text-[13.5px] text-ink-2">{conf?.text}</p>
      </Modal>
    </Ctx.Provider>
  );
}

const AV = ["#0a84ff", "#30b0c7", "#34c759", "#ff9f0a", "#ff375f", "#bf5af2", "#5e5ce6", "#ac8e68"];
export function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  const c = AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
  if (src && !err) return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setErr(true)} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />; // eslint-disable-line @next/next/no-img-element
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 60%, #000))` }}>{initials}</span>;
}
export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = size / 2 - 3.5, c = 2 * Math.PI * r;
  const col = score >= 75 ? "var(--good)" : score >= 55 ? "var(--accent)" : score >= 40 ? "var(--warn)" : "var(--bad)";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Campaign Match Score ${score}/100`}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={3.5} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .5s" }} /></svg>
      <span className="num absolute font-semibold" style={{ fontSize: size * 0.32 }}>{score}</span>
    </span>
  );
}
