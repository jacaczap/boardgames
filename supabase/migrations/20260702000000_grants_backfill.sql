-- =============================================================================
-- Grants backfill for existing public tables
-- =============================================================================
-- New Supabase projects (default 2026-05-30, all projects 2026-10-30) no longer
-- auto-grant Data API access to tables in `public`. RLS is unchanged, but a
-- table is invisible to supabase-js / PostgREST unless it also has GRANTs.
-- The original schema (20260322000000_initial_schema.sql) enabled RLS but never
-- granted, so recreating it on a fresh project makes every table return 42501.
-- This migration backfills grants for all pre-existing tables. New tables must
-- follow .cursor/rules/supabase-migrations.mdc (grants included inline).
-- =============================================================================

-- Client-facing tables: authenticated does CRUD (RLS enforces the real limits),
-- service_role bypasses RLS for edge functions.
grant select, insert, update, delete on public.profiles           to authenticated, service_role;
grant select, insert, update, delete on public.push_tokens        to authenticated, service_role;
grant select, insert, update, delete on public.board_games        to authenticated, service_role;
grant select, insert, update, delete on public.meetings           to authenticated, service_role;
grant select, insert, update, delete on public.date_options       to authenticated, service_role;
grant select, insert, update, delete on public.votes              to authenticated, service_role;
grant select, insert, update, delete on public.vote_dates         to authenticated, service_role;
grant select, insert, update, delete on public.vote_games         to authenticated, service_role;

-- Server-only table (no client policies): service_role only.
grant select, insert, update, delete on public.survey_reminder_log to service_role;

-- RPCs called from the client. Postgres grants EXECUTE to PUBLIC by default, but
-- make it explicit so a stricter default can't silently break these calls.
grant execute on function public.get_consecutive_game_count(uuid) to authenticated, service_role;
grant execute on function public.create_next_survey()             to authenticated, service_role;
