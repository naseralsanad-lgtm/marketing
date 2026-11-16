"use client";
import { useRef, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import type { Influencer, Platform } from "@/lib/types";
import type { Model } from "@/lib/model";
import { CATEGORIES, COUNTRIES, LANGUAGE_CODES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import { buildActions, CSV_TEMPLATE, influencersFromCSV, manualInfluencer, parseProfileUrl } from "@/lib/actions";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Button, ChipGroup, Field, Input, Modal, Note, NumberInput, Select, TagInput, useUI } from "@/components/ui";
import { download } from "@/lib/utils";

export function ModashSearch({ open, onClose, model }: { open: boolean; onClose: () => void; model: Model }) {
  const t = useT(); const { toast } = useUI(); const status = useStatus(); const upsert = useStore((s) => s.upsertInfluencers);
  const b = model.campaign.brief; const act = buildActions(model.campaign.id);
  const modashPlatforms = PLATFORMS.filter((p) => p.modash);
  const [f, setF] = useState(() => ({ platform: (b.platforms.find((p) => modashPlatforms.some((m) => m.id === p)) ?? "instagram") as Platform, keywords: b.prefs.categories.slice(0, 2).join(" "), minFollowers: b.prefs.minFollowers || 10000, maxFollowers: 0, minEngagement: b.prefs.minEngagement || 0, audienceCountry: b.segments[0]?.countries[0] ?? "United Arab Emirates", language: b.prefs.languages[0] ?? "" }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ influencers: Influencer[]; total?: number }>("/api/modash/search", { method: "POST", json: { platform: f.platform, keywords: f.keywords || undefined, minFollowers: f.minFollowers || undefined, maxFollowers: f.maxFollowers || undefined, minEngagement: f.minEngagement ? f.minEngagement / 100 : undefined, audienceCountries: f.audienceCountry ? [f.audienceCountry] : undefined, languageCode: f.language ? LANGUAGE_CODES[f.language] : undefined } });
      upsert(r.influencers); act.addCandidates(r.influencers.map((i) => i.id));
      toast(t("{n} creators added to the discovery pool from Modash", { n: r.influencers.length })); onClose();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={t("Search Modash")} footer={<><Button onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" loading={busy} disabled={!status?.modash.configured} icon={<Search size={14} />} onClick={run}>{t("Search")}</Button></>}>
      {!status?.modash.configured && <Note tone="warn" className="mb-4">{t("Modash is not connected. Add MODASH_API_KEY on the server (see Settings → Integrations). Until then, use the demonstration pool, add creators manually or import a CSV.")}</Note>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Platform")} hint={t("Modash Discovery covers Instagram, TikTok and YouTube.")}><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as Platform })}>{modashPlatforms.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
        <Field label={t("Keywords")}><Input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="technology dubai" /></Field>
        <Field label={t("Minimum follower count")}><NumberInput value={f.minFollowers} onChange={(n) => setF({ ...f, minFollowers: n })} /></Field>
        <Field label={t("Maximum follower count")}><NumberInput value={f.maxFollowers} placeholder={t("No maximum")} onChange={(n) => setF({ ...f, maxFollowers: n })} /></Field>
        <Field label={t("Minimum engagement rate (%)")}><NumberInput value={f.minEngagement} placeholder={t("No minimum")} onChange={(n) => setF({ ...f, minEngagement: n })} /></Field>
        <Field label={t("Audience country")}><Select value={f.audienceCountry} onChange={(e) => setF({ ...f, audienceCountry: e.target.value })}><option value="">{t("Any")}</option>{Object.keys(COUNTRIES).filter((c) => c !== "Other").map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label={t("Content language")}><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="">{t("Any")}</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</Select></Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{t("Search returns profile basics. Open a creator and choose “Refresh via Modash” to load full audience analytics (uses Modash credits). Results are cached on the server.")}</p>
      {err && <Note tone="bad" className="mt-3">{err}</Note>}
    </Modal>
  );
}

export function AddManual({ open, onClose, model }: { open: boolean; onClose: () => void; model: Model }) {
  const t = useT(); const { toast } = useUI(); const status = useStatus(); const upsert = useStore((s) => s.upsertInfluencers); const act = buildActions(model.campaign.id);
  const empty = { url: "", name: "", handle: "", platform: "instagram" as Platform, followers: 0, er: 0, views: 0, country: "United Arab Emirates", city: "", languages: [] as string[], categories: [] as string[], fee: 0 };
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false);
  const onUrl = (url: string) => { const p = parseProfileUrl(url); setF((x) => ({ ...x, url, platform: p.platform ?? x.platform, handle: p.handle || x.handle, name: x.name || p.handle || "" })); };
  const canFetch = status?.modash.configured && ["instagram", "tiktok", "youtube"].includes(f.platform) && !!f.handle;
  const save = (select: boolean, base?: Influencer) => {
    const inf = base ?? manualInfluencer({ name: f.name || f.handle, handle: f.handle.replace(/^@/, ""), platform: f.platform, profileUrl: f.url || undefined, followers: f.followers, engagementRate: f.er ? f.er / 100 : undefined, avgViews: f.views || undefined, country: f.country || undefined, city: f.city || undefined, languages: f.languages, categories: f.categories, feeHistory: f.fee ? [{ date: new Date().toISOString().slice(0, 10), amount: f.fee, currency: model.budget.currency, status: "quoted" }] : [] });
    upsert([inf]); if (select) act.select(inf.id, true); else act.addCandidates([inf.id]);
    toast(t(select ? "{name} added to the campaign" : "{name} added to the discovery pool", { name: inf.name })); setF(empty); onClose();
  };
  const fetchModash = async () => { setBusy(true); try { const r = await api<{ influencer: Influencer }>(`/api/modash/report?platform=${f.platform}&id=${encodeURIComponent(f.handle)}`); save(true, r.influencer); } catch (e) { toast((e as Error).message, { tone: "bad" }); } setBusy(false); };
  return (
    <Modal wide open={open} onClose={onClose} title={t("Add an influencer")} footer={<><Button onClick={onClose}>{t("Cancel")}</Button><Button disabled={!f.handle} onClick={() => save(false)}>{t("Add to pool")}</Button><Button variant="primary" disabled={!f.handle} onClick={() => save(true)}>{t("Add to campaign")}</Button></>}>
      <Field label={t("Social media profile URL")} hint={t("Paste a profile link to fill in the platform and handle automatically.")}><div className="flex gap-2"><Input value={f.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://www.instagram.com/handle" />{canFetch && <Button loading={busy} onClick={fetchModash}>{t("Fetch from Modash")}</Button>}</div></Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={t("Name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t("Handle")} required><Input value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} placeholder="handle" /></Field>
        <Field label={t("Platform")}><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as Platform })}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
        <Field label={t("Followers")}><NumberInput value={f.followers} onChange={(n) => setF({ ...f, followers: n })} /></Field>
        <Field label={t("Engagement rate (%)")}><NumberInput value={f.er} placeholder={t("Unknown")} onChange={(n) => setF({ ...f, er: n })} /></Field>
        <Field label={t("Average views")}><NumberInput value={f.views} placeholder={t("Unknown")} onChange={(n) => setF({ ...f, views: n })} /></Field>
        <Field label={t("Country")}><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
        <Field label={t("City")}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label={`${t("Quoted fee")} (${model.budget.currency})`}><NumberInput value={f.fee} placeholder={t("Estimate for me")} onChange={(n) => setF({ ...f, fee: n })} /></Field>
        <Field label={t("Languages")} className="sm:col-span-3"><ChipGroup options={LANGUAGES.slice(0, 7)} value={f.languages} onChange={(v) => setF({ ...f, languages: v })} /></Field>
        <Field label={t("Content categories")} className="sm:col-span-3"><TagInput value={f.categories} onChange={(v) => setF({ ...f, categories: v })} placeholder={CATEGORIES.slice(0, 3).join(", ")} /></Field>
      </div>
      <Note className="mt-4">{t("Manually entered creators are labelled “Manual”. Without audience analytics, their match score uses neutral values for the missing criteria and says so.")}</Note>
    </Modal>
  );
}

export function CsvImport({ open, onClose, model }: { open: boolean; onClose: () => void; model: Model }) {
  const t = useT(); const { toast } = useUI(); const upsert = useStore((s) => s.upsertInfluencers); const act = buildActions(model.campaign.id);
  const ref = useRef<HTMLInputElement>(null); const [res, setRes] = useState<{ list: Influencer[]; errors: string[] } | null>(null);
  const done = () => { if (!res) return; upsert(res.list); act.addCandidates(res.list.map((i) => i.id)); toast(t("{n} creators imported", { n: res.list.length })); setRes(null); onClose(); };
  return (
    <Modal open={open} onClose={() => { setRes(null); onClose(); }} title={t("Import influencers from CSV")} footer={<><Button onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" disabled={!res?.list.length} onClick={done}>{t("Import")} {res?.list.length || ""}</Button></>}>
      <p className="text-[13px] text-ink-2">{t("Columns: name, handle, platform, followers, engagement_rate, avg_views, country, city, languages, categories, fee, email, profile_url. Only handle and platform are required; separate multiple languages or categories with “;”.")}</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button icon={<Upload size={14} />} onClick={() => ref.current?.click()}>{t("Choose CSV file")}</Button><Button variant="ghost" icon={<Download size={14} />} onClick={() => download("influencer-import-template.csv", CSV_TEMPLATE, "text/csv")}>{t("Download template")}</Button></div>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { toast(t("CSV is larger than 2 MB."), { tone: "bad" }); return; } setRes(influencersFromCSV(await f.text())); e.target.value = ""; }} />
      {res && <div className="mt-4 space-y-2"><Note tone={res.list.length ? "good" : "warn"}>{t("{n} valid row(s) ready to import.", { n: res.list.length })}</Note>{res.errors.slice(0, 5).map((e) => <Note key={e} tone="warn">{e}</Note>)}{res.errors.length > 5 && <p className="text-[12px] text-ink-3">+{res.errors.length - 5} {t("more")}</p>}
        {!!res.list.length && <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-[12.5px]">{res.list.slice(0, 30).map((i) => <li key={i.id} className="flex justify-between gap-3 px-3 py-1.5"><span className="truncate">{i.name} <span className="text-ink-3">@{i.handle}</span></span><span className="shrink-0 text-ink-3">{i.platform} · {i.followers.toLocaleString()}</span></li>)}</ul>}</div>}
    </Modal>
  );
}
