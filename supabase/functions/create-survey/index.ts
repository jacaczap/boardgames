import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: active } = await supabase
      .from("meetings")
      .select("id")
      .in("status", ["voting", "approved"])
      .limit(1);

    if (active?.length) {
      return Response.json({ message: "Active meeting already exists" });
    }

    const { data: lastCompleted } = await supabase
      .from("meetings")
      .select("chosen_date")
      .eq("status", "completed")
      .order("number", { ascending: false })
      .limit(1);

    if (lastCompleted?.length && lastCompleted[0].chosen_date) {
      // Append time to avoid timezone-dependent parsing of date-only strings
      const chosenDate = new Date(lastCompleted[0].chosen_date + "T00:00:00Z");
      const daysSince =
        (Date.now() - chosenDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        return Response.json({ message: "Too soon for new survey" });
      }
    }

    const { data: newMeetingId, error: rpcError } =
      await supabase.rpc("create_next_survey");
    if (rpcError) throw rpcError;

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token");

    if (tokens?.length) {
      const messages: PushMessage[] = tokens.map((t) => ({
        to: t.token,
        title: "New Survey Available!",
        body: "A new meeting survey is ready. Cast your vote!",
        data: { type: "survey", meetingId: newMeetingId },
      }));
      await sendPushNotifications(messages);
    }

    return Response.json({ meetingId: newMeetingId });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
