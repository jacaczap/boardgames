import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushNotifications } from "../_shared/push.ts";
import type { PushMessage } from "../_shared/push.ts";

Deno.serve(async (req) => {
  try {
    const { user_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Profile is created by on_auth_user_created trigger with null name/surname/username,
    // so we fall back to the auth email as the best available identifier at this point.
    const { data: newUser } = await supabase
      .from("profiles")
      .select("name, surname, username")
      .eq("id", user_id)
      .single();

    let displayName = "Someone new";
    if (newUser?.name) {
      displayName = `${newUser.name}${newUser.surname ? " " + newUser.surname : ""}`;
    } else if (newUser?.username) {
      displayName = newUser.username;
    } else {
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
      if (authUser?.user?.email) {
        displayName = authUser.user.email.split("@")[0];
      }
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .neq("user_id", user_id);

    if (tokens?.length) {
      const messages: PushMessage[] = tokens.map((t) => ({
        to: t.token,
        title: "New Member!",
        body: `${displayName} joined the group!`,
        data: { type: "new_user" },
      }));
      await sendPushNotifications(messages);
    }

    return Response.json({ notified: tokens?.length ?? 0 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
