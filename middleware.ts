import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { hasOwnerAccess } from "@/lib/auth/roles";

// /reset-password harus publik: pemiliknya justru BELUM bisa login — itu
// alasan dia ada. Tanpa ini, tautan pemulihan Supabase dilempar ke /login
// dan terlihat seperti tautan rusak (10-AUDIT-FE-BE.md #26).
const PUBLIC_PATHS = ["/login", "/reset-password"];
const OWNER_ONLY_PREFIXES = ["/owner"];

/**
 * Route guard — enforced server-side, not just hidden in the UI (CC-B15
 * "selesai kalau"). API routes only get their session cookie refreshed
 * here; each route handler does its own role check and returns a proper
 * 403 JSON response instead of a redirect.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // /login itself must never depend on Supabase being reachable — a
  // misconfigured/missing env var would otherwise 500 the one page needed
  // to diagnose that. API routes handle their own auth per-request.
  if (path.startsWith("/api") || PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

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

    if (!hasOwnerAccess(appUser?.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      return NextResponse.rewrite(url, { status: 403 });
    }
  }

  return supabaseResponse;
}

// Static assets under /public (logos, icons, manifest) were falling through
// this matcher and getting redirected to /login by the auth check below —
// Next's image optimizer then choked on the redirect body ("isn't a valid
// image, received null") instead of the actual file. Excluding common
// static extensions in addition to the Next-internal paths.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif)$).*)",
  ],
};
