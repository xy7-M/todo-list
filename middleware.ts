import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Next.js Middleware —— 每个匹配到的请求都会先刷新 Supabase 会话。
 * Middleware entry point: refreshes the Supabase session on every matched request.
 *
 * 运行在 Vercel Edge Runtime（Next.js 默认），@supabase/ssr 完全支持。
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 匹配除以下之外的所有路径：
     * - _next/static（静态资源）
     * - _next/image（图片优化）
     * - favicon.ico
     * - 各类图片后缀
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
