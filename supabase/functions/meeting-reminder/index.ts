import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";
import { getGroupName } from "../_shared/groups.ts";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: approvedMeetings } = await supabase
      .from("meetings")
      .select("id, number, chosen_date, chosen_game_id, group_id")
      .eq("status", "approved");

    if (!approvedMeetings?.length) {
      return Response.json({ message: "No approved meetings" });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let totalNotified = 0;

    for (const meeting of approvedMeetings) {
      if (!meeting.chosen_date) continue;

      const meetingDate = new Date(meeting.chosen_date + "T00:00:00Z");
      const daysUntil = Math.round(
        (meetingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntil < 0) continue;

      const { data: dateOpt } = await supabase
        .from("date_options")
        .select("id")
        .eq("meeting_id", meeting.id)
        .eq("date", meeting.chosen_date)
        .single();

      if (!dateOpt) continue;

      const { data: voteDates } = await supabase
        .from("vote_dates")
        .select("vote_id")
        .eq("date_option_id", dateOpt.id);

      if (!voteDates?.length) continue;

      const { data: votes } = await supabase
        .from("votes")
        .select("user_id")
        .in(
          "id",
          voteDates.map((vd) => vd.vote_id),
        );

      if (!votes?.length) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, notification_prior_meeting")
        .in(
          "id",
          votes.map((v) => v.user_id),
        );

      // Exact match: notify only when daysUntil == user's setting, so each user
      // gets notified exactly once without needing a log table.
      const eligibleUserIds = (profiles ?? [])
        .filter((p) => daysUntil === p.notification_prior_meeting)
        .map((p) => p.id);

      if (!eligibleUserIds.length) continue;

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", eligibleUserIds);

      if (tokens?.length) {
        const daysText =
          daysUntil === 0
            ? "dzisiaj"
            : daysUntil === 1
              ? "jutro"
              : `za ${daysUntil} dni`;

        const groupName = meeting.group_id
          ? await getGroupName(supabase, meeting.group_id)
          : "";
        const groupPart = groupName ? ` w grupie ${groupName}` : "";

        const messages: PushMessage[] = tokens.map((t) => ({
          to: t.token,
          title: "Przypomnienie o spotkaniu",
          body: `Spotkanie planszówkowe #${meeting.number}${groupPart} jest ${daysText}!`,
          data: { type: "meeting", meetingId: meeting.id },
        }));
        await sendPushNotifications(messages);
        totalNotified += tokens.length;
      }
    }

    const result = { notified: totalNotified };
    console.log("meeting-reminder", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
