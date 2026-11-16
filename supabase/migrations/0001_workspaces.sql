-- Marketing Planner — workspace sync (used by the application today)
-- One private workspace document per signed-in user. The app reads it at sign-in and writes it
-- (debounced) whenever the workspace changes. Row-level security restricts each row to its owner.

create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "workspace: owner can read"   on public.workspaces for select using (auth.uid() = user_id);
create policy "workspace: owner can insert" on public.workspaces for insert with check (auth.uid() = user_id);
create policy "workspace: owner can update" on public.workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspace: owner can delete" on public.workspaces for delete using (auth.uid() = user_id);

-- Private bucket for original campaign documents (optional; the app stores extracted text in the workspace).
insert into storage.buckets (id, name, public) values ('campaign-documents', 'campaign-documents', false) on conflict (id) do nothing;
create policy "documents: owner access" on storage.objects for all
  using (bucket_id = 'campaign-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'campaign-documents' and (storage.foldername(name))[1] = auth.uid()::text);
