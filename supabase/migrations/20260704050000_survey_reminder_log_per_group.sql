-- =============================================================================
-- Phase 1: survey_reminder_log becomes per-user-per-group
-- =============================================================================
-- The survey-reminder cron now runs per group (each group can have its own
-- active survey), so a user must be throttled independently for each group they
-- belong to. The log is ephemeral throttling state, so existing rows are cleared
-- rather than backfilled.
-- =============================================================================

delete from public.survey_reminder_log;

alter table public.survey_reminder_log
  drop constraint survey_reminder_log_pkey;

alter table public.survey_reminder_log
  add column group_id uuid not null references public.groups on delete cascade;

alter table public.survey_reminder_log
  add constraint survey_reminder_log_pkey primary key (user_id, group_id);
