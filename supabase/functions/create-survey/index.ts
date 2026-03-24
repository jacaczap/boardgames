import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Push notifications are sent via DB trigger on meetings INSERT (status='voting')

    return Response.json({ meetingId: newMeetingId });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
