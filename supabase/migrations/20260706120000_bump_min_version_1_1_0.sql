-- =============================================================================
-- Raise the minimum supported app version to 1.1.0 (Phase 1 breaking change)
-- =============================================================================
-- Phase 1 (groups / multi-tenancy) is a breaking backend change: the RLS rewrite
-- requires group membership and meetings/board_games.group_id is now NOT NULL,
-- so a pre-1.1.0 install can no longer create games or approve meetings against
-- the migrated schema. Once the 1.1.0 build is live on the tracks, this locks out
-- older native clients with the "Update required" screen instead of letting them
-- fail silently. Web is exempt (always current on Vercel) and never reads this.
--
-- Ordering: publish the 1.1.0 build to a track BEFORE applying this on PROD, so an
-- updatable build already exists when old installs get gated. See
-- docs/groups-setup.md ("Release ordering").
-- =============================================================================

update public.app_config
set min_version = '1.1.0',
    updated_at = now()
where platform in ('android', 'ios');
