-- =============================================================================
-- Phase 1: server-side invite creation RPC
-- =============================================================================
-- create_group_invite generates the invite code inside the database instead of
-- trusting the client to pick one. Runs as DEFINER (like the other group RPCs)
-- so it can insert into group_invites, but:
--   * it explicitly checks is_group_admin() — only admins create invites, same
--     as the group_invites_insert RLS policy;
--   * auth.uid() still resolves to the caller, so the per-user rate-limit trigger
--     (enforce_group_invites_limits) still fires exactly as for a direct insert.
-- expires_at keeps the table default (now + 3 days).
-- =============================================================================

create or replace function public.create_group_invite(p_group_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- Unambiguous alphabet (no 0/O/1/I/L) for codes that are easy to read/type.
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_attempt int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'Only group admins can create invites'
      using errcode = 'insufficient_privilege';
  end if;

  -- Retry on the astronomically unlikely code collision.
  for v_attempt in 1..5 loop
    v_code := '';
    for v_i in 1..10 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::int,
        1
      );
    end loop;

    begin
      return query
      insert into public.group_invites (group_id, code, created_by)
      values (p_group_id, v_code, v_uid)
      returning group_invites.code, group_invites.expires_at;
      return;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  raise exception 'Could not generate a unique invite code';
end;
$$;

grant execute on function public.create_group_invite(uuid) to authenticated;
