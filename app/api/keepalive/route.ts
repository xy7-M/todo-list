import { NextResponse } from "next/server";

// 保活端点：免费版 Supabase 闲置约 1 周会被暂停（暂停超 90 天不可恢复）。
// Vercel Cron 每天打一次这里，命中 REST（真正打到 Postgres）+ Auth，保持项目常驻活跃。
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "supabase env missing" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const out: Record<string, number | string> = {};

  try {
    const r = await fetch(`${url}/rest/v1/todos?select=id&limit=1`, {
      headers,
      cache: "no-store",
    });
    out.rest = r.status;
  } catch (e) {
    out.rest = `err:${(e as Error).message}`;
  }

  try {
    const r = await fetch(`${url}/auth/v1/health`, { headers, cache: "no-store" });
    out.auth = r.status;
  } catch (e) {
    out.auth = `err:${(e as Error).message}`;
  }

  const ok = out.rest === 200 && out.auth === 200;
  return NextResponse.json(
    { ok, at: new Date().toISOString(), ...out },
    { status: ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
  );
}