"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Brief, Campaign, Influencer, Op, Settings, Template } from "./types";
import { DEFAULT_BUDGET, DEFAULT_DECK, DEFAULT_WEIGHTS } from "./constants";
import { buildDemoInfluencers } from "./demo/influencers";
import { buildDemoCampaign, DEMO_CAMPAIGN_ID } from "./demo/campaign";
import { applyOps } from "./ops";
import { addDays, todayISO, uid } from "./utils";

export const emptyBrief = (settings?: Settings): Brief => ({
  name: "", organisation: settings?.organisation ?? "", description: "", type: "", location: "",
  startDate: "", endDate: "", eventStart: "", eventEnd: "", publishStart: "", publishEnd: "",
  preEvent: "", duringEvent: "", postEvent: "", background: "", mainMessage: "", cta: "",
  objectives: [], kpis: [], budget: { ...DEFAULT_BUDGET, currency: settings?.currency ?? "AED" },
  segments: [], platforms: [], recommendPlatforms: true,
  prefs: { categories: [], minFollowers: 0, minEngagement: 0, languages: [], geo: "", contentStyle: "", tiers: [], brandRequirements: "", approvedHandles: [], excludedHandles: [], competitors: [], count: null },
  summary: "",
});

// Undo / redo history lives in memory (per campaign) — versions are the persisted checkpoints.
const hist: Record<string, { past: string[]; future: string[]; lastAt: number; lastLabel?: string }> = {};
const H = (id: string) => (hist[id] ??= { past: [], future: [], lastAt: 0 });

interface State {
  hydrated: boolean;
  campaigns: Record<string, Campaign>;
  library: Record<string, Influencer>;
  templates: Template[];
  settings: Settings;
  tick: number;
  lastSaved?: string;
  seedIfEmpty: () => void;
  createCampaign: (init?: { brief?: Partial<Brief>; fromTemplate?: Template }) => string;
  update: (id: string, fn: (c: Campaign) => void, label?: string) => void;
  applyOps: (id: string, ops: Op[], label: string) => string[];
  undo: (id: string) => void;
  redo: (id: string) => void;
  canUndo: (id: string) => boolean;
  canRedo: (id: string) => boolean;
  duplicate: (id: string) => string;
  remove: (id: string) => void;
  saveVersion: (id: string, label: string) => void;
  restoreVersion: (id: string, versionId: string) => void;
  saveTemplate: (id: string, name: string) => void;
  deleteTemplate: (id: string) => void;
  upsertInfluencers: (list: Influencer[]) => void;
  updateInfluencer: (id: string, fn: (i: Influencer) => void) => void;
  removeInfluencer: (id: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  loadDemo: () => void;
  replaceAll: (data: { campaigns: Record<string, Campaign>; library: Record<string, Influencer>; templates: Template[]; settings: Settings }) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false, campaigns: {}, library: {}, templates: [], tick: 0,
      settings: { language: "en", theme: "system", currency: "AED", timezone: "Asia/Dubai", organisation: "" },
      seedIfEmpty: () => { if (!Object.keys(get().campaigns).length && !Object.keys(get().library).length) get().loadDemo(); },
      loadDemo: () => set((s) => {
        const library = { ...s.library }; for (const i of buildDemoInfluencers()) library[i.id] ??= i;
        return { library, campaigns: { ...s.campaigns, [DEMO_CAMPAIGN_ID]: buildDemoCampaign(library) } };
      }),
      createCampaign: (init) => {
        const id = uid("c"); const now = new Date().toISOString(); const s = get();
        const brief = { ...(init?.fromTemplate ? structuredClone(init.fromTemplate.brief) : emptyBrief(s.settings)), ...init?.brief };
        const c: Campaign = { id, status: "draft", createdAt: now, updatedAt: now, step: 1, brief, sources: [], messages: [], candidates: [], rejected: [], favourites: [], assignments: [], weights: { ...(init?.fromTemplate?.weights ?? DEFAULT_WEIGHTS) }, events: [], locations: [], deck: { ...DEFAULT_DECK, title: brief.name }, versions: [] };
        set({ campaigns: { ...s.campaigns, [id]: c } });
        return id;
      },
      update: (id, fn, label) => set((s) => {
        const cur = s.campaigns[id]; if (!cur) return s;
        const h = H(id); const now = Date.now();
        // coalesce rapid edits (typing) into one undo step
        if (!(label && h.lastLabel === label && now - h.lastAt < 1500)) { h.past.push(JSON.stringify(cur)); if (h.past.length > 60) h.past.shift(); }
        h.future = []; h.lastAt = now; h.lastLabel = label;
        const next: Campaign = structuredClone(cur); fn(next); next.updatedAt = new Date().toISOString();
        return { campaigns: { ...s.campaigns, [id]: next }, tick: s.tick + 1, lastSaved: next.updatedAt };
      }),
      applyOps: (id, ops) => { let skipped: string[] = []; get().update(id, (c) => { skipped = applyOps(c, ops, get().library); }); return skipped; },
      undo: (id) => set((s) => { const h = H(id); const prev = h.past.pop(); if (!prev) return s; h.future.push(JSON.stringify(s.campaigns[id])); h.lastLabel = undefined; return { campaigns: { ...s.campaigns, [id]: JSON.parse(prev) }, tick: s.tick + 1 }; }),
      redo: (id) => set((s) => { const h = H(id); const nxt = h.future.pop(); if (!nxt) return s; h.past.push(JSON.stringify(s.campaigns[id])); h.lastLabel = undefined; return { campaigns: { ...s.campaigns, [id]: JSON.parse(nxt) }, tick: s.tick + 1 }; }),
      canUndo: (id) => H(id).past.length > 0,
      canRedo: (id) => H(id).future.length > 0,
      duplicate: (id) => {
        const s = get(); const src = s.campaigns[id]; const nid = uid("c"); const now = new Date().toISOString();
        const copy: Campaign = { ...structuredClone(src), id: nid, isDemo: false, status: "draft", createdAt: now, updatedAt: now, versions: [] };
        copy.brief.name = `${src.brief.name} (copy)`; copy.deck.title = copy.brief.name;
        copy.assignments.forEach((a) => { a.status = "Recommended"; a.actuals = undefined; if (a.feeStatus === "confirmed") a.feeStatus = "quoted"; });
        set({ campaigns: { ...s.campaigns, [nid]: copy } });
        return nid;
      },
      remove: (id) => set((s) => { const c = { ...s.campaigns }; delete c[id]; delete hist[id]; return { campaigns: c }; }),
      saveVersion: (id, label) => get().update(id, (c) => { const { versions: _v, ...rest } = c; void _v; c.versions = [{ id: uid("v"), label, at: new Date().toISOString(), snapshot: JSON.stringify(rest) }, ...c.versions].slice(0, 15); }),
      restoreVersion: (id, vid) => get().update(id, (c) => { const v = c.versions.find((x) => x.id === vid); if (!v) return; const versions = c.versions; Object.assign(c, JSON.parse(v.snapshot), { versions }); }),
      saveTemplate: (id, name) => set((s) => {
        const c = s.campaigns[id]; if (!c) return s;
        const brief = structuredClone(c.brief);
        Object.assign(brief, { name: "", startDate: "", endDate: "", eventStart: "", eventEnd: "", publishStart: "", publishEnd: "", summary: "" });
        return { templates: [{ id: uid("t"), name, createdAt: new Date().toISOString(), brief, weights: c.weights }, ...s.templates] };
      }),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      upsertInfluencers: (list) => set((s) => {
        const library = { ...s.library };
        for (const i of list) { const ex = library[i.id]; library[i.id] = ex ? { ...ex, ...i, feeHistory: ex.feeHistory, ratings: ex.ratings, notes: ex.notes ?? i.notes, contact: { ...i.contact, ...ex.contact }, approvalStatus: ex.approvalStatus ?? i.approvalStatus, brandSafety: ex.brandSafety ?? i.brandSafety, addedAt: ex.addedAt } : i; }
        return { library, tick: s.tick + 1 };
      }),
      updateInfluencer: (id, fn) => set((s) => { const cur = s.library[id]; if (!cur) return s; const next = structuredClone(cur); fn(next); return { library: { ...s.library, [id]: next }, tick: s.tick + 1 }; }),
      removeInfluencer: (id) => set((s) => { const library = { ...s.library }; delete library[id]; return { library }; }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      replaceAll: (d) => set({ campaigns: d.campaigns ?? {}, library: d.library ?? {}, templates: d.templates ?? [], settings: d.settings ?? get().settings }),
    }),
    {
      name: "marketing-planner-v1",
      skipHydration: true,
      partialize: (s) => ({ campaigns: s.campaigns, library: s.library, templates: s.templates, settings: s.settings }),
      onRehydrateStorage: () => (state) => { if (state) { state.hydrated = true; } },
    },
  ),
);

/** Sensible dates for a brand-new campaign. */
export const suggestedDates = () => { const s = addDays(todayISO(), 21); return { startDate: s, endDate: addDays(s, 28), publishStart: addDays(s, 3), publishEnd: addDays(s, 26) }; };
