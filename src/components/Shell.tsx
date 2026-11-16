"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookUser, CalendarDays, FolderKanban, Home, Loader2, Menu, Plus, Presentation, Settings as SettingsIcon, X } from "lucide-react";
import { useStore, suggestedDates } from "@/lib/store";
import { supabase, pullWorkspace, pushWorkspace } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button, Card, Field, Input, Note, UIProvider } from "./ui";
import { cx } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/campaigns", label: "My Campaigns", icon: FolderKanban },
  { href: "/library", label: "Influencer Library", icon: BookUser },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports & Presentations", icon: Presentation },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function useCreateCampaign() {
  const router = useRouter(); const create = useStore((s) => s.createCampaign);
  return (init?: Parameters<typeof create>[0]) => { const id = create({ ...init, brief: { ...suggestedDates(), ...init?.brief } }); router.push(`/campaigns/${id}/brief`); };
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT(); const path = usePathname(); const createCampaign = useCreateCampaign();
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link href="/" onClick={onNavigate} className="mb-3 flex items-center gap-2.5 px-2 pt-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-[13px] font-bold text-bg">MP</span>
        <span className="text-[15px] font-semibold tracking-tight">Marketing Planner</span>
      </Link>
      <Button variant="primary" icon={<Plus size={15} />} className="mb-3 w-full" onClick={() => { createCampaign(); onNavigate?.(); }}>{t("Create Campaign")}</Button>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => { const active = n.href === "/" ? path === "/" : path.startsWith(n.href); return (
          <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cx("flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] transition-colors", active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-2 hover:bg-surface/60 hover:text-ink")}>
            <n.icon size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent" : ""} />{t(n.label)}
          </Link>); })}
      </nav>
      <div className="mt-auto px-2 pb-1 text-[11px] leading-relaxed text-ink-3">{t("Simple on the surface. Intelligent underneath.")}</div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const t = useT();
  const [state, setState] = useState<"loading" | "in" | "out">(supabase ? "loading" : "in");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [mode, setMode] = useState<"in" | "up">("in");
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id ?? null); setState(data.session ? "in" : "out"); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { setUserId(session?.user.id ?? null); setState(session ? "in" : "out"); });
    return () => data.subscription.unsubscribe();
  }, []);
  // Cloud sync: pull once after sign-in, then push (debounced) whenever the workspace changes.
  useEffect(() => {
    if (!supabase || !userId) return;
    let ready = false; let timer: ReturnType<typeof setTimeout>;
    pullWorkspace(userId).then((w) => { if (w?.data && typeof w.data === "object") useStore.getState().replaceAll(w.data as never); else useStore.getState().seedIfEmpty(); ready = true; }).catch(() => { ready = true; });
    const unsub = useStore.subscribe((s) => { if (!ready) return; clearTimeout(timer); timer = setTimeout(() => pushWorkspace(userId, { campaigns: s.campaigns, library: s.library, templates: s.templates, settings: s.settings }).catch(() => {}), 1500); });
    return () => { unsub(); clearTimeout(timer); };
  }, [userId]);
  if (state === "in") return <>{children}</>;
  if (state === "loading") return <div className="flex h-screen items-center justify-center"><Loader2 className="spin text-ink-3" /></div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = mode === "in" ? await supabase!.auth.signInWithPassword({ email, password: pw }) : await supabase!.auth.signUp({ email, password: pw });
    if (error) setErr(error.message); else if (mode === "up") setErr(t("Check your inbox to confirm your email, then sign in."));
    setBusy(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink font-bold text-bg">MP</div><h1 className="text-[20px] font-semibold">Marketing Planner</h1><p className="text-[13px] text-ink-2">{mode === "in" ? t("Sign in to your workspace") : t("Create your account")}</p></div>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("Email")}><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("Password")}><Input type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          {err && <Note tone="warn">{err}</Note>}
          <Button variant="primary" className="w-full" loading={busy} type="submit">{mode === "in" ? t("Sign in") : t("Create account")}</Button>
        </form>
        <button className="mt-4 w-full text-center text-[13px] text-accent" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? t("Create an account") : t("I already have an account")}</button>
      </Card>
    </div>
  );
}

/** Rehydrates the persisted workspace, applies theme + language, and (optionally) gates on sign-in. */
export function AppRoot({ children, bare }: { children: ReactNode; bare?: boolean }) {
  const hydrated = useStore((s) => s.hydrated); const settings = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  useEffect(() => { Promise.resolve(useStore.persist.rehydrate()).then(() => { useStore.setState({ hydrated: true }); if (!supabase) useStore.getState().seedIfEmpty(); }); }, []);
  useEffect(() => {
    const apply = () => { const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; };
    apply(); document.documentElement.lang = settings.language; document.documentElement.dir = settings.language === "ar" ? "rtl" : "ltr";
    const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, [settings.theme, settings.language]);
  if (!hydrated) return <div className="flex h-screen items-center justify-center"><Loader2 className="spin text-ink-3" /></div>;
  if (bare) return <UIProvider><AuthGate>{children}</AuthGate></UIProvider>;
  return (
    <UIProvider>
      <AuthGate>
        <div className="flex h-screen overflow-hidden">
          <aside className="no-print hidden w-[236px] shrink-0 border-e bg-bg lg:block"><Sidebar /></aside>
          {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} /><aside className="fade-up absolute inset-y-0 start-0 w-[260px] border-e bg-bg shadow-pop"><Sidebar onNavigate={() => setOpen(false)} /></aside></div>}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="no-print flex items-center gap-2 border-b bg-surface px-3 py-2 lg:hidden">
              <button aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-surface-2">{open ? <X size={18} /> : <Menu size={18} />}</button>
              <span className="text-[15px] font-semibold">Marketing Planner</span>
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </AuthGate>
    </UIProvider>
  );
}

export function Page({ title, subtitle, actions, children, wide }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx("mx-auto w-full px-4 py-6 sm:px-8 sm:py-8", wide ? "max-w-[1400px]" : "max-w-[1180px]")}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>{subtitle && <p className="mt-1 text-[14px] text-ink-2">{subtitle}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
