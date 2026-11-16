"use client";
import { useRef } from "react";
import { CheckCircle2, CircleDashed, Download, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { Page } from "@/components/Shell";
import { Badge, Button, Card, Field, Input, SectionTitle, Segmented, Select, useUI } from "@/components/ui";
import { download } from "@/lib/utils";

function Row({ ok, name, children }: { ok?: boolean; name: string; children: React.ReactNode }) {
  const t = useT();
  return <div className="flex items-start gap-3 py-3">{ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" /> : <CircleDashed size={18} className="mt-0.5 shrink-0 text-ink-3" />}<div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[14px] font-medium">{name}<Badge tone={ok ? "good" : "neutral"}>{t(ok ? "Connected" : "Not connected")}</Badge></div><div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{children}</div></div></div>;
}

export default function Settings() {
  const t = useT(); const { toast, confirm } = useUI(); const status = useStatus(); const settings = useStore((s) => s.settings); const set = useStore((s) => s.setSettings); const file = useRef<HTMLInputElement>(null);
  return (
    <Page title={t("Settings")}>
      <div className="space-y-6">
        <Card className="p-5"><SectionTitle title={t("Workspace")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Language")}><Segmented value={settings.language} onChange={(v) => set({ language: v })} options={[{ id: "en", label: "English" }, { id: "ar", label: "العربية" }]} /></Field>
            <Field label={t("Appearance")}><Segmented value={settings.theme} onChange={(v) => set({ theme: v })} options={[{ id: "system", label: t("Automatic") }, { id: "light", label: t("Light") }, { id: "dark", label: t("Dark") }]} /></Field>
            <Field label={t("Default currency")} hint={t("Used for new campaigns.")}><Select value={settings.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label={t("Timezone")}><Select value={settings.timezone} onChange={(e) => set({ timezone: e.target.value })}>{TIMEZONES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label={t("Default organisation")}><Input value={settings.organisation} onChange={(e) => set({ organisation: e.target.value })} /></Field>
          </div></Card>
        <Card className="p-5"><SectionTitle title={t("Integrations")} hint={t("Keys are configured on the server in .env.local and are never sent to the browser. Restart the server after changing them.")} />
          <div className="divide-y">
            <Row ok={status?.modash.configured && status.modash.reachable !== false} name="Modash">{status?.modash.configured ? (status.modash.reachable === false ? t("A key is set but Modash could not be reached or rejected it.") : `${t("Discovery and audience analytics for Instagram, TikTok and YouTube.")}${status.modash.credits != null ? ` ${t("Credits remaining")}: ${status.modash.credits}.` : ""}`) : <>{t("Set")} <code className="rounded bg-surface-2 px-1">MODASH_API_KEY</code>. {t("Without it the app runs in demonstration mode with clearly-labelled sample creators, manual entry and CSV import.")}</>}</Row>
            <Row ok={status?.ai.configured} name="Anthropic Claude">{status?.ai.configured ? `${t("AI document analysis, content plans, assistant and translation.")} ${t("Model")}: ${status.ai.model}.` : <>{t("Set")} <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code>. {t("Without it, built-in rule-based analysis, planning and assistant are used.")}</>}</Row>
            <Row ok={status?.supabase.configured} name="Supabase">{status?.supabase.configured ? t("Sign-in is required and your workspace syncs to your account.") : <>{t("Set")} <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code> + <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. {t("Without it, data is stored only in this browser.")}</>}</Row>
          </div>
          {supabase && <Button className="mt-2" onClick={() => supabase!.auth.signOut()}>{t("Sign out")}</Button>}</Card>
        <Card className="p-5"><SectionTitle title={t("Data")} hint={t("Everything is saved automatically. Back up or move your workspace as a file.")} />
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download size={14} />} onClick={() => { const s = useStore.getState(); download(`marketing-planner-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ campaigns: s.campaigns, library: s.library, templates: s.templates, settings: s.settings }), "application/json"); }}>{t("Export workspace")}</Button>
            <Button icon={<Upload size={14} />} onClick={() => file.current?.click()}>{t("Import workspace")}</Button>
            <Button onClick={() => { useStore.getState().loadDemo(); toast(t("Demonstration campaign restored")); }}>{t("Reset demonstration campaign")}</Button>
            <Button variant="danger" onClick={async () => { if (await confirm({ title: t("Delete all data?"), text: t("All campaigns, the influencer library and templates in this workspace will be permanently deleted."), confirmLabel: t("Delete everything"), danger: true })) { useStore.getState().replaceAll({ campaigns: {}, library: {}, templates: [], settings }); toast(t("Workspace cleared")); } }}>{t("Delete all data")}</Button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { const d = JSON.parse(await f.text()); if (!d || typeof d.campaigns !== "object" || typeof d.library !== "object") throw new Error(); if (await confirm({ title: t("Replace this workspace?"), text: t("The imported file will replace all current campaigns and library data."), confirmLabel: t("Replace") })) { useStore.getState().replaceAll(d); toast(t("Workspace imported")); } } catch { toast(t("That file is not a Marketing Planner backup."), { tone: "bad" }); } }} />
        </Card>
      </div>
    </Page>
  );
}
