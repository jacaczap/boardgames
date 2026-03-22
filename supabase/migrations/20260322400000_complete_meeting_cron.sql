-- Cron: complete-meeting daily at 06:00 UTC
-- Marks approved meetings whose chosen_date has passed as 'completed'

select cron.schedule(
  'complete-meeting-daily',
  '0 6 * * *',
  $$select extensions.invoke_edge_function('complete-meeting');$$
);
