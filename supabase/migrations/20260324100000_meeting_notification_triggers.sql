-- =============================================================================
-- Trigger-based notifications: invoke edge functions on meetings changes
-- =============================================================================
-- Uses extensions.invoke_edge_function (defined in 20260322300000) which calls
-- pg_net + Vault secrets to POST to the edge function asynchronously.

create or replace function public.notify_meeting_change()
returns trigger
language plpgsql
security definer
as $$
begin
  -- New survey created (INSERT with status 'voting')
  if TG_OP = 'INSERT' and NEW.status = 'voting' then
    perform extensions.invoke_edge_function(
      'notify-survey-created',
      jsonb_build_object('meetingId', NEW.id)
    );
  end if;

  -- Meeting approved (UPDATE status → 'approved')
  if TG_OP = 'UPDATE'
     and NEW.status = 'approved'
     and OLD.status is distinct from 'approved'
  then
    perform extensions.invoke_edge_function(
      'notify-meeting-approved',
      jsonb_build_object('meetingId', NEW.id)
    );
  end if;

  -- Meeting unapproved (UPDATE status 'approved' → 'voting')
  if TG_OP = 'UPDATE'
     and OLD.status = 'approved'
     and NEW.status = 'voting'
  then
    perform extensions.invoke_edge_function(
      'notify-meeting-unapproved',
      jsonb_build_object('meetingId', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

create trigger on_meeting_notify
  after insert or update on public.meetings
  for each row
  execute function public.notify_meeting_change();
