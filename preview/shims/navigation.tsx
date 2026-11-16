// In-memory router for the single-page preview build (stands in for next/navigation and next/link).
import { createContext, useContext, useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from "react";

let current = "/"; const stack: string[] = []; const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function navigate(to: string, replace = false) {
  if (to === current) return;
  if (!replace) stack.push(current);
  current = to; emit();
  if (!to.includes("?tab=")) document.querySelector("main")?.scrollTo({ top: 0 });
}
export const back = () => { const p = stack.pop(); if (p) { current = p; emit(); } else navigate("/", true); };
const useLocation = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
if (typeof window !== "undefined") window.addEventListener("mp:navigate", (e) => navigate(String((e as CustomEvent).detail)));

export const ParamsContext = createContext<Record<string, string>>({});
export const usePathname = () => useLocation().split("?")[0];
export const useSearchParams = () => { const l = useLocation(); return useMemo(() => new URLSearchParams(l.split("?")[1] ?? ""), [l]); };
export const useParams = <T,>() => useContext(ParamsContext) as T;
const router = { push: (to: string, _o?: unknown) => navigate(to), replace: (to: string, _o?: unknown) => navigate(to, true), back, refresh: () => {}, prefetch: () => {} };
export const useRouter = () => router;
export { useLocation };

export default function Link({ href, children, onClick, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode }) {
  return <a {...rest} href="#" onClick={(e) => { e.preventDefault(); onClick?.(e); navigate(href); }}>{children}</a>;
}
