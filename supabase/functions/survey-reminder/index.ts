import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";
import {
  getGroupMemberIds,
  getGroupName,
  getTokensForUsers,
} from "../_shared/groups.ts";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: activeSurveys } = await supabase
      .from("meetings")
      .select("id, number, group_id")
      .eq("status", "voting");

    if (!activeSurveys?.length) {
      return Response.json({ message: "No active surveys" });
    }

    const now = new Date();
    let totalReminded = 0;

    for (const survey of activeSurveys) {
      if (!survey.group_id) continue;

      const memberIds = await getGroupMemberIds(supabase, survey.group_id);
      if (!memberIds.length) continue;

      const { data: existingVotes } = await supabase
        .from("votes")
        .select("user_id")
        .eq("meeting_id", survey.id);

      const votedUserIds = new Set((existingVotes ?? []).map((v) => v.user_id));
      const nonVoterIds = memberIds.filter((id) => !votedUserIds.has(id));
      if (!nonVoterIds.length) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, notification_reminder_interval")
        .in("id", nonVoterIds);

      if (!profiles?.length) continue;

      const { data: reminderLogs } = await supabase
        .from("survey_reminder_log")
        .select("user_id, sent_at")
        .eq("group_id", survey.group_id)
        .in(
          "user_id",
          profiles.map((p) => p.id),
        );

      const logMap = new Map(
        (reminderLogs ?? []).map((l) => [l.user_id, new Date(l.sent_at)]),
      );

      const usersToRemind = profiles.filter((p) => {
        const lastSent = logMap.get(p.id);
        if (!lastSent) return true;
        const daysSince =
          (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= p.notification_reminder_interval;
      });

      if (!usersToRemind.length) continue;

      const tokens = await getTokensForUsers(
        supabase,
        usersToRemind.map((p) => p.id),
      );

      if (tokens.length) {
        const groupName = await getGroupName(supabase, survey.group_id);
        const groupPart = groupName ? ` w grupie ${groupName}` : "";
        const messages: PushMessage[] = tokens.map((t) => ({
          to: t.token,
          title: "Nie zapomnij zagłosować!",
          body: `Ankieta #${survey.number}${groupPart} czeka na Twój głos.`,
          data: { type: "survey", meetingId: survey.id },
        }));
        await sendPushNotifications(messages);
      }

      for (const user of usersToRemind) {
        await supabase.from("survey_reminder_log").upsert({
          user_id: user.id,
          group_id: survey.group_id,
          sent_at: now.toISOString(),
        });
      }

      totalReminded += usersToRemind.length;
    }

    const result = { reminded: totalReminded };
    console.log("survey-reminder", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
