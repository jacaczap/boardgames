import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GDPR self-service account deletion. The caller's JWT is verified by the
// platform (verify_jwt defaults to true), we resolve their user id from it, then
// use the service role to remove their owned uploads and delete the auth user.
// Deleting the auth user cascades to profiles -> group_members / votes /
// push_tokens. Group-owned rows (board_games / meetings) are not personal data
// and stay with their group.
// Groups where the caller is the only member are deleted first (nobody is left
// to lead them). Deletion is blocked only when the caller is an admin of a group
// that still has other members — they must promote another admin or delete it.
Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return Response.json({ error: "Missing Authorization" }, { status: 401 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve (and verify) the caller from their forwarded access token.
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // Inspect every group the user belongs to. Solo groups (only the caller
    // left) get deleted; a group where the caller is an admin but others remain
    // blocks deletion so it is never left leaderless.
    const { data: memberships, error: memError } = await admin
      .from("group_members")
      .select("group_id, role")
      .eq("user_id", user.id);

    if (memError) {
      return Response.json({ error: memError.message }, { status: 500 });
    }

    const soloGroupIds: string[] = [];
    for (const m of memberships ?? []) {
      const { count, error: countError } = await admin
        .from("group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", m.group_id);

      if (countError) {
        return Response.json({ error: countError.message }, { status: 500 });
      }

      if ((count ?? 0) <= 1) {
        soloGroupIds.push(m.group_id as string);
      } else if (m.role === "admin") {
        return Response.json({ error: "admin_of_group" }, { status: 409 });
      }
    }

    // Delete solo groups (cascades to their games / meetings / memberships).
    if (soloGroupIds.length > 0) {
      const { error: delGroupsError } = await admin
        .from("groups")
        .delete()
        .in("id", soloGroupIds);

      if (delGroupsError) {
        return Response.json({ error: delGroupsError.message }, { status: 500 });
      }
    }

    // Remove the user's owned upload (avatar) before deleting the profile row.
    const { data: profile } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.avatar_url) {
      await admin.storage.from("avatars").remove([profile.avatar_url]);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    console.log("delete-account", { userId: user.id });
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
