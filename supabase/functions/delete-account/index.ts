import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GDPR self-service account deletion. The caller's JWT is verified by the
// platform (verify_jwt defaults to true), we resolve their user id from it, then
// use the service role to remove their owned uploads and delete the auth user.
// Deleting the auth user cascades to profiles -> group_members / votes /
// push_tokens. Group-owned rows (board_games / meetings) are not personal data
// and stay with their group.
// Blocked while the user is an admin of any group, so groups are never left
// leaderless — they must promote another admin or delete the group first.
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

    // Refuse if the user still admins any group (would leave it leaderless).
    const { count: adminCount, error: adminError } = await admin
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (adminError) {
      return Response.json({ error: adminError.message }, { status: 500 });
    }

    if (adminCount && adminCount > 0) {
      return Response.json({ error: "admin_of_group" }, { status: 409 });
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
