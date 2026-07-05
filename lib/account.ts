import { supabase } from "./supabase";

// GDPR self-service: removes the user's auth account, profile, memberships,
// votes and owned uploads via the delete-account edge function (service role),
// then clears the local session.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });
  if (error) throw error;
  await supabase.auth.signOut();
}
