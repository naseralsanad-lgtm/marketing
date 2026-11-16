-- Marketing Planner — normalised relational model
-- This mirrors src/lib/types.ts table-for-table. It is the target schema for team/multi-user
-- deployments and SQL reporting. NOTE: the shipped app syncs through `workspaces` (0001); wiring the
-- store to these tables is the documented next step (see README → "Data storage").

create type platform        as enum ('instagram','tiktok','youtube','snapchat','facebook','x','linkedin');
create type data_source     as enum ('demo','modash','manual','csv');
create type fee_status      as enum ('estimated','quoted','confirmed');
create type message_type    as enum ('main','supporting','service','statistic','benefit','talking_point','cta','restriction','opportunity');
create type message_priority as enum ('mandatory','high','supporting','optional');
create type message_level   as enum ('primary','supporting');

create table organisations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table memberships  (org_id uuid references organisations on delete cascade, user_id uuid references auth.users on delete cascade, role text not null default 'editor' check (role in ('owner','editor','viewer')), primary key (org_id, user_id));

create table campaigns (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references organisations on delete cascade,
  status text not null default 'draft', is_demo boolean not null default false, step smallint not null default 1,
  name text not null default '', organisation text, description text, type text, location text,
  start_date date, end_date date, event_start date, event_end date, publish_start date, publish_end date,
  pre_event text, during_event text, post_event text, background text, main_message text, cta text,
  objectives text[] not null default '{}', kpis jsonb not null default '[]', platforms platform[] not null default '{}', recommend_platforms boolean not null default true,
  influencer_prefs jsonb not null default '{}', scoring_weights jsonb not null default '{}', locations text[] not null default '{}',
  summary text, summary_origin text, deck jsonb not null default '{}', timezone text not null default 'Asia/Dubai',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table campaign_budgets (
  campaign_id uuid primary key references campaigns on delete cascade, currency text not null default 'AED', mode text not null default 'total',
  total numeric not null default 0, influencer numeric not null default 0, production numeric not null default 0, amplification numeric not null default 0,
  travel numeric not null default 0, additional numeric not null default 0, contingency numeric not null default 0, tax_rate numeric not null default 5
);
create table audience_segments (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, name text not null,
  role text not null default 'primary', priority smallint not null default 1, coverage_target numeric not null default 0,
  countries text[] default '{}', cities text[] default '{}', communities text[] default '{}', age_groups text[] default '{}', gender text default 'all',
  languages text[] default '{}', interests text[] default '{}', professions text[] default '{}', lifestyle text, behaviours text, position int not null default 0
);
create table source_documents (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, name text not null, kind text not null, extracted_text text not null, storage_path text, added_at timestamptz not null default now());
create table messages (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, text text not null, type message_type not null, priority message_priority not null,
  source_id uuid references source_documents on delete set null, source_quote text, verified boolean, origin text not null default 'manual', position int not null default 0
);
create table message_segments (message_id uuid references messages on delete cascade, segment_id uuid references audience_segments on delete cascade, primary key (message_id, segment_id));

create table influencers (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references organisations on delete cascade,
  name text not null, handle text not null, platform platform not null, profile_url text, avatar_url text,
  followers bigint not null default 0, engagement_rate numeric, avg_views bigint, avg_likes bigint, avg_comments bigint,
  country text, city text, languages text[] default '{}', categories text[] default '{}', content_style text, bio text,
  brand_safety smallint, approval_status text default 'pending', ratings jsonb default '{}', contact jsonb default '{}', notes text,
  source data_source not null, modash_user_id text, fetched_at timestamptz, added_at timestamptz not null default now(),
  unique (org_id, platform, handle)
);
-- Timestamped analytics snapshots keep the source and date of every figure.
create table influencer_analytics (
  id uuid primary key default gen_random_uuid(), influencer_id uuid not null references influencers on delete cascade, source data_source not null, fetched_at timestamptz not null default now(),
  audience jsonb not null default '{}', growth jsonb, recent_posts jsonb, sponsored_performance numeric
);
create table influencer_fees (id uuid primary key default gen_random_uuid(), influencer_id uuid not null references influencers on delete cascade, campaign_id uuid references campaigns on delete set null, quoted_on date not null, amount numeric not null, currency text not null, status fee_status not null, note text);

create table campaign_candidates (campaign_id uuid references campaigns on delete cascade, influencer_id uuid references influencers on delete cascade, rejected boolean not null default false, favourite boolean not null default false, primary key (campaign_id, influencer_id));
create table assignments (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, influencer_id uuid not null references influencers on delete restrict,
  status text not null default 'Recommended', fee numeric not null default 0, fee_status fee_status not null default 'estimated',
  locked boolean not null default false, mandatory boolean not null default false, manual boolean not null default false, notes text,
  content_plan jsonb, ops jsonb not null default '{}', actual_reach bigint, actual_views bigint, actual_engagements bigint,
  unique (campaign_id, influencer_id)
);
create table deliverables (id uuid primary key default gen_random_uuid(), assignment_id uuid not null references assignments on delete cascade, format text not null, platform platform not null, count smallint not null default 1, duration_sec int, publish_date date);
create table assignment_messages (assignment_id uuid references assignments on delete cascade, message_id uuid references messages on delete cascade, level message_level not null, primary key (assignment_id, message_id));
create table schedule_events (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, influencer_id uuid references influencers on delete set null,
  type text not null, title text not null, event_date date not null, start_time time, end_time time, location text, notes text, auto boolean not null default false
);
create table campaign_versions (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, label text not null, snapshot jsonb not null, created_by uuid references auth.users, created_at timestamptz not null default now());
create table campaign_templates (id uuid primary key default gen_random_uuid(), org_id uuid not null references organisations on delete cascade, name text not null, brief jsonb not null, weights jsonb not null, created_at timestamptz not null default now());

create index on campaigns (org_id); create index on audience_segments (campaign_id); create index on messages (campaign_id);
create index on assignments (campaign_id); create index on schedule_events (campaign_id, event_date); create index on influencer_analytics (influencer_id, fetched_at desc);

-- Access control: members of an organisation can read; owners/editors can write.
create or replace function is_member(o uuid, write boolean default false) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from memberships m where m.org_id = o and m.user_id = auth.uid() and (not write or m.role in ('owner','editor'))) $$;

do $$ declare t text; begin
  foreach t in array array['campaigns','influencers','campaign_templates'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%s read" on %I for select using (is_member(org_id))', t, t);
    execute format('create policy "%s write" on %I for all using (is_member(org_id, true)) with check (is_member(org_id, true))', t, t);
  end loop;
  foreach t in array array['campaign_budgets','audience_segments','source_documents','messages','campaign_candidates','assignments','schedule_events','campaign_versions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%s read" on %I for select using (exists (select 1 from campaigns c where c.id = campaign_id and is_member(c.org_id)))', t, t);
    execute format('create policy "%s write" on %I for all using (exists (select 1 from campaigns c where c.id = campaign_id and is_member(c.org_id, true))) with check (exists (select 1 from campaigns c where c.id = campaign_id and is_member(c.org_id, true)))', t, t);
  end loop;
end $$;
alter table organisations enable row level security; alter table memberships enable row level security;
create policy "org read" on organisations for select using (is_member(id));
create policy "membership read" on memberships for select using (user_id = auth.uid() or is_member(org_id));
alter table deliverables enable row level security; alter table assignment_messages enable row level security; alter table message_segments enable row level security; alter table influencer_analytics enable row level security; alter table influencer_fees enable row level security;
create policy "deliverables rw" on deliverables for all using (exists (select 1 from assignments a join campaigns c on c.id = a.campaign_id where a.id = assignment_id and is_member(c.org_id, true)));
create policy "assignment_messages rw" on assignment_messages for all using (exists (select 1 from assignments a join campaigns c on c.id = a.campaign_id where a.id = assignment_id and is_member(c.org_id, true)));
create policy "message_segments rw" on message_segments for all using (exists (select 1 from messages m join campaigns c on c.id = m.campaign_id where m.id = message_id and is_member(c.org_id, true)));
create policy "analytics rw" on influencer_analytics for all using (exists (select 1 from influencers i where i.id = influencer_id and is_member(i.org_id, true)));
create policy "fees rw" on influencer_fees for all using (exists (select 1 from influencers i where i.id = influencer_id and is_member(i.org_id, true)));
