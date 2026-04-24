-- =============================================================================
-- Push token registration diagnostics
-- =============================================================================
-- Exposes log_push_token_event() as an RPC that writes to Postgres logs via
-- RAISE LOG. We intentionally do not persist rows: Postgres Logs (Dashboard ->
-- Logs -> Postgres) keep entries for ~24h which is enough for debugging a
-- small-group app, and avoids managing a new table.
-- =============================================================================

create or replace function public.log_push_token_event(
  p_event text,
  p_reason text default null,
  p_platform text default null,
  p_app_state text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  raise log
    'push_token_event user_id=% event=% platform=% app_state=% reason=%',
    v_uid, p_event, coalesce(p_platform, ''), coalesce(p_app_state, ''), coalesce(p_reason, '');
end;
$$;

revoke all on function public.log_push_token_event(text, text, text, text) from public;
grant execute on function public.log_push_token_event(text, text, text, text) to authenticated;
