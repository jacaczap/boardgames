-- Guard against NULL chosen_date on last completed meeting in create_next_survey()
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

    if v_last_meeting.chosen_date is null then
      v_start_date := current_date;
    else
      v_start_date := v_last_meeting.chosen_date + interval '14 days';
      v_start_date := v_start_date + ((6 - extract(dow from v_start_date)::int) % 7) * interval '1 day';
    end if;
  end if;

  if exists (
    select 1 from public.meetings
    where status in ('voting'::public.meeting_status, 'approved'::public.meeting_status)
  ) then
    raise exception 'An active survey or approved meeting already exists';
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
