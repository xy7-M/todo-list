import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

/**
 * 刷新 Supabase 会话（在 Next.js Middleware 中运行）。
 *
 * Vercel 运行时下使用标准写法：同时写回 request 与 response 两份 cookie，
 * 这样同一次请求内后续的 Route Handler / Server Component 也能立即读到
 * 刷新后的 token。这是 @supabase/ssr 官方推荐模式，可避免用户被随机登出。
 *
 * Session refresh using the canonical @supabase/ssr pattern: cookies are written
 * back to BOTH the request and the response so downstream handlers in the same
 * request see the refreshed token. Avoids random logouts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 环境变量未配置时跳过校验（方便未接 Supabase 时先跑起来）。
  // Skip the auth check when env vars are absent.
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
          // 1) 写回 request，供同一次请求内的下游代码读取
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // 2) 重建 response 并写回 cookie，交给浏览器持久化
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

  // 不要在 createServerClient 与 getClaims() 之间插入任何代码。
  // Do NOT run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // /api/* 路由自行做鉴权（Route Handler 内部调用 supabase.auth.getUser()，
  // 并由 RLS 兜底），因此这里放行，避免把未登录的调用 307 重定向到登录页。
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

  // 必须原样返回 supabaseResponse，否则浏览器与服务端的会话可能不同步。
  return supabaseResponse;
}
