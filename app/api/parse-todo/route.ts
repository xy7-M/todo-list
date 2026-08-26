import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

function normalizePriority(p: any): "high" | "medium" | "low" {
  const s = String(p || "").toLowerCase();
  if (/(高|high|urgent|重要|紧急|important)/.test(s)) return "high";
  if (/(低|low|不急|lazy|不重要)/.test(s)) return "low";
  return "medium";
}

function normalizeDueDate(d: any): string | null {
  if (!d) return null;
  const s = String(d).trim();
  if (!s) return null;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { text, image_url, priority: reqPriority } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "缺少 text" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "服务器未配置 DEEPSEEK_API_KEY" },
        { status: 500 },
      );
    }

    const today = new Date().toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });
    const system = `你是待办事项解析助手。当前日期（Asia/Shanghai）是 ${today}。
用户输入一段自然语言，请拆分成多条待办事项。
只输出一个 JSON 对象，格式严格为：
{"todos":[{"text":string,"due_date":string|null,"priority":"high"|"medium"|"low"}]}
- text：待办内容（必填，简洁）
- due_date：截止时间；若提到具体时间请输出带时区的 ISO8601（如 2026-08-18T15:00:00+08:00），没有则 null
- priority：默认 "medium"；明显重要/紧急为 "high"，明显不急为 "low"
不要输出任何解释，只输出 JSON。`;

    const r = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: j?.error?.message || "DeepSeek 调用失败" },
        { status: r.status },
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    } catch {
      return NextResponse.json(
        { error: "DeepSeek 返回无法解析" },
        { status: 502 },
      );
    }

    const todos = Array.isArray(parsed.todos) ? parsed.todos : [];
    const inserted: any[] = [];
    for (const t of todos) {
      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          text: String(t.text || "").trim(),
          due_date: normalizeDueDate(t.due_date),
          priority: normalizePriority(t.priority || reqPriority),
          done: false,
        })
        .select()
        .single();
      if (!error && data) inserted.push(data);
    }

    // Attach an optional image (from the "加图片" button) to the first todo.
    if (image_url && inserted.length) {
      const { data: u } = await supabase
        .from("todos")
        .update({ image_url })
        .eq("id", inserted[0].id)
        .select()
        .single();
      if (u) inserted[0] = u;
    }

    return NextResponse.json({ todos: inserted });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
