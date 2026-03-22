import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: activeMeeting } = await supabase
      .from("meetings")
      .select("id, number")
      .eq("status", "voting")
      .order("number", { ascending: false })
      .limit(1)
      .single();

    if (!activeMeeting) {
      return Response.json({ message: "No active survey" });
    }

    const { data: existingVotes } = await supabase
      .from("votes")
      .select("user_id")
      .eq("meeting_id", activeMeeting.id);

    const votedUserIds = new Set(
      (existingVotes ?? []).map((v) => v.user_id),
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, notification_reminder_interval");

    if (!profiles?.length) {
      return Response.json({ message: "No profiles" });
    }

    const nonVoters = profiles.filter((p) => !votedUserIds.has(p.id));
    if (!nonVoters.length) {
      return Response.json({ message: "Everyone voted" });
    }

    const { data: reminderLogs } = await supabase
      .from("survey_reminder_log")
      .select("user_id, sent_at")
      .in(
        "user_id",
        nonVoters.map((p) => p.id),
      );

    const logMap = new Map(
      (reminderLogs ?? []).map((l) => [l.user_id, new Date(l.sent_at)]),
    );
    const now = new Date();

    const usersToRemind = nonVoters.filter((p) => {
      const lastSent = logMap.get(p.id);
      if (!lastSent) return true;
      const daysSince =
        (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= p.notification_reminder_interval;
    });

    if (!usersToRemind.length) {
      return Response.json({ message: "No reminders needed" });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, token")
      .in(
        "user_id",
        usersToRemind.map((p) => p.id),
      );

    if (tokens?.length) {
      const messages: PushMessage[] = tokens.map((t) => ({
        to: t.token,
        title: "Don't forget to vote!",
        body: `Survey #${activeMeeting.number} is waiting for your vote.`,
        data: { type: "survey", meetingId: activeMeeting.id },
      }));
      await sendPushNotifications(messages);
    }

    for (const user of usersToRemind) {
      await supabase
        .from("survey_reminder_log")
        .upsert({ user_id: user.id, sent_at: now.toISOString() });
    }

    return Response.json({ reminded: usersToRemind.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
