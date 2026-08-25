import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// We call the real Supabase session refresh here. Previously this file was
// minimised to a passthrough to dodge a "s is not a function" error coming
// from `request.cookies.set` under Next.js 16 + EdgeOne opennextjs-pages.
// That dodge caused EdgeOne to mis-detect the project as "no server-handler
// detected" and refuse to build the SSR bundle. The fix lives in
// `lib/supabase/session.ts`: it does not call `request.cookies.set`, only
// `supabaseResponse.cookies.set`, so the EdgeOne cookie bug is dodged
// while the SSR pipeline is still detected.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
