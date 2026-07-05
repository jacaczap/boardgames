-- =============================================================================
-- Phase 1: groups, group_members, group_invites + membership helper functions
-- =============================================================================
-- First multi-tenancy building block. Adds the group tables and the SECURITY
-- DEFINER helpers (is_group_member / is_group_admin / can_approve) used by RLS
-- across the app. The helpers are DEFINER so policies on group_members can call
-- them without recursing into group_members' own RLS.
-- Attaching group_id to board_games/meetings, the domain-policy rewrite, abuse
-- limit triggers and the data migration land in later migrations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create type public.group_role as enum ('admin', 'approver', 'member');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles on delete set null,
  tier text not null default 'free',
  member_limit int not null default 5,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Per-group, multi-use invite link: one code many friends open within 3 days.
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  code text not null unique,
  expires_at timestamptz not null default now() + interval '3 days',
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create index idx_group_members_user on public.group_members (user_id);
create index idx_group_invites_group on public.group_invites (group_id);

-- ---------------------------------------------------------------------------
-- 2. Grants (Data API access; RLS below enforces the real limits)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.groups         to authenticated, service_role;
grant select, insert, update, delete on public.group_members  to authenticated, service_role;
grant select, insert, update, delete on public.group_invites  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Membership helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- Admin implies approver rights.
create or replace function public.can_approve(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and role in ('admin', 'approver')
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated, service_role;
grant execute on function public.is_group_admin(uuid)  to authenticated, service_role;
grant execute on function public.can_approve(uuid)     to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- groups: members read; anyone authenticated creates (as themselves); admins
-- manage. Abuse limits (max free groups per user) come as triggers later.
create policy "groups_select" on public.groups
  for select to authenticated
  using (public.is_group_member(id));

create policy "groups_insert" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "groups_update" on public.groups
  for update to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups_delete" on public.groups
  for delete to authenticated
  using (public.is_group_admin(id));

-- group_members: members see co-members; a user adds their own membership
-- (group creation bootstrap + invite join) or an admin adds/edits; users can
-- leave, admins can remove.
create policy "group_members_select" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "group_members_insert" on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_group_admin(group_id));

create policy "group_members_update" on public.group_members
  for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "group_members_delete" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

-- group_invites: members see their group's invites; admins create/revoke.
-- Looking up a group by code before joining will use a SECURITY DEFINER RPC
-- (added with the invite-join flow), so no non-member select policy here.
create policy "group_invites_select" on public.group_invites
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "group_invites_insert" on public.group_invites
  for insert to authenticated
  with check (public.is_group_admin(group_id));

create policy "group_invites_delete" on public.group_invites
  for delete to authenticated
  using (public.is_group_admin(group_id));
