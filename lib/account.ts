import { supabase } from "./supabase";

// Thrown when the server refuses deletion because the user still admins a group.
export class AdminOfGroupError extends Error {
  constructor() {
    super("admin_of_group");
    this.name = "AdminOfGroupError";
  }
}

// GDPR self-service: removes the user's auth account, profile, memberships,
// votes and owned uploads via the delete-account edge function (service role),
// then clears the local session. The function refuses (409) while the user is
// an admin of any group.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });
  if (error) {
    const body = await (error as any)?.context?.json?.().catch(() => null);
    if (body?.error === "admin_of_group") throw new AdminOfGroupError();
    throw error;
  }
  await supabase.auth.signOut();
}
