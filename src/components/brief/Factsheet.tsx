"use client";
import { useRef, useState } from "react";
import { AlertTriangle, FileText, Globe, Link2, Plus, Quote, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import type { Campaign, Message, MessagePriority, MessageType, SourceDoc } from "@/lib/types";
import { extractMessages, MESSAGE_TYPE_LABEL } from "@/lib/analysis";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, Empty, IconButton, Input, Modal, Note, SectionTitle, Segmented, Select, SourceBadge, Textarea, useUI, type Tone } from "@/components/ui";
import { cx, uid } from "@/lib/utils";

const PRIORITIES: { id: MessagePriority; label: string; tone: Tone }[] = [{ id: "mandatory", label: "Mandatory", tone: "bad" }, { id: "high", label: "High priority", tone: "warn" }, { id: "supporting", label: "Supporting", tone: "accent" }, { id: "optional", label: "Optional", tone: "neutral" }];

export function Factsheet({ c }: { c: Campaign }) {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus(); const update = useStore((s) => s.update);
  const [busy, setBusy] = useState<string | null>(null); const [paste, setPaste] = useState(""); const [url, setUrl] = useState(""); const [mode, setMode] = useState<"upload" | "paste" | "url">("upload");
  const [drag, setDrag] = useState(false); const [view, setView] = useState<{ doc: SourceDoc; quote?: string } | null>(null); const [filter, setFilter] = useState<"all" | MessagePriority>("all");
  const file = useRef<HTMLInputElement>(null);

  const analyse = async (doc: SourceDoc): Promise<{ messages: Message[]; engine: string }> => {
    if (status?.ai.configured) {
      try {
        const r = await api<{ messages: { text: string; type: MessageType; priority: MessagePriority; sourceQuote: string; segmentNames: string[]; verified: boolean }[] }>("/api/ai/analyze", { method: "POST", json: { doc: { id: doc.id, name: doc.name, text: doc.text }, segments: c.brief.segments.map((s) => s.name), campaign: `${c.brief.name}. ${c.brief.type}. ${c.brief.description}`.slice(0, 2800) } });
        return { engine: "AI", messages: r.messages.map((m) => ({ id: uid("m"), text: m.text, type: m.type, priority: m.priority, sourceId: doc.id, sourceQuote: m.sourceQuote, verified: m.verified, origin: "ai", segmentIds: c.brief.segments.filter((s) => m.segmentNames.includes(s.name)).map((s) => s.id) })) };
      } catch (e) { toast(`${(e as Error).message} ${t("Used built-in extraction instead.")}`, { tone: "warn" }); }
    }
    return { engine: "built-in", messages: extractMessages(doc, c.brief.segments) };
  };
  const addDoc = async (doc: SourceDoc) => {
    setBusy(t("Analysing “{name}”…", { name: doc.name }));
    const { messages, engine } = await analyse(doc);
    update(c.id, (d) => { d.sources.push(doc); const seen = new Set(d.messages.map((m) => m.text.toLowerCase())); d.messages.push(...messages.filter((m) => !seen.has(m.text.toLowerCase()))); });
    setBusy(null);
    toast(messages.length ? t("{n} messages extracted ({engine})", { n: messages.length, engine }) : t("Document added, but no messages could be extracted. Add them manually."), { tone: messages.length ? undefined : "warn" });
  };
  const onFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      setBusy(t("Reading “{name}”…", { name: f.name }));
      try { const fd = new FormData(); fd.append("file", f); const r = await api<{ name: string; text: string }>("/api/documents/parse", { method: "POST", body: fd }); await addDoc({ id: uid("src"), name: r.name, kind: "file", text: r.text, addedAt: new Date().toISOString() }); }
      catch (e) { toast((e as Error).message, { tone: "bad" }); }
    }
    setBusy(null);
  };
  const setMsg = (id: string, fn: (m: Message) => void) => update(c.id, (d) => { const m = d.messages.find((x) => x.id === id); if (m) fn(m); }, `msg-${id}`);
  const shown = c.messages.filter((m) => filter === "all" || m.priority === filter);
  const unverified = c.messages.filter((m) => m.origin !== "manual" && m.verified === false).length;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle title={t("Factsheet and media messages")} hint={t("Upload or paste factsheets, press releases, agendas, brand guidelines or a web page. Key messages are extracted with a reference to their source.")} action={<Segmented size="sm" value={mode} onChange={setMode} options={[{ id: "upload", label: t("Upload") }, { id: "paste", label: t("Paste text") }, { id: "url", label: t("Website URL") }]} />} />
        {mode === "upload" && (
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
            className={cx("flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition", drag ? "border-accent bg-accent-soft" : "border-line-strong")}>
            <Upload size={22} className="mb-2 text-ink-3" /><div className="text-[14px] font-medium">{t("Drop documents here")}</div>
            <p className="mb-3 text-[12.5px] text-ink-3">{t("PDF, Word (.docx), PowerPoint (.pptx) or text — up to 15 MB each")}</p>
            <Button onClick={() => file.current?.click()} loading={!!busy}>{t("Choose files")}</Button>
            <input ref={file} type="file" multiple hidden accept=".pdf,.docx,.pptx,.txt,.md" onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }} />
          </div>
        )}
        {mode === "paste" && <div className="space-y-2"><Textarea rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("Paste the factsheet, messaging document or press release here…")} /><div className="flex justify-end"><Button variant="primary" disabled={paste.trim().length < 40} loading={!!busy} icon={<Sparkles size={14} />} onClick={async () => { await addDoc({ id: uid("src"), name: `${t("Pasted text")} ${c.sources.filter((s) => s.kind === "text").length + 1}`, kind: "text", text: paste.trim(), addedAt: new Date().toISOString() }); setPaste(""); }}>{t("Analyse text")}</Button></div></div>}
        {mode === "url" && <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setBusy(t("Fetching page…")); try { const r = await api<{ name: string; text: string }>("/api/documents/parse", { method: "POST", json: { url } }); await addDoc({ id: uid("src"), name: `${r.name} (${new URL(url).hostname})`, kind: "url", text: r.text, addedAt: new Date().toISOString() }); setUrl(""); } catch (er) { toast((er as Error).message, { tone: "bad" }); } setBusy(null); }}>
          <div className="relative flex-1"><Link2 size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="!ps-8" /></div><Button variant="primary" type="submit" loading={!!busy}>{t("Fetch and analyse")}</Button></form>}
        {busy && <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-2"><span className="skeleton h-2 w-24" />{busy}</div>}
        {!!c.sources.length && <ul className="mt-4 flex flex-wrap gap-2">{c.sources.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-full border bg-surface py-1 pe-1 ps-3 text-[12.5px]">{s.kind === "url" ? <Globe size={13} className="text-ink-3" /> : <FileText size={13} className="text-ink-3" />}<button className="max-w-[220px] truncate hover:underline" onClick={() => setView({ doc: s })}>{s.name}</button><span className="text-ink-3">{c.messages.filter((m) => m.sourceId === s.id).length}</span>
            <IconButton label={t("Remove")} className="!h-6 !w-6" onClick={async () => { if (await confirm({ title: t("Remove this source?"), text: t("Messages extracted from it will also be removed. Manually added messages are kept."), confirmLabel: t("Remove"), danger: true })) update(c.id, (d) => { d.sources = d.sources.filter((x) => x.id !== s.id); const gone = d.messages.filter((m) => m.sourceId === s.id).map((m) => m.id); d.messages = d.messages.filter((m) => m.sourceId !== s.id); d.assignments.forEach((a) => gone.forEach((g) => delete a.messages[g])); }); }}><Trash2 size={12} /></IconButton></li>))}</ul>}
        <Note className="mt-4" icon={<ShieldCheck size={14} />}>{status?.ai.configured ? t("AI analysis is on. Every extracted item carries a verbatim source quote that is checked against the document; anything that cannot be found is flagged.") : t("Built-in extraction is on: messages are verbatim sentences from your documents, classified by rules — nothing is invented. Add an Anthropic API key for deeper AI analysis.")} {t("Documents are treated as data only; instructions inside them are never followed.")}</Note>
      </Card>

      <div>
        <SectionTitle title={<>{t("Messaging library")} <span className="num text-ink-3">{c.messages.length}</span></>} hint={t("Edit, reprioritise and reclassify. This library drives content assignment and the coverage matrix.")}
          action={<><Segmented size="sm" value={filter} onChange={setFilter} options={[{ id: "all", label: t("All") }, ...PRIORITIES.map((p) => ({ id: p.id, label: t(p.label) }))]} /><Button size="sm" icon={<Plus size={14} />} onClick={() => update(c.id, (d) => { d.messages.unshift({ id: uid("m"), text: "", type: "supporting", priority: "supporting", origin: "manual" }); })}>{t("Add message")}</Button></>} />
        {unverified > 0 && <Note tone="warn" className="mb-3" icon={<AlertTriangle size={14} />}>{t("{n} AI-extracted item(s) could not be matched word-for-word to a source. Check them before use.", { n: unverified })}</Note>}
        {!c.messages.length ? <Empty icon={<Quote size={20} />} title={t("No messages yet")} text={t("Add a factsheet above, or add messages manually. You can continue without one and return later.")} /> : (
          <Card className="divide-y">
            {shown.map((m) => { const src = c.sources.find((s) => s.id === m.sourceId); const pr = PRIORITIES.find((p) => p.id === m.priority)!; return (
              <div key={m.id} className="grid gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[1fr_170px_150px_32px] md:items-start">
                <div className="min-w-0">
                  <Textarea rows={1} value={m.text} placeholder={t("Write the message…")} onChange={(e) => setMsg(m.id, (x) => { x.text = e.target.value; if (x.origin !== "manual" && x.sourceQuote && e.target.value !== x.sourceQuote) x.verified = x.verified && true; })} className="inline-edit !border-transparent !shadow-none" />
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
                    {m.origin === "manual" ? <SourceBadge source="manual" /> : m.origin === "ai" ? <SourceBadge source="ai" /> : <Badge>{t("Extracted")}</Badge>}
                    {src && <button className="flex items-center gap-1 hover:text-accent hover:underline" onClick={() => setView({ doc: src, quote: m.sourceQuote })}><Quote size={11} />{src.name}</button>}
                    {m.origin !== "manual" && m.verified === false && <Badge tone="warn"><AlertTriangle size={11} />{t("Quote not found in source")}</Badge>}
                    {m.origin !== "manual" && m.sourceQuote && m.text !== m.sourceQuote && m.verified !== false && <Badge title={m.sourceQuote}>{t("Edited from source")}</Badge>}
                  </div>
                </div>
                <Select aria-label={t("Type")} value={m.type} onChange={(e) => setMsg(m.id, (x) => { x.type = e.target.value as MessageType; })}>{Object.entries(MESSAGE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select>
                <Select aria-label={t("Priority")} value={m.priority} onChange={(e) => setMsg(m.id, (x) => { x.priority = e.target.value as MessagePriority; })} className={cx(pr.tone === "bad" && "[&_select]:text-bad", pr.tone === "warn" && "[&_select]:text-warn")}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{t(p.label)}</option>)}</Select>
                <IconButton label={t("Delete")} onClick={() => update(c.id, (d) => { d.messages = d.messages.filter((x) => x.id !== m.id); d.assignments.forEach((a) => delete a.messages[m.id]); })}><Trash2 size={14} /></IconButton>
              </div>); })}
          </Card>
        )}
      </div>
      <Modal wide open={!!view} onClose={() => setView(null)} title={view?.doc.name ?? ""}>
        {view && <SourceView text={view.doc.text} quote={view.quote} />}
      </Modal>
    </div>
  );
}

function SourceView({ text, quote }: { text: string; quote?: string }) {
  const t = useT();
  const i = quote ? text.indexOf(quote) : -1;
  return (
    <div>
      {quote && i < 0 && <Note tone="warn" className="mb-3">{t("The exact quote was not found verbatim in this source.")} “{quote}”</Note>}
      <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-ink-2">{i >= 0 ? <>{text.slice(Math.max(0, i - 1500), i)}<mark ref={(el) => { el?.scrollIntoView({ block: "center" }); }} className="rounded bg-warn-soft px-0.5 text-ink">{quote}</mark>{text.slice(i + quote!.length, i + quote!.length + 3000)}</> : text.slice(0, 12000)}</pre>
    </div>
  );
}
