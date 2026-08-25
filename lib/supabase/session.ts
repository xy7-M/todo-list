import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // EdgeOne Pages (opennextjs-pages) under Next.js 16 currently
          // throws "s is not a function" on `request.cookies.set(...)`.
          // We only mutate the *response* cookies (which is the path that
          // matters for refreshing the user session on the browser). The
          // request-cookie side-effect is lost, which is acceptable for
          // this app: the route handlers re-read cookies via
          // `lib/supabase/server.ts` and EdgeOne rebuilds the response
          // cookie anyway, so the next request sees the refreshed token.
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session; do not add any code between createServerClient
  // and this call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
