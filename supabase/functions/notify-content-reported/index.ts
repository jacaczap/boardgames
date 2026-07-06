import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";
import { getGroupAdminIds, getTokensForUsers } from "../_shared/groups.ts";

// Push a new content report to the group's admins so they can review/takedown.
Deno.serve(async (req) => {
  try {
    const { reportId } = await req.json();
    if (!reportId) {
      return Response.json({ error: "reportId required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: report } = await supabase
      .from("content_reports")
      .select("group_id, reporter_id")
      .eq("id", reportId)
      .single();

    if (!report?.group_id) {
      return Response.json({ message: "Report has no group" });
    }

    const adminIds = (await getGroupAdminIds(supabase, report.group_id)).filter(
      (id) => id !== report.reporter_id,
    );
    const tokens = await getTokensForUsers(supabase, adminIds);

    if (!tokens.length) {
      return Response.json({ message: "No admin tokens" });
    }

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: "Nowe zgłoszenie / New report",
      body: "Zgłoszono treść do sprawdzenia. / Content was reported for review.",
      data: { type: "report", reportId },
    }));
    await sendPushNotifications(messages);

    const result = { notified: tokens.length };
    console.log("notify-content-reported", result);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
