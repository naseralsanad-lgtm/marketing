import type { Budget, ContentFormat, DeckConfig, EventType, Platform, Tier, Weights } from "./types";

export const CAMPAIGN_TYPES = [
  "Event coverage", "Awareness campaign", "Product or service launch", "Government initiative",
  "Educational campaign", "Behavioural change campaign", "Brand awareness", "Other",
];

export const OBJECTIVES = [
  "Increase awareness", "Maximise social media reach", "Increase engagement", "Educate audiences",
  "Drive application downloads", "Increase service adoption", "Generate website traffic",
  "Promote event attendance", "Improve brand perception", "Encourage behavioural change",
  "Reach specific communities",
];

export const PLATFORMS: { id: Platform; label: string; modash: boolean; color: string }[] = [
  { id: "instagram", label: "Instagram", modash: true, color: "#d6249f" },
  { id: "tiktok", label: "TikTok", modash: true, color: "#111111" },
  { id: "youtube", label: "YouTube", modash: true, color: "#e62117" },
  { id: "snapchat", label: "Snapchat", modash: false, color: "#c9b800" },
  { id: "facebook", label: "Facebook", modash: false, color: "#1877f2" },
  { id: "x", label: "X", modash: false, color: "#555555" },
  { id: "linkedin", label: "LinkedIn", modash: false, color: "#0a66c2" },
];
export const platformLabel = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.label ?? p;

export const TIERS: { id: Tier; label: string; min: number; max: number }[] = [
  { id: "nano", label: "Nano", min: 0, max: 10_000 },
  { id: "micro", label: "Micro", min: 10_000, max: 100_000 },
  { id: "mid", label: "Mid-tier", min: 100_000, max: 500_000 },
  { id: "macro", label: "Macro", min: 500_000, max: 1_000_000 },
  { id: "mega", label: "Mega", min: 1_000_000, max: 5_000_000 },
  { id: "celebrity", label: "Celebrity", min: 5_000_000, max: Infinity },
];
export const tierOf = (followers: number): Tier => (TIERS.find((t) => followers < t.max) ?? TIERS[5]).id;
export const tierLabel = (t: Tier) => TIERS.find((x) => x.id === t)!.label;

export const CATEGORIES = [
  "Technology", "Lifestyle", "Family", "Education", "Business", "Government & civic", "Travel",
  "Food", "Fashion", "Beauty", "Fitness", "Comedy", "Gaming", "Finance", "Automotive", "Culture & heritage",
  "News & media", "Entrepreneurship", "Parenting", "Youth",
];

export const AGE_GROUPS = ["13-17", "18-24", "25-34", "35-44", "45-64", "65+"];
export const LANGUAGES = ["Arabic", "English", "Hindi", "Urdu", "Malayalam", "Tagalog", "Bengali", "Tamil", "French", "Russian"];
export const LANGUAGE_CODES: Record<string, string> = {
  Arabic: "ar", English: "en", Hindi: "hi", Urdu: "ur", Malayalam: "ml", Tagalog: "tl", Bengali: "bn",
  Tamil: "ta", French: "fr", Russian: "ru",
};
export const COUNTRIES: Record<string, string> = {
  "United Arab Emirates": "AE", "Saudi Arabia": "SA", Kuwait: "KW", Qatar: "QA", Bahrain: "BH", Oman: "OM",
  Egypt: "EG", Jordan: "JO", Lebanon: "LB", India: "IN", Pakistan: "PK", Philippines: "PH",
  "United Kingdom": "GB", "United States": "US", Bangladesh: "BD", Other: "XX",
};
export const CURRENCIES = ["AED", "SAR", "USD", "EUR", "GBP", "QAR", "KWD", "BHD", "OMR", "EGP", "INR"];
export const TIMEZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Africa/Cairo", "Europe/London", "America/New_York", "Asia/Kolkata", "UTC"];

export const FORMATS: { id: ContentFormat; label: string; video: boolean; defaultDuration?: number; phase: "pre" | "during" | "post" | "any" }[] = [
  { id: "reel", label: "Creative reel", video: true, defaultDuration: 45, phase: "any" },
  { id: "story_coverage", label: "Story coverage", video: false, defaultDuration: 15, phase: "during" },
  { id: "event_attendance", label: "Event attendance", video: false, phase: "during" },
  { id: "stage_speaker", label: "Stage speaker", video: false, defaultDuration: 900, phase: "during" },
  { id: "panel", label: "Panel discussion", video: false, defaultDuration: 2400, phase: "during" },
  { id: "podcast", label: "Podcast appearance", video: true, defaultDuration: 1800, phase: "during" },
  { id: "interview", label: "Interview", video: true, defaultDuration: 300, phase: "during" },
  { id: "live", label: "Live streaming", video: true, defaultDuration: 1200, phase: "during" },
  { id: "educational", label: "Educational content", video: true, defaultDuration: 60, phase: "any" },
  { id: "product_demo", label: "Product demonstration", video: true, defaultDuration: 60, phase: "any" },
  { id: "pre_event_promo", label: "Pre-event promo", video: true, defaultDuration: 30, phase: "pre" },
  { id: "post_event_highlights", label: "Post-event highlights", video: true, defaultDuration: 45, phase: "post" },
];
export const formatInfo = (f: ContentFormat) => FORMATS.find((x) => x.id === f)!;

export const EVENT_TYPES: { id: EventType; label: string; color: string }[] = [
  { id: "attendance", label: "Attendance", color: "#0a84ff" },
  { id: "filming", label: "Filming", color: "#bf5af2" },
  { id: "event", label: "Event participation", color: "#30b0c7" },
  { id: "stage", label: "Stage appearance", color: "#ff9f0a" },
  { id: "podcast", label: "Podcast recording", color: "#ff375f" },
  { id: "interview", label: "Interview", color: "#ac8e68" },
  { id: "submission", label: "Content submission", color: "#8e8e93" },
  { id: "approval", label: "Content approval", color: "#ffd60a" },
  { id: "publish", label: "Publishing", color: "#34c759" },
  { id: "pre_event", label: "Pre-event activity", color: "#5e5ce6" },
  { id: "live", label: "Live coverage", color: "#ff453a" },
  { id: "post_event", label: "Post-event activity", color: "#64d2ff" },
];
export const eventInfo = (t: EventType) => EVENT_TYPES.find((x) => x.id === t)!;

export const DEFAULT_WEIGHTS: Weights = { audience: 30, content: 20, engagement: 15, geo: 10, authenticity: 10, cost: 10, brand: 5 };
export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  audience: "Target audience alignment", content: "Content relevance", engagement: "Engagement and performance",
  geo: "Geographic relevance", authenticity: "Audience authenticity", cost: "Cost efficiency", brand: "Brand suitability",
};

export const DEFAULT_BUDGET: Budget = {
  currency: "AED", mode: "total", total: 0, influencer: 0, production: 0, amplification: 0,
  travel: 0, additional: 0, contingency: 0, taxRate: 5,
};

export const SLIDES: { id: string; title: string }[] = [
  { id: "cover", title: "Campaign Cover" },
  { id: "summary", title: "Executive Summary" },
  { id: "background", title: "Campaign Background" },
  { id: "objectives", title: "Campaign Objectives and KPIs" },
  { id: "audience", title: "Target Audience and Demographics" },
  { id: "strategy", title: "Influencer Marketing Strategy" },
  { id: "messages", title: "Media Messages and Communication Priorities" },
  { id: "influencers", title: "Selected Influencers Overview" },
  { id: "profiles", title: "Individual Influencer Profiles" },
  { id: "rationale", title: "Influencer Selection Rationale" },
  { id: "content", title: "Influencer Content Strategy" },
  { id: "concepts", title: "Individual Influencer Content Concepts" },
  { id: "matrix", title: "Campaign Message Coverage Matrix" },
  { id: "deliverables", title: "Platform and Deliverables Strategy" },
  { id: "distribution", title: "Audience Distribution" },
  { id: "impact", title: "Estimated Campaign Impact" },
  { id: "budget", title: "Detailed Budget Breakdown" },
  { id: "efficiency", title: "Cost Efficiency Analysis" },
  { id: "timeline", title: "Campaign Timeline" },
  { id: "attendance", title: "Influencer Attendance Schedule" },
  { id: "publishing", title: "Content Publishing Calendar" },
  { id: "approvals", title: "Approval and Production Requirements" },
  { id: "risks", title: "Campaign Risks and Mitigation" },
  { id: "next", title: "Executive Recommendation and Next Steps" },
];

export const DEFAULT_DECK: DeckConfig = {
  title: "", subtitle: "Influencer Campaign Plan", language: "en", brandColor: "#0b3d91", accentColor: "#0a84ff",
  order: SLIDES.map((s) => s.id), hidden: [], overrides: {},
};
