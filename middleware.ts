import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login"];
const OWNER_ONLY_PREFIXES = ["/owner"];

/**
 * Route guard — enforced server-side, not just hidden in the UI (CC-B15
 * "selesai kalau"). API routes only get their session cookie refreshed
 * here; each route handler does its own role check and returns a proper
 * 403 JSON response instead of a redirect.
 */
export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api")) {
    return supabaseResponse;
  }

  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (OWNER_ONLY_PREFIXES.some((p) => path.startsWith(p))) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (appUser?.role !== "owner") {
      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      return NextResponse.rewrite(url, { status: 403 });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
