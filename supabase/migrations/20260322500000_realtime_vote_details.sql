-- Add vote_dates, vote_games, and date_options to Realtime publication
-- so that survey and approve screen Realtime subscriptions actually fire.

ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.date_options;
