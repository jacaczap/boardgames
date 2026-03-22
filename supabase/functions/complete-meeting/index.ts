import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: completed, error } = await supabase
      .from("meetings")
      .update({ status: "completed" })
      .eq("status", "approved")
      .lt("chosen_date", today)
      .select("id, number");

    if (error) throw error;

    return Response.json({
      completed: completed?.length ?? 0,
      meetings: completed?.map((m) => m.number) ?? [],
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
