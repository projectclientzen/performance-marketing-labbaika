import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export interface AppUser {
  id: string;
  brand_id: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
}

/**
 * Shared by every API route that needs the caller's identity. Row-level
 * security is still the real gate (CC-B13) — this just gives route handlers
 * a typed, single place to read "who is this and what's their role" instead
 * of each one re-deriving it.
 */
export async function getAuthedAppUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, appUser: null as AppUser | null };
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, brand_id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  return { supabase, user, appUser: appUser as AppUser | null };
}
