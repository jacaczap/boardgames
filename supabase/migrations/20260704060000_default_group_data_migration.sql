-- =============================================================================
-- Phase 1: one-off data migration — fold legacy single-tenant data into a
-- default group
-- =============================================================================
-- The existing PROD database predates multi-tenancy: board_games / meetings have
-- a nullable group_id (added in 20260704010000) and profiles have no
-- memberships. This migration creates one "default" group and attaches all of
-- that legacy data to it, so the app keeps working after the RLS rewrite (which
-- hides ungrouped rows).
--
-- The default group is premium / 20-member limit, with the app owner as admin
-- (earliest-registered user) and every existing profile as a member. Admin and
-- tier can be adjusted afterwards via group management — see
-- docs/groups-setup.md.
--
-- Runs only on a legacy DB (profiles exist, no groups yet). On a fresh project
-- (DEV) there is nothing to migrate, so it is a no-op. After backfilling,
-- group_id is tightened to NOT NULL — every future insert always carries a group
-- (RLS requires membership on a concrete group_id), so no ungrouped rows can be
-- created again.
-- =============================================================================

do $$
declare
  v_group_id uuid;
  v_admin uuid;
begin
  if not exists (select 1 from public.profiles)
     or exists (select 1 from public.groups) then
    return;
  end if;

  -- App owner = earliest-registered account.
  select p.id into v_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  order by u.created_at asc
  limit 1;

  insert into public.groups (name, created_by, tier, member_limit)
  values ('Planszówki', v_admin, 'premium', 20)
  returning id into v_group_id;

  -- Bulk member backfill: the member_limit / free-group triggers guard normal
  -- joins, but this intentional one-off import must not be capped, so disable it
  -- for the insert only.
  alter table public.group_members disable trigger trg_enforce_group_member_limits;

  insert into public.group_members (group_id, user_id, role)
  select v_group_id,
         p.id,
         case when p.id = v_admin then 'admin' else 'member' end::public.group_role
  from public.profiles p;

  alter table public.group_members enable trigger trg_enforce_group_member_limits;

  update public.board_games set group_id = v_group_id where group_id is null;
  update public.meetings     set group_id = v_group_id where group_id is null;
end;
$$;

-- Tighten now that all legacy rows are grouped and future inserts always set it.
alter table public.board_games alter column group_id set not null;
alter table public.meetings    alter column group_id set not null;
