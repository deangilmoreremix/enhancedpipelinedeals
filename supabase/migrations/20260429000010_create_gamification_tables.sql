-- Gamification tables: achievements, user_achievements, challenges

-- Achievements Table
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  points integer not null default 0,
  rarity text check (rarity in ('common', 'rare', 'epic', 'legendary')) default 'common',
  category text check (category in ('sales', 'engagement', 'growth', 'teamwork')) default 'sales',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.achievements enable row level security;
create policy "Allow authenticated access" on public.achievements for select to authenticated using (true);
create policy "Allow service role full access" on public.achievements for all to service_role using (true);

create index idx_achievements_rarity on public.achievements(rarity);
create index idx_achievements_category on public.achievements(category);

-- User Achievements Table (junction between contacts and achievements)
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  achievement_id uuid references public.achievements(id) on delete cascade,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_id)
);

alter table public.user_achievements enable row level security;
create policy "Users can view their achievements" on public.user_achievements for select using (auth.uid() = user_id);
create policy "Users can insert their achievements" on public.user_achievements for insert with check (auth.uid() = user_id);
create policy "Allow service role full access" on public.user_achievements for all to service_role using (true);

create index idx_user_achievements_user_id on public.user_achievements(user_id);
create index idx_user_achievements_achievement_id on public.user_achievements(achievement_id);

-- Challenges Table
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text check (type in ('revenue', 'deals', 'streak', 'conversion')) default 'deals',
  target numeric not null default 0,
  current_progress numeric default 0,
  reward text,
  start_date timestamptz default now(),
  end_date timestamptz,
  participants uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.challenges enable row level security;
create policy "Allow authenticated access" on public.challenges for select to authenticated using (true);
create policy "Allow service role full access" on public.challenges for all to service_role using (true);

create index idx_challenges_end_date on public.challenges(end_date);