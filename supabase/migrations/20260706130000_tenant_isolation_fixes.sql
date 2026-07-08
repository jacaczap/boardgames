-- =============================================================================
-- Tenant-isolation hardening
-- =============================================================================
-- Two gaps in the membership-scoped RLS model:
--
-- 1. create_next_survey(p_group_id) is SECURITY DEFINER and granted to
--    authenticated, so DEFINER execution bypasses the meetings_insert RLS
--    (which requires is_group_member). It never verified the caller belongs to
--    p_group_id, letting any authenticated user inject a survey into a foreign
--    group. Add an explicit membership check. Service-role callers (the
--    create-survey cron) have a null auth.uid() and are trusted, so they skip
--    the check.
--
-- 2. The votes_update policy only checked user_id = auth.uid(). Because
--    meeting_id is not immutable, a user could repoint their own vote at a
--    meeting in a group they don't belong to. Add the same
--    is_group_member_of_meeting(meeting_id) guard votes_insert already uses.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. create_next_survey: enforce caller group membership
-- ---------------------------------------------------------------------------

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
  -- Authenticated callers must belong to the group; service_role (cron) has a
  -- null auth.uid() and is trusted.
  if auth.uid() is not null and not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

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

-- ---------------------------------------------------------------------------
-- 2. votes_update: require group membership on the (mutable) meeting_id
-- ---------------------------------------------------------------------------

drop policy if exists "votes_update" on public.votes;

create policy "votes_update" on public.votes
  for update to authenticated
  using (user_id = auth.uid() and public.is_group_member_of_meeting(meeting_id))
  with check (user_id = auth.uid() and public.is_group_member_of_meeting(meeting_id));
