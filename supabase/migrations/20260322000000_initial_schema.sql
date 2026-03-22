-- =============================================================================
-- Initial schema for BoardGames Meeting Planner
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  name text,
  surname text,
  avatar_url text,
  notification_prior_meeting int not null default 1,
  notification_reminder_interval int not null default 2
);

create table public.push_tokens (
  user_id uuid primary key references public.profiles on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

create table public.board_games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  genre text,
  min_players int,
  max_players int,
  tutorial_url text,
  spotify_playlist_url text,
  image_url text,
  owners text[] default '{}'
);

create type public.meeting_status as enum ('voting', 'approved', 'completed');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  status public.meeting_status not null default 'voting',
  chosen_date date,
  chosen_game_id uuid references public.board_games on delete set null,
  approved_by uuid references public.profiles on delete set null,
  approved_at timestamptz,
  voting_start_date date not null default current_date
);

create table public.date_options (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings on delete cascade,
  date date not null,
  is_custom boolean not null default false,
  added_by uuid references public.profiles on delete set null
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings on delete cascade,
  user_id uuid not null references public.profiles on delete cascade
);

create table public.vote_dates (
  vote_id uuid not null references public.votes on delete cascade,
  date_option_id uuid not null references public.date_options on delete cascade,
  primary key (vote_id, date_option_id)
);

create table public.vote_games (
  vote_id uuid not null references public.votes on delete cascade,
  game_id uuid not null references public.board_games on delete cascade,
  primary key (vote_id, game_id)
);

create table public.survey_reminder_log (
  user_id uuid primary key references public.profiles on delete cascade,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes & unique constraints
-- ---------------------------------------------------------------------------

create unique index idx_meetings_number on public.meetings (number desc);
alter table public.votes add constraint uq_votes_meeting_user unique (meeting_id, user_id);
alter table public.date_options add constraint uq_date_options_meeting_date unique (meeting_id, date);

create index idx_vote_dates_date_option on public.vote_dates (date_option_id);
create index idx_vote_games_game on public.vote_games (game_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.board_games enable row level security;
alter table public.meetings enable row level security;
alter table public.date_options enable row level security;
alter table public.votes enable row level security;
alter table public.vote_dates enable row level security;
alter table public.vote_games enable row level security;
alter table public.survey_reminder_log enable row level security;

-- profiles
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- push_tokens (own row only)
create policy "push_tokens_select" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "push_tokens_insert" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "push_tokens_update" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- board_games (all authenticated)
create policy "board_games_select" on public.board_games
  for select using (auth.uid() is not null);

create policy "board_games_insert" on public.board_games
  for insert with check (auth.uid() is not null);

create policy "board_games_update" on public.board_games
  for update using (auth.uid() is not null);

create policy "board_games_delete" on public.board_games
  for delete using (auth.uid() is not null);

-- meetings (all authenticated, no delete)
create policy "meetings_select" on public.meetings
  for select using (auth.uid() is not null);

create policy "meetings_insert" on public.meetings
  for insert with check (auth.uid() is not null);

create policy "meetings_update" on public.meetings
  for update using (auth.uid() is not null);

-- date_options (all authenticated, no delete)
create policy "date_options_select" on public.date_options
  for select using (auth.uid() is not null);

create policy "date_options_insert" on public.date_options
  for insert with check (auth.uid() is not null);

create policy "date_options_update" on public.date_options
  for update using (auth.uid() is not null);

-- votes (select all, insert/update/delete own)
create policy "votes_select" on public.votes
  for select using (auth.uid() is not null);

create policy "votes_insert" on public.votes
  for insert with check (auth.uid() = user_id);

create policy "votes_update" on public.votes
  for update using (auth.uid() = user_id);

create policy "votes_delete" on public.votes
  for delete using (auth.uid() = user_id);

-- vote_dates (select all, insert/delete through own vote)
create policy "vote_dates_select" on public.vote_dates
  for select using (auth.uid() is not null);

create policy "vote_dates_insert" on public.vote_dates
  for insert with check (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

create policy "vote_dates_delete" on public.vote_dates
  for delete using (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

-- vote_games (select all, insert/delete through own vote)
create policy "vote_games_select" on public.vote_games
  for select using (auth.uid() is not null);

create policy "vote_games_insert" on public.vote_games
  for insert with check (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

create policy "vote_games_delete" on public.vote_games
  for delete using (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

-- survey_reminder_log: no client policies (server-only via service_role)

-- ---------------------------------------------------------------------------
-- 4. Auth trigger: auto-create profile on user signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Polish holidays SQL functions
-- ---------------------------------------------------------------------------

create or replace function public.easter_sunday(p_year int)
returns date
language plpgsql immutable
as $$
declare
  a int; b int; c int; d int; e int;
  f int; g int; h int; i int; k int;
  l int; m int;
  month int; day int;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  month := (h + l - 7 * m + 114) / 31;
  day := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, month, day);
end;
$$;

create or replace function public.polish_holidays(p_year int)
returns table (holiday date)
language plpgsql immutable
as $$
declare
  easter date;
begin
  easter := public.easter_sunday(p_year);

  return query
  values
    (make_date(p_year, 1, 1)),   -- New Year
    (make_date(p_year, 1, 6)),   -- Epiphany
    (make_date(p_year, 5, 1)),   -- Labour Day
    (make_date(p_year, 5, 3)),   -- Constitution Day
    (make_date(p_year, 8, 15)),  -- Assumption
    (make_date(p_year, 11, 1)),  -- All Saints
    (make_date(p_year, 11, 11)), -- Independence Day
    (make_date(p_year, 12, 25)), -- Christmas Day
    (make_date(p_year, 12, 26)), -- 2nd Christmas Day
    (easter),                    -- Easter Sunday
    (easter + 1),                -- Easter Monday
    (easter + 49),               -- Pentecost
    (easter + 60);               -- Corpus Christi
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_consecutive_game_count(game_id)
-- ---------------------------------------------------------------------------

create or replace function public.get_consecutive_game_count(p_game_id uuid)
returns int
language plpgsql stable
as $$
declare
  v_count int := 0;
  rec record;
begin
  for rec in
    select chosen_game_id
    from public.meetings
    where status = 'completed'
    order by number desc
  loop
    if rec.chosen_game_id = p_game_id then
      v_count := v_count + 1;
    else
      exit;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. create_next_survey()
-- ---------------------------------------------------------------------------

create or replace function public.create_next_survey()
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_last_meeting record;
  v_new_meeting_id uuid;
  v_new_number int;
  v_start_date date;
  v_end_date date;
  v_d date;
  v_year int;
  v_holiday record;
begin
  select * into v_last_meeting
  from public.meetings
  where status = 'completed'::public.meeting_status
  order by number desc
  limit 1;

  if v_last_meeting is null then
    v_new_number := 1;
    v_start_date := current_date;
  else
    v_new_number := v_last_meeting.number + 1;
    v_start_date := v_last_meeting.chosen_date + interval '14 days';
    v_start_date := v_start_date + ((6 - extract(dow from v_start_date)::int) % 7) * interval '1 day';
  end if;

  v_end_date := v_start_date + interval '60 days';

  insert into public.meetings (number, status, voting_start_date)
  values (v_new_number, 'voting'::public.meeting_status, current_date)
  returning id into v_new_meeting_id;

  v_d := v_start_date;
  while v_d <= v_end_date loop
    if extract(dow from v_d) in (0, 6) then
      insert into public.date_options (meeting_id, date, is_custom)
      values (v_new_meeting_id, v_d, false)
      on conflict (meeting_id, date) do nothing;
    end if;
    v_d := v_d + interval '1 day';
  end loop;

  for v_year in extract(year from v_start_date)::int .. extract(year from v_end_date)::int loop
    for v_holiday in select holiday from public.polish_holidays(v_year) loop
      if v_holiday.holiday between v_start_date and v_end_date
         and extract(dow from v_holiday.holiday) not in (0, 6) then
        insert into public.date_options (meeting_id, date, is_custom)
        values (v_new_meeting_id, v_holiday.holiday, false)
        on conflict (meeting_id, date) do nothing;
      end if;
    end loop;
  end loop;

  return v_new_meeting_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', false),
  ('game-images', 'game-images', false);

-- Storage policies: authenticated read/write

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars_update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "game_images_select" on storage.objects
  for select using (bucket_id = 'game-images' and auth.uid() is not null);

create policy "game_images_insert" on storage.objects
  for insert with check (bucket_id = 'game-images' and auth.uid() is not null);

create policy "game_images_update" on storage.objects
  for update using (bucket_id = 'game-images' and auth.uid() is not null);

create policy "game_images_delete" on storage.objects
  for delete using (bucket_id = 'game-images' and auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 9. Enable Realtime for meetings table
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.meetings;
