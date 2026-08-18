"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import {
  Mic,
  Square,
  Image as ImageIcon,
  Sparkles,
  Send,
  X,
  Check,
  Loader2,
  LogIn,
  UserPlus,
  LogOut,
} from "lucide-react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  image_url: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  created_at?: string;
};

// Only construct the Supabase client when env vars are present,
// so the page still renders (and voice input still works) before Supabase is wired.
const supabase = hasEnvVars ? createClient() : null;

const MAX_MS = 60000;

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function priorityStyle(p: string): { label: string; cls: string } {
  switch (p) {
    case "high":
      return { label: "高", cls: "bg-red-500/15 text-red-300 border-red-500/30" };
    case "low":
      return { label: "低", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" };
    default:
      return { label: "中", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  }
}

export default function Home() {
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [user, setUser] = useState<any>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recognizing, setRecognizing] = useState(false);

  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load todos + subscribe to realtime changes.
  // React StrictMode in dev invokes this effect twice (mount → cleanup → mount)
  // and supabase-js refuses a second `.on('postgres_changes', ...)` after the
  // underlying channel has already subscribed. We guard with a ref + a
  // cancelled flag so StrictMode's replay reuses the existing channel instead
  // of registering a second one.
  const channelRef = useRef<any>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    if (channelRef.current) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (cancelled) return;
      setUser(user);
      if (!user) return;

      const { data } = await supabase!
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (data) {
        fetchedRef.current = true;
        setTodos(data as Todo[]);
      }

      // Unique channel name per mount helps when an old subscription is still
      // tearing down on the server side; without it the second mount would
      // collide with the first's pending postgres_changes registration.
      const channelName = `todos-changes-${user.id}-${Date.now()}`;
      channelRef.current = supabase!
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "todos",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.eventType === "INSERT")
              setTodos((t) => [
                payload.new as Todo,
                ...t.filter((x) => x.id !== payload.new.id),
              ]);
            else if (payload.eventType === "UPDATE")
              setTodos((t) =>
                t.map((x) => (x.id === payload.new.id ? (payload.new as Todo) : x)),
              );
            else if (payload.eventType === "DELETE")
              setTodos((t) =>
                t.filter((x) => x.id !== (payload.old as any).id),
              );
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        fetchedRef.current = false;
      }
    };
  }, []);

  // React to sign-in / sign-out transitions (clicking the "退出" button
  // or returning from /auth/login). Without this, the header keeps showing
  // the pre-logout state until the page is reloaded.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setTodos([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (!supabase) return;
    setHint("正在退出…");
    const { error } = await supabase.auth.signOut();
    if (error) setHint(`退出失败：${error.message}`);
    else setHint("已退出");
    setText("");
    setPendingImage(null);
  }

  // ---- Audio recording ----
  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("当前浏览器不支持录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        await sendAudio(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_MS / 1000) {
            stopRecording();
            return MAX_MS / 1000;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      setHint(
        e?.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试"
          : `无法访问麦克风：${e?.message || e}`,
      );
    }
  }

  async function sendAudio(blob: Blob) {
    setRecognizing(true);
    setHint("识别中…");
    try {
      const fd = new FormData();
      const ext = blob.type.includes("webm")
        ? "webm"
        : blob.type.includes("mp4")
          ? "m4a"
          : "wav";
      fd.append(
        "audio",
        new File([blob], `recording.${ext}`, {
          type: blob.type || "audio/webm",
        }),
      );
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "识别失败");
      setText((prev) =>
        prev ? prev + (prev.endsWith(" ") ? "" : " ") + data.text : data.text,
      );
      setHint("语音已识别，可修改后点「✨ AI 解析」");
    } catch (e: any) {
      setHint(`识别失败：${e?.message || e}`);
    } finally {
      setRecognizing(false);
    }
  }

  // ---- Image upload ----
  // The user's filename may contain CJK characters / exclamation marks / spaces
  // / etc which Supabase storage rejects with "Invalid key". We always rewrite
  // the path with a server-generated UUID + sanitised extension and drop the
  // original filename entirely.
  function safeExt(name: string, fallback: string): string {
    const m = (name.match(/\.([a-zA-Z0-9]{1,8})$/) || [, ""])[1].toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(m) ? m : fallback;
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!supabase || !user) {
      setHint("请先登录后再添加图片");
      return;
    }
    setUploadingImg(true);
    try {
      const ext = safeExt(f.name, f.type.split("/")[1] || "png");
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("my-todo")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("my-todo")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      setPendingImage(data?.signedUrl || null);
      setHint("图片已就绪，将随待办一起保存");
    } catch (err: any) {
      setHint(`图片上传失败：${err?.message || err}`);
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ---- Add actions ----
  async function addDirect() {
    if (!text.trim()) return;
    if (!supabase || !user) {
      setHint("请先登录后再添加");
      return;
    }
    const { error } = await supabase.from("todos").insert({
      user_id: user.id,
      text: text.trim(),
      image_url: pendingImage,
      done: false,
      priority,
    });
    if (error) setHint(`添加失败：${error.message}`);
    else {
      setText("");
      setPendingImage(null);
      setHint(null);
    }
  }

  async function aiParse() {
    if (!text.trim()) return;
    if (!supabase || !user) {
      setHint("请先登录后再添加");
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/parse-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), image_url: pendingImage, priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      setText("");
      setPendingImage(null);
      setHint(`已建成 ${data.todos?.length || 0} 条待办`);
    } catch (e: any) {
      setHint(`解析失败：${e?.message || e}`);
    } finally {
      setParsing(false);
    }
  }

  async function toggle(t: Todo) {
    if (!supabase) return;
    await supabase.from("todos").update({ done: !t.done }).eq("id", t.id);
  }

  async function cyclePriority(t: Todo) {
    if (!supabase) return;
    const next =
      t.priority === "high"
        ? "medium"
        : t.priority === "medium"
        ? "low"
        : "high";
    await supabase.from("todos").update({ priority: next }).eq("id", t.id);
  }

  async function remove(t: Todo) {
    if (!supabase) return;
    await supabase.from("todos").delete().eq("id", t.id);
  }

  const inputDisabled = !supabase || !user;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/*
              Emoji lives in its own element so React 19's text-node
              normalisation (which was eating a regular space next to the
              emoji + middot + CJK sequence) cannot cross the element boundary.
              `suppressHydrationWarning` is the belt-and-suspenders for any
              residual byte-level diff in the second text node — visually the
              rendered string is identical, only the SSR vs CSR pipeline disagrees.
            */}
            <h1
              className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-3xl font-bold text-transparent"
              suppressHydrationWarning
            >
              <span aria-hidden="true" suppressHydrationWarning>🎙️</span>
              {" Todo · 语音待办"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {hasEnvVars
                ? "说一句话，AI 帮你拆成待办。支持语音输入 / 图片 / 自然语言解析。"
                : "Supabase 未配置：可体验「语音输入 → 文字」流程，待办不会保存到云端。"}
            </p>
          </div>

          {hasEnvVars && (
            <div className="flex flex-none items-center gap-2 pt-1">
              {user ? (
                <>
                  <span
                    title={user.email ?? ""}
                    className="hidden max-w-[160px] truncate text-xs text-slate-400 sm:inline"
                  >
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex h-8 items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                  >
                    <LogOut size={14} />
                    退出
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    prefetch
                    className="flex h-8 items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 text-xs text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
                  >
                    <LogIn size={14} />
                    登录
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    prefetch
                    className="flex h-8 items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-3 text-xs font-medium text-white shadow transition hover:opacity-90"
                  >
                    <UserPlus size={14} />
                    注册
                  </Link>
                </>
              )}
            </div>
          )}
        </header>

        {!hasEnvVars && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Supabase 未配置：待办不会保存到云端，但可体验「语音输入 → 文字」流程。
            在 <code>.env.local</code> 填入 <code>NEXT_PUBLIC_SUPABASE_URL</code> 与{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> 即可启用完整功能。
          </div>
        )}

        {/* Smart input box */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-blue-500/5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="说点什么，或点麦克风录音…例如：明天下午三点提醒我带钥匙"
            rows={2}
            className="w-full resize-none bg-transparent px-2 py-1 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />

          {/* Priority selector: 高 / 中 / 低 — applies to direct add and as the
              default for AI-parsed todos (the AI can still override per item). */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              优先级
            </span>
            {(["high", "medium", "low"] as const).map((p) => {
              const ps = priorityStyle(p);
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={
                    "rounded-full border px-2.5 py-0.5 text-xs transition " +
                    (active
                      ? ps.cls + " ring-1 ring-current"
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200")
                  }
                  aria-pressed={active}
                >
                  {ps.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {/* left: image + mic (side by side, inside the box) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingImg || inputDisabled}
                title="添加图片"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-40"
              >
                {uploadingImg ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ImageIcon size={18} />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                title={recording ? "停止录音" : "开始录音"}
                className={
                  recording
                    ? "flex h-9 items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-3 text-sm text-red-300 animate-pulse"
                    : "flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-blue-500/50 hover:text-blue-300"
                }
              >
                {recording ? (
                  <span key="rec-on" className="flex items-center gap-2">
                    <Square size={16} />
                    <span className="tabular-nums">{seconds}s</span>
                  </span>
                ) : (
                  <Mic key="rec-off" size={18} />
                )}
              </button>

              {recognizing && (
                <span className="flex items-center gap-1 text-xs text-cyan-300">
                  <Loader2 size={14} className="animate-spin" /> 识别中…
                </span>
              )}
            </div>

            {/* right: two capsule action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={aiParse}
                disabled={parsing || !text.trim() || inputDisabled}
                className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-medium text-white shadow transition hover:opacity-90 disabled:opacity-40"
              >
                {parsing ? (
                  <Loader2 key="ai-loading" size={16} className="animate-spin" />
                ) : (
                  <Sparkles key="ai-sparkles" size={16} />
                )}
                AI 解析
              </button>
              <button
                type="button"
                onClick={addDirect}
                disabled={!text.trim() || inputDisabled}
                className="flex h-9 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-40"
              >
                <Send size={16} />
                直接添加
              </button>
            </div>
          </div>

          {pendingImage && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1">
              <img
                src={pendingImage}
                alt="pending"
                className="h-10 w-10 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="text-slate-400 hover:text-red-300"
                title="移除图片"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {hint && (
            <p className="mt-2 px-1 text-xs text-slate-400">{hint}</p>
          )}
        </div>

        {/* Todo list */}
        <ul className="mt-6 space-y-3">
          {todos.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              还没有待办。登录后说一句话试试吧。
            </li>
          )}
          {todos.map((t) => {
            const ps = priorityStyle(t.priority);
            const due = formatDueDate(t.due_date);
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                    t.done
                      ? "border-cyan-500 bg-cyan-500 text-slate-950"
                      : "border-slate-600"
                  }`}
                  title={t.done ? "标记未完成" : "标记完成"}
                >
                  {t.done && <Check size={14} />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`break-words text-sm ${
                      t.done ? "text-slate-500 line-through" : "text-slate-100"
                    }`}
                  >
                    {t.text}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cyclePriority(t)}
                      className={`rounded border px-1.5 py-0.5 text-[11px] transition hover:opacity-80 ${ps.cls}`}
                      title="点击切换优先级"
                    >
                      {ps.label}
                    </button>
                    {due && (
                      <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[11px] text-slate-300">
                        ⏰ {due}
                      </span>
                    )}
                  </div>
                  {t.image_url && (
                    <img
                      src={t.image_url}
                      alt=""
                      className="mt-2 max-h-40 rounded-lg border border-slate-800"
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => remove(t)}
                  className="flex-none text-slate-500 transition hover:text-red-400"
                  title="删除"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
