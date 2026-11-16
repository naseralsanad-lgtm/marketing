import type { AudienceSegment, Brief, Campaign, Influencer, SourceDoc } from "../types";
import { DEFAULT_DECK, DEFAULT_WEIGHTS } from "../constants";
import { buildSummary, extractMessages } from "../analysis";
import { scorePool } from "../scoring";
import { buildScenario, draftAssignment } from "../scenarios";
import { distributeMessages, generatePlan } from "../content";
import { generateSchedule } from "../schedule";

export const DEMO_CAMPAIGN_ID = "demo_future_services_expo";

/** Fictional factsheet used for the demonstration campaign. All figures are invented for illustration. */
export const DEMO_FACTSHEET = `FUTURE SERVICES EXPO 2027 — CAMPAIGN FACTSHEET (DEMONSTRATION DOCUMENT — FICTIONAL)

Key messages
- Future Services Expo 2027 brings every digital government service together under one roof for three days.
- One app, one login: the new OneAccess app lets residents complete everyday services in minutes instead of hours.
- Digital services are designed for everyone — citizens, residents and visitors — in the language they prefer.

Supporting messages
- Visitors can try each service hands-on with a guide who speaks their language.
- Families are welcome: a dedicated Family Zone runs supervised activities throughout the day.
- Entry is free with advance registration.

Services
- OneAccess app: a single secure login for more than 120 services across 14 entities.
- Smart Renewals: renew a residency, licence or permit in under five minutes without visiting a centre.
- Family Hub: manage school, health and housing services for the whole household from one dashboard.
- Business Fast-Track: set up and license a new company fully online.
- Voice Assistant: complete services by voice in Arabic, English, Hindi and Urdu.
- Accessibility Mode: larger text, screen-reader support and sign-language video help.

Key statistics
- More than 120 services from 14 entities are available in the OneAccess app.
- 92% of pilot users completed their renewal in under five minutes.
- The Voice Assistant supports 4 languages at launch.
- Over 40 live demonstrations and 25 speaker sessions are scheduled across the three days.

Audience benefits
- Save time: most services take minutes and can be completed from home.
- Get help in your own language, in person at the expo or through the Voice Assistant.
- Keep every family document secure in one place.

Call to action
- Register free at futureservices.example and download the OneAccess app before you visit.

Agenda
- Day 1: Opening keynote on the Main Stage and the OneAccess app launch moment.
- Day 2: Community Day with sessions in Hindi, Urdu and Tagalog at the Community Stage.
- Day 3: Youth and Innovation Day with a student hackathon showcase and live podcast recordings.

Communication guidelines
- Do not describe any service as "instant"; use "in minutes".
- Always state that registration is free.
- Do not film visitors' screens or personal documents.
- Use only the official campaign hashtag #FutureServices2027.
- Statistics must be quoted exactly as written in this factsheet.`;

const seg = (id: string, name: string, role: "primary" | "secondary", priority: number, coverageTarget: number, p: Partial<AudienceSegment>): AudienceSegment => ({
  id, name, role, priority, coverageTarget, countries: ["United Arab Emirates"], cities: [], communities: [], ageGroups: [], gender: "all",
  languages: [], interests: [], professions: [], lifestyle: "", behaviours: "", ...p,
});

export function buildDemoCampaign(lib: Record<string, Influencer>): Campaign {
  const now = "2026-11-10T09:00:00.000Z";
  const segments = [
    seg("seg_emirati", "Emirati citizens", "primary", 1, 35, { languages: ["Arabic"], cities: ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain"], ageGroups: ["18-24", "25-34", "35-44"], interests: ["Government & civic", "Family", "Culture & heritage"], behaviours: "High smartphone usage; Snapchat and Instagram daily" }),
    seg("seg_arab", "Arabic-speaking residents", "primary", 2, 25, { languages: ["Arabic"], communities: ["Arab expatriate communities"], ageGroups: ["25-34", "35-44"], interests: ["Family", "Finance", "Technology"] }),
    seg("seg_expat", "English-speaking expatriates", "secondary", 3, 20, { languages: ["English"], ageGroups: ["25-34", "35-44"], interests: ["Lifestyle", "Travel", "Business"], professions: ["Professionals", "Entrepreneurs"] }),
    seg("seg_hindi", "Hindi- and Urdu-speaking communities", "secondary", 2, 20, { languages: ["Hindi", "Urdu"], communities: ["South Asian resident communities"], ageGroups: ["25-34", "35-44", "45-64"], interests: ["Family", "Education", "Finance"] }),
  ];
  const brief: Brief = {
    name: "Future Services Expo 2027", organisation: "Digital Services Authority (fictional)",
    description: "A three-day public expo where residents can try every digital government service hands-on, anchored by the launch of the OneAccess app.",
    type: "Event coverage", location: "Dubai, United Arab Emirates",
    startDate: "2027-01-18", endDate: "2027-02-21", eventStart: "2027-02-09", eventEnd: "2027-02-11", publishStart: "2027-01-25", publishEnd: "2027-02-18",
    preEvent: "Teaser content and registration drive from two weeks before opening.",
    duringEvent: "Daily on-ground story coverage, stage sessions, podcast recordings and live walkthroughs of each service zone.",
    postEvent: "Highlight recaps and app-adoption explainers in the week after the event.",
    background: "Service adoption is high among digitally confident users but uneven across language communities. The expo is designed to let people try services with in-language support and leave with the app installed.",
    mainMessage: "One app, one login: everyday government services in minutes, for everyone.",
    cta: "Register free at futureservices.example and download the OneAccess app.",
    objectives: ["Promote event attendance", "Increase service adoption", "Reach specific communities", "Drive application downloads", "Educate audiences"],
    kpis: [{ id: "k1", label: "Event registrations", target: "45,000" }, { id: "k2", label: "App downloads during campaign", target: "150,000" }, { id: "k3", label: "Estimated unique reach", target: "900,000" }, { id: "k4", label: "Share of reach in community languages", target: "≥ 20%" }],
    budget: { currency: "AED", mode: "total", total: 1_200_000, influencer: 640_000, production: 150_000, amplification: 130_000, travel: 60_000, additional: 30_000, contingency: 100_000, taxRate: 5 },
    segments, platforms: ["instagram", "tiktok", "youtube", "snapchat"], recommendPlatforms: false,
    prefs: { categories: ["Technology", "Government & civic", "Family", "Education", "Lifestyle"], minFollowers: 5000, minEngagement: 1.5, languages: ["Arabic", "English", "Hindi", "Urdu"], geo: "UAE-based creators preferred", contentStyle: "Authentic, helpful, never salesy", tiers: [], brandRequirements: "Family-safe content; no political commentary.", approvedHandles: ["rashid.explains", "imran.uaeguide"], excludedHandles: ["sultan.live"], competitors: [], count: 12 },
    summary: "",
  };
  const doc: SourceDoc = { id: "src_demo_factsheet", name: "Future Services Expo 2027 — Factsheet (demo).txt", kind: "text", text: DEMO_FACTSHEET, addedAt: now };
  const c: Campaign = {
    id: DEMO_CAMPAIGN_ID, status: "active", isDemo: true, createdAt: now, updatedAt: now, step: 2, brief, sources: [doc],
    messages: extractMessages(doc, segments), candidates: Object.values(lib).filter((i) => i.source === "demo").map((i) => i.id),
    rejected: [], favourites: [], assignments: [], weights: { ...DEFAULT_WEIGHTS }, events: [],
    locations: ["Main Stage", "Community Stage", "Podcast Studio", "OneAccess Zone", "Family Zone", "Business Fast-Track Stand"],
    deck: { ...DEFAULT_DECK, title: brief.name }, versions: [],
  };
  c.brief.summary = buildSummary(c.brief, c.messages); c.brief.summaryOrigin = "generated";
  const pool = c.candidates.map((id) => lib[id]);
  const scores = scorePool(pool, brief, c.weights);
  const sc = buildScenario("balanced", pool, scores, brief, [], lib, []);
  c.assignments = sc.ids.map((id) => draftAssignment(lib[id], brief, scores[id].estFee));
  const statuses = ["Confirmed", "Contract signed", "Negotiating", "Awaiting quotation", "Shortlisted", "Confirmed", "Contacted", "Recommended"] as const;
  c.assignments.forEach((a, i) => {
    a.status = statuses[i % statuses.length];
    if (a.status === "Confirmed" || a.status === "Contract signed") { a.feeStatus = "confirmed"; a.fee = Math.round((a.fee * 0.95) / 500) * 500; }
    else if (a.status === "Negotiating") a.feeStatus = "quoted";
    if (i === 0) { a.locked = true; a.mandatory = true; a.notes = "Requested by the client’s communications director."; }
    if (a.feeStatus === "confirmed") a.ops = { eventAccess: true, travel: "Local — no travel required", approvals: "Media accreditation issued" };
  });
  const dist = distributeMessages(c, lib, scores);
  c.assignments.forEach((a) => { a.messages = dist[a.influencerId] ?? {}; a.plan = generatePlan(a, lib[a.influencerId], c, scores[a.influencerId]); });
  c.events = generateSchedule(c, lib);
  return c;
}
