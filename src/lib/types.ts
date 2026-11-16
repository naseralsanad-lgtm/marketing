// Single source of truth for the Marketing Planner domain model.
// Everything shown in the UI, forecasts, schedules and exports derives from these types.

export type Platform = "instagram" | "tiktok" | "youtube" | "snapchat" | "facebook" | "x" | "linkedin";
export type Tier = "nano" | "micro" | "mid" | "macro" | "mega" | "celebrity";
/** Where a piece of influencer data came from. Never present `demo` as verified analytics. */
export type DataSource = "demo" | "modash" | "manual" | "csv";

export interface Weighted {
  name: string;
  code?: string;
  /** share of audience, 0..1 */
  weight: number;
}

export interface AudienceData {
  countries?: Weighted[];
  cities?: Weighted[];
  ages?: Weighted[];
  genders?: Weighted[];
  languages?: Weighted[];
  interests?: Weighted[];
  /** share of followers estimated to be real people, 0..1 */
  credibility?: number;
}

export interface FeeRecord {
  date: string;
  amount: number;
  currency: string;
  status: "quoted" | "confirmed";
  campaignId?: string;
  campaignName?: string;
  note?: string;
}

export interface Influencer {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  profileUrl?: string;
  avatarUrl?: string;
  followers: number;
  /** engagement rate on followers, 0..1 */
  engagementRate?: number;
  avgViews?: number;
  avgLikes?: number;
  avgComments?: number;
  country?: string;
  city?: string;
  languages: string[];
  categories: string[];
  contentStyle?: string;
  bio?: string;
  audience?: AudienceData;
  growth?: { month: string; followers: number }[];
  /** sponsored-post performance relative to organic (1 = same). */
  sponsoredPerformance?: number;
  recentPosts?: { url?: string; caption: string; likes?: number; views?: number; date?: string; type?: string }[];
  /** internal brand-suitability score 0..100 (manually reviewed; not from Modash). */
  brandSafety?: number;
  source: DataSource;
  fetchedAt?: string;
  modashUserId?: string;
  // Library fields
  contact?: { email?: string; phone?: string; agency?: string; manager?: string };
  feeHistory: FeeRecord[];
  ratings?: { overall?: number; reliability?: number; contentQuality?: number };
  approvalStatus?: "approved" | "pending" | "blocked";
  notes?: string;
  addedAt: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  role: "primary" | "secondary";
  /** 1 (highest) .. 5 */
  priority: number;
  /** desired % of campaign coverage */
  coverageTarget: number;
  countries: string[];
  cities: string[];
  communities: string[];
  ageGroups: string[];
  gender: "all" | "female" | "male";
  languages: string[];
  interests: string[];
  professions: string[];
  lifestyle: string;
  behaviours: string;
}

export type MessageType =
  | "main" | "supporting" | "service" | "statistic" | "benefit"
  | "talking_point" | "cta" | "restriction" | "opportunity";
export type MessagePriority = "mandatory" | "high" | "supporting" | "optional";

export interface Message {
  id: string;
  text: string;
  type: MessageType;
  priority: MessagePriority;
  /** Reference to the uploaded source this was extracted from. */
  sourceId?: string;
  /** Verbatim quote from the source backing this message. */
  sourceQuote?: string;
  /** true when sourceQuote was found verbatim in the source text */
  verified?: boolean;
  origin: "extracted" | "ai" | "manual";
  segmentIds?: string[];
}

export interface SourceDoc {
  id: string;
  name: string;
  kind: "file" | "text" | "url";
  text: string;
  addedAt: string;
}

export interface Budget {
  currency: string;
  mode: "total" | "allocations";
  total: number;
  influencer: number;
  production: number;
  amplification: number;
  travel: number;
  additional: number;
  contingency: number;
  /** percent, e.g. 5 for UAE VAT */
  taxRate: number;
}

export interface InfluencerPrefs {
  categories: string[];
  minFollowers: number;
  /** percent */
  minEngagement: number;
  languages: string[];
  geo: string;
  contentStyle: string;
  tiers: Tier[];
  brandRequirements: string;
  approvedHandles: string[];
  excludedHandles: string[];
  competitors: string[];
  count: number | null;
}

export interface Brief {
  name: string;
  organisation: string;
  description: string;
  type: string;
  location: string;
  startDate: string;
  endDate: string;
  eventStart: string;
  eventEnd: string;
  publishStart: string;
  publishEnd: string;
  preEvent: string;
  duringEvent: string;
  postEvent: string;
  background: string;
  mainMessage: string;
  cta: string;
  /** ordered by priority (first = most important) */
  objectives: string[];
  kpis: { id: string; label: string; target: string }[];
  budget: Budget;
  segments: AudienceSegment[];
  platforms: Platform[];
  recommendPlatforms: boolean;
  prefs: InfluencerPrefs;
  summary: string;
  summaryOrigin?: "ai" | "generated" | "edited";
}

export type ContentFormat =
  | "reel" | "story_coverage" | "event_attendance" | "stage_speaker" | "panel" | "podcast"
  | "interview" | "live" | "educational" | "product_demo" | "pre_event_promo" | "post_event_highlights";

export interface Deliverable {
  id: string;
  format: ContentFormat;
  platform: Platform;
  count: number;
  durationSec?: number;
  publishDate?: string;
}

export interface ContentPlan {
  role: string;
  objective: string;
  segmentId?: string;
  topic: string;
  concept: string;
  storyline: string;
  hook: string;
  talkingPoints: string[];
  mandatoryInfo: string[];
  cta: string;
  filming: string;
  approval: string;
  locked?: boolean;
  origin: "ai" | "generated" | "edited";
  variant: number;
}

export const COLLAB_STATUSES = [
  "Recommended", "Shortlisted", "Contacted", "Awaiting quotation", "Negotiating", "Awaiting approval",
  "Confirmed", "Contract issued", "Contract signed", "Content in production", "Content submitted",
  "Content approved", "Published", "Completed",
] as const;
export type CollabStatus = (typeof COLLAB_STATUSES)[number];

export type MsgLevel = "primary" | "supporting";

export interface Assignment {
  influencerId: string;
  status: CollabStatus;
  fee: number;
  feeStatus: "estimated" | "quoted" | "confirmed";
  locked: boolean;
  mandatory: boolean;
  /** added by the user rather than by a recommendation/scenario */
  manual: boolean;
  notes: string;
  deliverables: Deliverable[];
  messages: Record<string, MsgLevel>;
  plan?: ContentPlan;
  ops: { eventAccess?: boolean; travel?: string; approvals?: string; production?: string };
  actuals?: { reach?: number; views?: number; engagements?: number };
}

export type EventType =
  | "attendance" | "filming" | "event" | "stage" | "podcast" | "interview"
  | "submission" | "approval" | "publish" | "pre_event" | "live" | "post_event";

export interface ScheduleEvent {
  id: string;
  type: EventType;
  title: string;
  influencerId?: string;
  date: string;
  start?: string;
  end?: string;
  location?: string;
  notes?: string;
  /** generated by the scheduler (regeneration replaces only auto events) */
  auto?: boolean;
}

export interface DeckConfig {
  title: string;
  subtitle: string;
  language: "en" | "ar" | "bilingual";
  brandColor: string;
  accentColor: string;
  logoDataUrl?: string;
  fontName?: string;
  fontDataUrl?: string;
  order: string[];
  hidden: string[];
  overrides: Record<string, { title?: string; bullets?: Record<number, string[]> }>;
  /** AI translations of campaign content, keyed by source text (used for Arabic decks). */
  translations?: Record<string, string>;
}

export interface Weights {
  audience: number; content: number; engagement: number; geo: number;
  authenticity: number; cost: number; brand: number;
}

export interface CampaignVersion { id: string; label: string; at: string; snapshot: string }

export interface Campaign {
  id: string;
  status: "draft" | "active" | "upcoming" | "completed" | "archived";
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  step: 1 | 2 | 3;
  brief: Brief;
  sources: SourceDoc[];
  messages: Message[];
  /** discovery pool (influencer ids from the library) */
  candidates: string[];
  rejected: string[];
  favourites: string[];
  assignments: Assignment[];
  weights: Weights;
  events: ScheduleEvent[];
  locations: string[];
  deck: DeckConfig;
  versions: CampaignVersion[];
}

export interface Template { id: string; name: string; createdAt: string; brief: Brief; weights: Weights }

export interface Settings {
  language: "en" | "ar";
  theme: "system" | "light" | "dark";
  currency: string;
  timezone: string;
  organisation: string;
}

// ---- Assistant change proposals -------------------------------------------------
export type Op =
  | { op: "add_influencer"; influencerId: string }
  | { op: "remove_influencer"; influencerId: string }
  | { op: "replace_influencer"; influencerId: string; toId: string }
  | { op: "set_fee"; influencerId: string; fee: number }
  | { op: "set_budget"; field: keyof Budget; value: number }
  | { op: "assign_message"; messageId: string; influencerId: string; level: MsgLevel | "none" }
  | { op: "add_deliverable"; influencerId: string; format: ContentFormat; count: number }
  | { op: "remove_deliverable"; influencerId: string; format: ContentFormat }
  | { op: "move_event"; eventId: string; date: string }
  | { op: "hide_slides"; slideIds: string[] }
  | { op: "regenerate_schedule" };

export interface Proposal {
  id: string;
  title: string;
  rationale: string;
  ops: Op[];
  notes?: string[];
}
