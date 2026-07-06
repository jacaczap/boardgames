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
      .select("group_id, number, chosen_date, chosen_game_id")
      .eq("id", meetingId)
      .single();

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!meeting.group_id) {
      return Response.json({ message: "Meeting has no group" });
    }

    let gameName = "";
    if (meeting.chosen_game_id) {
      const { data: game } = await supabase
        .from("board_games")
        .select("name")
        .eq("id", meeting.chosen_game_id)
        .single();
      gameName = game?.name ?? "";
    }

    const datePart = meeting.chosen_date ? ` (${meeting.chosen_date})` : "";
    const gamePart = gameName ? ` — ${gameName}` : "";

    const memberIds = await getGroupMemberIds(supabase, meeting.group_id);
    const tokens = await getTokensForUsers(supabase, memberIds);

    if (!tokens.length) {
      return Response.json({ message: "No tokens" });
    }

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: "Spotkanie zatwierdzone!",
      body: `Spotkanie #${meeting.number}${gamePart}${datePart} zostało zatwierdzone.`,
      data: { type: "meeting", meetingId },
    }));
    await sendPushNotifications(messages);

    const result = { notified: tokens.length };
    console.log("notify-meeting-approved", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
