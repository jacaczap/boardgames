-- =============================================================================
-- Phase 1: onboarding + invite-join RPCs
-- =============================================================================
-- SECURITY DEFINER helpers behind the "create a group / join via invite" flows:
--   * create_group        — atomically create a group + add the caller as admin.
--   * preview_group_by_code — read a group's name from an invite code without
--                             joining (used by the join screen; callable while
--                             logged out so the link shows the group name first).
--   * join_group_by_code  — validate an invite code (existence + expiry) and add
--                           the caller as a member.
--
-- All three run as DEFINER so they can bypass the group tables' own RLS, but the
-- anti-flooding triggers (rate limits, member_limit, 3-free-groups cap) still
-- fire on the INSERTs, and auth.uid() still resolves to the caller — so limits
-- are enforced exactly as for a direct insert.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- create_group(name) -> new group id
-- ---------------------------------------------------------------------------
create or replace function public.create_group(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Group name is required' using errcode = 'check_violation';
  end if;

  insert into public.groups (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'admin');

  return v_group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- preview_group_by_code(code) -> (group_id, group_name, expired)
-- ---------------------------------------------------------------------------
-- Empty result = code not found. Callable by anon so the join link can show the
-- group name before the user registers/logs in.
create or replace function public.preview_group_by_code(p_code text)
returns table (group_id uuid, group_name text, expired boolean)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, (gi.expires_at <= now())
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.code = p_code
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- join_group_by_code(code) -> joined group id
-- ---------------------------------------------------------------------------
create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select gi.expires_at, gi.group_id into v_invite
  from public.group_invites gi
  where gi.code = p_code
  limit 1;

  if not found then
    raise exception 'Invalid invite code' using errcode = 'no_data_found';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'This invite link has expired' using errcode = 'check_violation';
  end if;

  -- Idempotent: opening the link again as an existing member just returns it.
  if exists (
    select 1 from public.group_members
    where group_id = v_invite.group_id and user_id = v_uid
  ) then
    return v_invite.group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_uid, 'member');

  return v_invite.group_id;
end;
$$;

grant execute on function public.create_group(text)          to authenticated;
grant execute on function public.preview_group_by_code(text) to anon, authenticated;
grant execute on function public.join_group_by_code(text)    to authenticated;
