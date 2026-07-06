import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";
import { getGroupMemberIds, getTokensForUsers } from "../_shared/groups.ts";

Deno.serve(async (req) => {
  try {
    const { meetingId } = await req.json();
    if (!meetingId) {
      return Response.json({ error: "meetingId required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: meeting } = await supabase
      .from("meetings")
      .select("group_id")
      .eq("id", meetingId)
      .single();

    if (!meeting?.group_id) {
      return Response.json({ message: "Meeting has no group" });
    }

    const memberIds = await getGroupMemberIds(supabase, meeting.group_id);
    const tokens = await getTokensForUsers(supabase, memberIds);

    if (!tokens.length) {
      return Response.json({ message: "No tokens" });
    }

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: "Nowa ankieta!",
      body: "Nowa ankieta jest gotowa. Zagłosuj!",
      data: { type: "survey", meetingId },
    }));
    await sendPushNotifications(messages);

    // Treat the "new survey" notification as the first reminder so the
    // survey-reminder cron does not send another reminder on the same day.
    // Scoped per (user, group).
    const now = new Date().toISOString();
    const uniqueUserIds = Array.from(new Set(tokens.map((t) => t.user_id)));
    await supabase.from("survey_reminder_log").upsert(
      uniqueUserIds.map((user_id) => ({
        user_id,
        group_id: meeting.group_id,
        sent_at: now,
      })),
    );

    const result = { notified: tokens.length };
    console.log("notify-survey-created", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
