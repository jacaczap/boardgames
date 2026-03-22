export interface Profile {
  id: string;
  username: string | null;
  name: string | null;
  surname: string | null;
  avatar_url: string | null;
  notification_prior_meeting: number;
  notification_reminder_interval: number;
}

export interface BoardGame {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  min_players: number | null;
  max_players: number | null;
  tutorial_url: string | null;
  spotify_playlist_url: string | null;
  image_url: string | null;
  owners: string[] | null;
}

export type MeetingStatus = "voting" | "approved" | "completed";

export interface Meeting {
  id: string;
  number: number;
  status: MeetingStatus;
  chosen_date: string | null;
  chosen_game_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  voting_start_date: string;
}

export interface DateOption {
  id: string;
  meeting_id: string;
  date: string;
  is_custom: boolean;
  added_by: string | null;
}

export interface Vote {
  id: string;
  meeting_id: string;
  user_id: string;
}

export interface VoteDate {
  vote_id: string;
  date_option_id: string;
}

export interface VoteGame {
  vote_id: string;
  game_id: string;
}

export interface PushToken {
  user_id: string;
  token: string;
  updated_at: string;
}
