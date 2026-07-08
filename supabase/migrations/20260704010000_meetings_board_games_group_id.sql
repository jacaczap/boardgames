-- =============================================================================
-- Phase 1: attach group_id to the top-level domain entities
-- =============================================================================
-- meetings and board_games are the top-level tenant-owned rows; everything else
-- (date_options / votes / vote_dates / vote_games) derives its group via
-- meeting_id, so no column is needed there.
--
-- group_id is added NULLABLE here so this migration applies cleanly to the
-- existing PROD database that still has ungrouped rows. The one-off data
-- migration (create the default group, backfill these columns) and the
-- follow-up NOT NULL tightening land in a later migration.
--
-- meetings.number becomes per-group, and create_next_survey now takes an
-- explicit p_group_id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. group_id columns
-- ---------------------------------------------------------------------------

alter table public.board_games
  add column group_id uuid references public.groups on delete cascade;

alter table public.meetings
  add column group_id uuid references public.groups on delete cascade;

create index idx_board_games_group on public.board_games (group_id);
create index idx_meetings_group on public.meetings (group_id);

-- ---------------------------------------------------------------------------
-- 2. Per-group meeting number
-- ---------------------------------------------------------------------------

drop index public.idx_meetings_number;
create unique index idx_meetings_group_number on public.meetings (group_id, number);

-- ---------------------------------------------------------------------------
-- 3. create_next_survey(p_group_id)
-- ---------------------------------------------------------------------------
-- Scoped per group: numbering, the "active survey already exists" guard and the
-- inserted rows all key off p_group_id. Old zero-arg version is dropped (adding
-- a parameter would otherwise leave an unused overload behind).

drop function if exists public.create_next_survey();

create or replace function public.create_next_survey(p_group_id uuid)
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
    and group_id = p_group_id
  order by number desc
  limit 1;

  if v_last_meeting is null then
    v_new_number := 1;
  else
    v_new_number := v_last_meeting.number + 1;
  end if;

  v_start_date := current_date + 1;

  if exists (
    select 1 from public.meetings
    where status in ('voting'::public.meeting_status, 'approved'::public.meeting_status)
      and group_id = p_group_id
  ) then
    raise exception 'An active survey or approved meeting already exists';
  end if;

  v_end_date := v_start_date + interval '60 days';

  insert into public.meetings (group_id, number, status, voting_start_date)
  values (p_group_id, v_new_number, 'voting'::public.meeting_status, current_date)
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

grant execute on function public.create_next_survey(uuid) to authenticated, service_role;
