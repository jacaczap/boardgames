-- =============================================================================
-- Delete a departing member's votes for still-open (voting) meetings
-- =============================================================================
-- Removing a group_members row left orphaned vote rows behind (votes reference
-- profiles, not group_members), which inflated the "x/y voted" tallies. We only
-- touch meetings still in 'voting' status so completed/approved history and
-- stats stay intact. vote_dates / vote_games cascade off votes.
-- SECURITY DEFINER so the cleanup bypasses RLS.
-- =============================================================================

create or replace function public.delete_votes_on_group_leave()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.votes v
  using public.meetings m
  where v.meeting_id = m.id
    and v.user_id = old.user_id
    and m.group_id = old.group_id
    and m.status = 'voting'::public.meeting_status;
  return old;
end;
$$;

create trigger trg_delete_votes_on_group_leave
  after delete on public.group_members
  for each row execute function public.delete_votes_on_group_leave();

-- One-off: purge votes already orphaned by past removals, on open meetings only.
delete from public.votes v
using public.meetings m
where v.meeting_id = m.id
  and m.status = 'voting'::public.meeting_status
  and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = m.group_id
      and gm.user_id = v.user_id
  );
