-- =============================================================================
-- Phase 1: membership-scoped domain RLS + anti-flooding triggers
-- =============================================================================
-- Rewrites every domain policy from the old "any authenticated user" rule to a
-- group-membership rule, and adds the abuse-limit layer (member limits, free
-- group cap, per-group/per-meeting row caps, per-user insert rate limits).
--
-- Membership resolution:
--   * board_games / meetings carry group_id directly.
--   * date_options / votes / vote_dates / vote_games derive their group via
--     meeting_id, so SECURITY DEFINER helpers walk that chain (and bypass the
--     helper tables' own RLS to avoid recursion).
--
-- Approval (meetings UPDATE) is gated by can_approve() — admins/approvers only —
-- matching the role model from the groups schema. Regular members vote but no
-- longer approve/unapprove; the UI must hide those actions for non-approvers.
--
-- NOTE: group_id is still nullable on legacy PROD rows until the one-off data
-- migration backfills it. Until then membership helpers return false for those
-- rows (is_group_member(null) = false), so they are hidden — the data migration
-- runs in the same deploy and makes them visible again.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Membership helper functions (SECURITY DEFINER to bypass RLS / recursion)
-- ---------------------------------------------------------------------------

-- Does the current user share at least one group with p_user_id? (Includes the
-- caller only if they are actually co-members; own-profile access is handled
-- separately in the profiles_select policy.)
create or replace function public.shares_group(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
      and gm2.user_id = p_user_id
  );
$$;

create or replace function public.is_group_member_of_meeting(p_meeting_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.meetings m
    join public.group_members gm on gm.group_id = m.group_id
    where m.id = p_meeting_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_member_of_vote(p_vote_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.votes v
    join public.meetings m on m.id = v.meeting_id
    join public.group_members gm on gm.group_id = m.group_id
    where v.id = p_vote_id
      and gm.user_id = auth.uid()
  );
$$;

grant execute on function public.shares_group(uuid)               to authenticated, service_role;
grant execute on function public.is_group_member_of_meeting(uuid) to authenticated, service_role;
grant execute on function public.is_group_member_of_vote(uuid)    to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Rewrite domain RLS policies (membership-scoped)
-- ---------------------------------------------------------------------------

-- profiles: read own profile + profiles of users sharing a group with me.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group(id));

-- board_games: scoped to the game's group.
drop policy if exists "board_games_select" on public.board_games;
drop policy if exists "board_games_insert" on public.board_games;
drop policy if exists "board_games_update" on public.board_games;
drop policy if exists "board_games_delete" on public.board_games;

create policy "board_games_select" on public.board_games
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "board_games_insert" on public.board_games
  for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "board_games_update" on public.board_games
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "board_games_delete" on public.board_games
  for delete to authenticated
  using (public.is_group_member(group_id));

-- meetings: members read; approval (UPDATE) restricted to approvers/admins.
drop policy if exists "meetings_select" on public.meetings;
drop policy if exists "meetings_insert" on public.meetings;
drop policy if exists "meetings_update" on public.meetings;

create policy "meetings_select" on public.meetings
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "meetings_insert" on public.meetings
  for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "meetings_update" on public.meetings
  for update to authenticated
  using (public.can_approve(group_id))
  with check (public.can_approve(group_id));

-- date_options: scoped to the meeting's group.
drop policy if exists "date_options_select" on public.date_options;
drop policy if exists "date_options_insert" on public.date_options;
drop policy if exists "date_options_update" on public.date_options;

create policy "date_options_select" on public.date_options
  for select to authenticated
  using (public.is_group_member_of_meeting(meeting_id));

create policy "date_options_insert" on public.date_options
  for insert to authenticated
  with check (public.is_group_member_of_meeting(meeting_id));

create policy "date_options_update" on public.date_options
  for update to authenticated
  using (public.is_group_member_of_meeting(meeting_id))
  with check (public.is_group_member_of_meeting(meeting_id));

-- votes: members read; a user manages only their own vote within their group.
drop policy if exists "votes_select" on public.votes;
drop policy if exists "votes_insert" on public.votes;
drop policy if exists "votes_update" on public.votes;
drop policy if exists "votes_delete" on public.votes;

create policy "votes_select" on public.votes
  for select to authenticated
  using (public.is_group_member_of_meeting(meeting_id));

create policy "votes_insert" on public.votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member_of_meeting(meeting_id));

create policy "votes_update" on public.votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "votes_delete" on public.votes
  for delete to authenticated
  using (user_id = auth.uid());

-- vote_dates: read within group; write only through an owned vote.
drop policy if exists "vote_dates_select" on public.vote_dates;
drop policy if exists "vote_dates_insert" on public.vote_dates;
drop policy if exists "vote_dates_delete" on public.vote_dates;

create policy "vote_dates_select" on public.vote_dates
  for select to authenticated
  using (public.is_group_member_of_vote(vote_id));

create policy "vote_dates_insert" on public.vote_dates
  for insert to authenticated
  with check (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

create policy "vote_dates_delete" on public.vote_dates
  for delete to authenticated
  using (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

-- vote_games: read within group; write only through an owned vote.
drop policy if exists "vote_games_select" on public.vote_games;
drop policy if exists "vote_games_insert" on public.vote_games;
drop policy if exists "vote_games_delete" on public.vote_games;

create policy "vote_games_select" on public.vote_games
  for select to authenticated
  using (public.is_group_member_of_vote(vote_id));

create policy "vote_games_insert" on public.vote_games
  for insert to authenticated
  with check (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

create policy "vote_games_delete" on public.vote_games
  for delete to authenticated
  using (
    exists (select 1 from public.votes where id = vote_id and user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Per-user insert rate limiting
-- ---------------------------------------------------------------------------
-- A tiny log of recent inserts per (user, action). check_rate_limit() prunes
-- expired rows, counts what's left in the window and raises if over the cap.
-- Skipped when auth.uid() is null (service_role / cron / edge functions), so
-- backend bulk work is never throttled.

create table public.rate_limit_log (
  user_id uuid not null references public.profiles on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_log_lookup
  on public.rate_limit_log (user_id, action, created_at);

-- Server-only table: written exclusively via the SECURITY DEFINER function.
grant select, insert, delete on public.rate_limit_log to service_role;

alter table public.rate_limit_log enable row level security;
-- No policies: no direct client access.

create or replace function public.check_rate_limit(
  p_action text,
  p_max int,
  p_window interval
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return;
  end if;

  delete from public.rate_limit_log
  where user_id = v_uid
    and action = p_action
    and created_at < now() - p_window;

  select count(*) into v_count
  from public.rate_limit_log
  where user_id = v_uid
    and action = p_action;

  if v_count >= p_max then
    raise exception 'Rate limit exceeded: too many % actions, slow down.', p_action
      using errcode = 'check_violation';
  end if;

  insert into public.rate_limit_log (user_id, action)
  values (v_uid, p_action);
end;
$$;

grant execute on function public.check_rate_limit(text, int, interval) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Anti-flooding triggers
-- ---------------------------------------------------------------------------
-- All trigger functions are SECURITY DEFINER so their COUNT()s bypass RLS and
-- see the true totals regardless of the caller's visibility.

-- group_members: enforce the group's member_limit and the 3-free-groups cap.
create or replace function public.enforce_group_member_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tier text;
  v_limit int;
  v_count int;
  v_free_count int;
begin
  select tier, member_limit into v_tier, v_limit
  from public.groups
  where id = new.group_id;

  select count(*) into v_count
  from public.group_members
  where group_id = new.group_id;

  if v_count >= v_limit then
    raise exception 'Group member limit reached (%).', v_limit
      using errcode = 'check_violation';
  end if;

  if v_tier = 'free' then
    select count(*) into v_free_count
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = new.user_id
      and g.tier = 'free';

    if v_free_count >= 3 then
      raise exception 'You already belong to the maximum number of free groups (3).'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_group_member_limits
  before insert on public.group_members
  for each row execute function public.enforce_group_member_limits();

-- board_games: per-group cap + per-user insert rate limit.
create or replace function public.enforce_board_games_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.group_id is not null then
    if (select count(*) from public.board_games where group_id = new.group_id) >= 1000 then
      raise exception 'Game limit reached for this group.'
        using errcode = 'check_violation';
    end if;
  end if;

  perform public.check_rate_limit('board_games_insert', 30, interval '1 minute');
  return new;
end;
$$;

create trigger trg_enforce_board_games_limits
  before insert on public.board_games
  for each row execute function public.enforce_board_games_limits();

-- date_options: per-meeting cap + rate limit on user-added (custom) dates only.
-- Auto-generated weekend/holiday rows (is_custom = false, inserted in bulk by
-- create_next_survey) skip the rate limit but still count toward the cap.
create or replace function public.enforce_date_options_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.date_options where meeting_id = new.meeting_id) >= 300 then
    raise exception 'Date option limit reached for this meeting.'
      using errcode = 'check_violation';
  end if;

  if new.is_custom then
    perform public.check_rate_limit('date_option_insert', 30, interval '1 minute');
  end if;

  return new;
end;
$$;

create trigger trg_enforce_date_options_limits
  before insert on public.date_options
  for each row execute function public.enforce_date_options_limits();

-- votes: per-user insert rate limit.
create or replace function public.enforce_votes_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_rate_limit('vote_insert', 30, interval '1 minute');
  return new;
end;
$$;

create trigger trg_enforce_votes_limits
  before insert on public.votes
  for each row execute function public.enforce_votes_limits();

-- groups: per-user creation rate limit (complements the 3-free-groups cap).
create or replace function public.enforce_groups_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_rate_limit('group_insert', 5, interval '10 minutes');
  return new;
end;
$$;

create trigger trg_enforce_groups_limits
  before insert on public.groups
  for each row execute function public.enforce_groups_limits();

-- group_invites: per-user creation rate limit.
create or replace function public.enforce_group_invites_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_rate_limit('group_invite_insert', 10, interval '10 minutes');
  return new;
end;
$$;

create trigger trg_enforce_group_invites_limits
  before insert on public.group_invites
  for each row execute function public.enforce_group_invites_limits();
