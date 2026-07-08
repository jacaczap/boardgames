-- =============================================================================
-- Phase 1: UGC moderation — content reports, user blocks, admin notify
-- =============================================================================
-- Play's user-generated-content policy requires an in-app way to report content,
-- block another user, and an admin takedown path once strangers can join groups.
--
-- Two tables:
--   * content_reports — a member flags a game / member / group; group admins
--     review and resolve. Admin takedown reuses the existing admin powers
--     (delete a board_game, remove a member) — no new destructive RPC needed.
--   * user_blocks — a user hides another user's identity for themselves. Block
--     state is per-user (only the blocker sees their own list); the UI masks the
--     blocked user's name/avatar everywhere via UserAvatar.
--
-- A trigger pushes new reports to the group's admins (notify-content-reported).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. content_reports
-- ---------------------------------------------------------------------------

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  content_type text not null check (content_type in ('board_game', 'profile', 'group')),
  content_id text not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_content_reports_group_status
  on public.content_reports (group_id, status);

grant select, insert, update, delete on public.content_reports to authenticated, service_role;

alter table public.content_reports enable row level security;

-- A member reports content within a group they belong to (as themselves).
create policy "content_reports_insert" on public.content_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid() and public.is_group_member(group_id)
  );

-- Reporters see their own reports; group admins see all reports for their group.
create policy "content_reports_select" on public.content_reports
  for select to authenticated
  using (
    reporter_id = auth.uid() or public.is_group_admin(group_id)
  );

-- Only admins resolve/dismiss reports.
create policy "content_reports_update" on public.content_reports
  for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "content_reports_delete" on public.content_reports
  for delete to authenticated
  using (public.is_group_admin(group_id));

-- Rate limit report creation to curb abuse.
create or replace function public.enforce_content_reports_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_rate_limit('content_report_insert', 20, interval '1 hour');
  return new;
end;
$$;

create trigger trg_enforce_content_reports_limits
  before insert on public.content_reports
  for each row execute function public.enforce_content_reports_limits();

-- ---------------------------------------------------------------------------
-- 2. user_blocks
-- ---------------------------------------------------------------------------

create table public.user_blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

grant select, insert, delete on public.user_blocks to authenticated, service_role;

alter table public.user_blocks enable row level security;

-- A user manages only their own block list and can only see their own blocks.
create policy "user_blocks_select" on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

create policy "user_blocks_insert" on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "user_blocks_delete" on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

create or replace function public.enforce_user_blocks_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_rate_limit('user_block_insert', 60, interval '1 hour');
  return new;
end;
$$;

create trigger trg_enforce_user_blocks_limits
  before insert on public.user_blocks
  for each row execute function public.enforce_user_blocks_limits();

-- ---------------------------------------------------------------------------
-- 3. Notify group admins of a new report
-- ---------------------------------------------------------------------------

create or replace function public.notify_content_reported()
returns trigger
language plpgsql
security definer
as $$
begin
  perform extensions.invoke_edge_function(
    'notify-content-reported',
    jsonb_build_object('reportId', NEW.id)
  );
  return NEW;
end;
$$;

create trigger on_content_report_notify
  after insert on public.content_reports
  for each row
  execute function public.notify_content_reported();
