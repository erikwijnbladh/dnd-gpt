create table public.campaigns (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  tagline text,
  idea text not null,
  answers jsonb default '{}'::jsonb,
  skeleton jsonb,
  chapters jsonb,
  npcs jsonb,
  appendix jsonb,
  how_to_run jsonb,
  quality_check jsonb,
  created_at timestamptz default now() not null
);

-- Users can only read/write their own campaigns
alter table public.campaigns enable row level security;

create policy "Users can view own campaigns"
  on public.campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own campaigns"
  on public.campaigns for delete
  using (auth.uid() = user_id);
