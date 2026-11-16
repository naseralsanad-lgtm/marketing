# Marketing Planner

An intelligent influencer campaign planning tool. Brief → build → present, in three steps:

1. **Campaign Brief** — guided brief, objectives, budget, audience segments, platforms, influencer preferences, factsheet analysis and an editable strategic summary.
2. **Build Campaign** — discovery with an explainable Campaign Match Score, scenarios, per-creator content plans, a message coverage matrix, live budget, impact forecast, drag-and-drop schedule and collaboration tracking.
3. **Campaign Plan** — executive overview and a one-click, 24-section presentation with PowerPoint, PDF, Excel and CSV exports.

A contextual assistant proposes changes, shows their impact, and applies them only when accepted.

> *Simple on the surface. Intelligent underneath.*

---

## Quick start

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. **No keys are required to try it**: the app opens with a clearly-labelled demonstration campaign ("Future Services Expo 2027", a fictional three-day event with four audience segments and 40 fictional creators) and uses built-in planning logic.

Production:

```bash
npm run build && npm start
```

Requires Node.js 20+.

## Connecting integrations

All keys live in `.env.local` on the server and are never sent to the browser. Restart the server after changing them. **Settings → Integrations** shows what is connected.

### Modash (influencer discovery and analytics)

1. Get a Discovery API access token from your Modash account.
2. Set `MODASH_API_KEY=...` (optionally `MODASH_RPS` to match your plan's rate limit).
3. In **Build → Discover → Search Modash**, search by platform, keywords, follower range, engagement, audience country and language. Open a creator and choose **Refresh via Modash** to load the full audience report (this uses Modash credits).

What the integration does (`src/server/modash.ts`):

| Concern | Behaviour |
|---|---|
| Endpoints | `POST /{platform}/search`, `GET /{platform}/profile/{id}/report`, `GET /{platform}/{locations\|languages\|interests\|brands}`, `GET /user/info` |
| Platforms | Instagram, TikTok, YouTube only. Snapchat, Facebook, X and LinkedIn creators are added manually or by CSV. |
| Caching | In-memory: search 1 h, reports 24 h, dictionaries 7 d |
| Rate limits | Outbound throttle (default 2 req/s), one retry on HTTP 429 honouring `Retry-After`; per-client limits on every app API route |
| Errors | 401/403, 402 (credits), 429 and network failures are mapped to plain-language messages |
| Missing metrics | Any field Modash does not return for your plan stays empty; the match score flags it as "missing data" and uses a neutral value rather than guessing |
| Sensitive data | Modash's audience "ethnicities" field is deliberately **not** ingested |

> **Verify before production.** The Modash documentation site could not be reached from the environment this was built in, and no API key was available, so the request/response field mapping was written from prior knowledge of the Discovery API and has **not been exercised against the live API**. The mapper is defensive (unknown or absent fields are ignored), but run one search and one report with your key and compare against the current docs at https://docs.modash.io before relying on it. Adjustments, if any, are confined to `fromSearchItem`, `fromReport` and `searchInfluencers` in `src/server/modash.ts`.

Without a key the app runs in **demonstration mode**: sample creators carry a "Demo data" badge everywhere (cards, profiles, forecasts, slides, exports) and are never presented as verified analytics.

### Anthropic Claude (campaign intelligence)

Set `ANTHROPIC_API_KEY=...` (optionally `ANTHROPIC_MODEL`, default `claude-opus-5-5`). This switches on:

| Feature | Route | Without a key |
|---|---|---|
| Factsheet analysis → messaging library | `/api/ai/analyze` | Rule-based extraction of verbatim sentences |
| Strategic summary | `/api/ai/summary` | Summary assembled from the brief |
| Per-creator content plans | `/api/ai/content` | Template-based plans |
| Assistant (open-ended requests) | `/api/ai/assistant` | Built-in assistant for ten common instructions |
| Arabic translation of deck content | `/api/ai/translate` | Arabic headings/labels only |

Every call uses a schema-constrained structured response (`src/server/ai.ts`). Safeguards:

- **Source integrity** — each AI-extracted message must include a verbatim quote; the server checks it against the document and flags anything it cannot find ("Quote not found in source").
- **Untrusted input** — documents and web pages are passed as delimited data with an instruction never to follow instructions inside them. AI-proposed changes are validated against real ids before they are shown, and nothing is applied without the user accepting.
- These AI routes were **not exercised end-to-end** here (no key in the build environment); they compile against the current SDK and the built-in fallbacks were tested.

### Supabase (sign-in and cloud sync) — optional

1. Create a project and run `supabase/migrations/0001_workspaces.sql`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The app then requires email/password sign-in, syncs the workspace to a private row protected by row-level security, and requires a valid session token on every API route. Not exercised against a live Supabase project here.

## Data storage

- **Default:** local-first. The whole workspace (campaigns, library, templates, settings) is saved automatically to the browser's `localStorage`. Use **Settings → Export workspace** to back up or move it.
- **With Supabase:** the same workspace is synced as one JSON document per user (`workspaces` table).
- `supabase/migrations/0002_relational_model.sql` is the full normalised schema (campaigns, segments, messages, influencers, analytics snapshots, assignments, deliverables, schedules, versions, organisations and RLS). It mirrors `src/lib/types.ts` and is the target for multi-user deployments; **the store is not yet wired to these tables**.

## How the intelligence works

All of it is plain, inspectable TypeScript in `src/lib`.

**Campaign Match Score** (`scoring.ts`) — seven criteria, each 0–100 with an explanation, combined with editable weights (defaults: audience 30, content 20, engagement 15, geography 10, authenticity 10, cost 10, brand suitability 5). A criterion with no data scores a neutral 50 and is listed under "Missing data" with a confidence figure. Audience alignment uses audience location, language, age and gender analytics only; "communities" in a segment are a label and are matched through language and geography — nothing is inferred from an influencer's own profile.

**Forecast** (`forecast.ts`) — per-deliverable reach from average views (when available) or followers × a format reach-rate × a tier factor; per-creator reach capped at 90% of followers; campaign reach de-duplicated with an explicit overlap assumption (25/15/8%); conservative/expected/optimistic at 65/100/135% delivery. Combined followers are reported separately and never used as reach. The method is shown in the Forecast tab.

**Scenarios** (`scenarios.ts`) — seven greedy selections under the influencer budget; locked, mandatory and manually added creators are always kept, exclusions respected.

**Content & matrix** (`content.ts`) — each message gets one primary owner (best fit, lightest load) plus limited supporting coverage; calls to action are intentionally repeated; locked content is never changed.

**Schedule** (`schedule.ts`) — attendance, filming, sessions, submission (−5 days), approval (−2 days) and publishing, with detection of overlaps, double-booked venues, approvals after publishing, tight production timelines and attendance gaps.

**Assistant** (`assistant.ts`, `ops.ts`) — changes are expressed as a small set of operations; the impact preview is computed by applying them to a copy of the campaign.

## Exports

| Export | How |
|---|---|
| PowerPoint (.pptx) | Editable text, native tables and native charts (pptxgenjs). Arabic decks are right-to-left. Custom fonts are referenced by name and must be installed on the presenting computer. |
| PDF | Print view of the same slides at 16:9 — choose "Save as PDF" in the browser's print dialog. |
| Excel workbook | Overview, Influencers, Content plan, Message matrix, Budget (with formulas), Forecast, Schedule. |
| CSV shortlist | Selected creators with scores, fees and data source. |
| Influencer briefs / attendance schedule | Print-ready A4 pages. |

## Project structure

```
src/lib/            domain model (types.ts), scoring, forecast, budget, scenarios, content,
                    schedule, analysis, assistant, ops, model (derived state), store, i18n
src/lib/deck        slide model shared by preview, PDF and PowerPoint
src/lib/export      pptx / xlsx / csv
src/lib/demo        fictional demonstration creators and campaign
src/server          Modash client, Claude client, document parsing, API guard (server-only)
src/app/api         status, modash/*, ai/*, documents/parse
src/app/(app)       Home, Campaigns (brief / build / plan), Library, Calendar, Reports, Settings
src/app/print       print views (deck, briefs, schedule)
src/components      UI kit, shell, assistant, and the brief/build/plan screens
supabase/migrations database schema
```

Campaign data has a single source of truth (the store); every figure, chart, schedule and slide is derived from it by `computeModel`, so an edit anywhere updates everything.

## Security notes

- API keys are server-side only; the client only ever calls this app's own `/api/*` routes.
- Uploads: extension allow-list (PDF, DOCX, PPTX, TXT, MD), 15 MB limit, magic-byte checks; text is extracted and treated as data.
- URL import: http(s) only, private/loopback addresses blocked (including across redirects), 3 MB cap, timeout.
- CSV/Excel exports neutralise spreadsheet formula injection.
- Every API route is rate-limited per client and, when Supabase is configured, requires a signed-in user.

## Known limitations

- Modash field mapping is unverified against the live API (see above); AI and Supabase paths were not exercised with live credentials.
- Undo/redo history is per browser session; named versions persist.
- Arabic covers navigation, headings, controls and all presentation labels; some longer explanatory help text remains in English. Campaign content is translated only via the AI translate action.
- Paid-amplification uplift and measured audience overlap are not modelled in the forecast.
- Local-first storage is per browser; use Supabase sync or workspace export to share.
