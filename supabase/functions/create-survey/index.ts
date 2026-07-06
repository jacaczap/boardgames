import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: groups } = await supabase.from("groups").select("id");
    if (!groups?.length) {
      return Response.json({ message: "No groups" });
    }

    const created: string[] = [];

    for (const group of groups) {
      const { data: active } = await supabase
        .from("meetings")
        .select("id")
        .eq("group_id", group.id)
        .in("status", ["voting", "approved"])
        .limit(1);

      if (active?.length) continue;

      const { data: lastCompleted } = await supabase
        .from("meetings")
        .select("chosen_date")
        .eq("group_id", group.id)
        .eq("status", "completed")
        .order("number", { ascending: false })
        .limit(1);

      if (lastCompleted?.length && lastCompleted[0].chosen_date) {
        const chosenDate = new Date(lastCompleted[0].chosen_date + "T00:00:00Z");
        const daysSince =
          (Date.now() - chosenDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) continue;
      }

      const { data: newMeetingId, error: rpcError } = await supabase.rpc(
        "create_next_survey",
        { p_group_id: group.id },
      );
      // One group failing must not abort the rest of the batch.
      if (rpcError) {
        console.error("create-survey", group.id, rpcError.message);
        continue;
      }

      // Push notifications are sent via DB trigger on meetings INSERT (status='voting')
      created.push(newMeetingId);
    }

    const result = { created: created.length, meetingIds: created };
    console.log("create-survey", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
