import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/audio/transcriptions";
const MODEL = "FunAudioLLM/SenseVoiceSmall";

// Best-effort content-type from a filename (only used as a final fallback).
function inferContentType(filename: string, fallback?: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    webm: "audio/webm",
    wav: "audio/wav",
    wave: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    flac: "audio/flac",
    pcm: "audio/pcm",
  };
  return map[ext] || fallback || "application/octet-stream";
}

// SenseVoice prepends markers like <|zh|>, <|NEUTRAL|>, <|en|>, <|HAPPY|> …
function cleanTranscript(text: string): string {
  return text
    .replace(/<\|[\w]*\|>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Resolve the bundled ffmpeg binary (optional). Returns null if unavailable.
async function resolveFfmpeg(): Promise<string | null> {
  try {
    const mod = await import("ffmpeg-static");
    const p = (mod as any).default || mod;
    return typeof p === "string" ? p : null;
  } catch {
    return null;
  }
}

interface CallResult {
  ok: boolean;
  status: number;
  raw: string;
}

async function callSiliconflow(
  audio: Blob,
  filename: string,
): Promise<CallResult> {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) {
    return { ok: false, status: 500, raw: "missing SILICONFLOW_API_KEY" };
  }

  const form = new FormData();
  form.append("model", MODEL);
  // Materialize the uploaded blob into a fresh Blob first. Re-streaming a
  // File taken straight from req.formData() into another fetch() can hang in
  // undici (the body is tied to the incoming request stream), so read its
  // bytes once and rebuild a self-contained Blob.
  const buf = Buffer.from(await audio.arrayBuffer());
  const contentType = (audio as File).type || "application/octet-stream";
  form.append("file", new Blob([buf], { type: contentType }), filename);

  const res = await fetch(SILICONFLOW_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const raw = await res.text();
  return { ok: res.ok, status: res.status, raw };
}

function isFormatError(raw: string, status: number): boolean {
  if (status === 200) return false;
  const s = raw.toLowerCase();
  return /unsupported|not support|invalid.*format|format.*not|音频格式|不支持|unknown format/.test(
    s,
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("audio");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "缺少 audio 文件" }, { status: 400 });
    }

    const audio = file as Blob;
    const providedName = (audio as File).name || "audio.webm";
    const providedType = (audio as File).type || "";

    // Keep whatever the browser actually produced (e.g. webm → webm).
    // The extension and content-type must match the real audio format.
    const contentType =
      providedType || inferContentType(providedName, "audio/webm");
    const ext = providedName.includes(".")
      ? providedName.split(".").pop()!
      : contentType.split("/")[1]?.replace("x-", "") || "webm";
    const filename = `audio.${ext}`;

    let result = await callSiliconflow(audio, filename);

    // Fallback: if the API rejects the format, convert to 16k mono wav and retry.
    if (!result.ok && isFormatError(result.raw, result.status)) {
      const ff = await resolveFfmpeg();
      if (ff) {
        try {
          // Scope temp files under the project so Turbopack's static analysis
          // doesn't trace the whole filesystem into the server bundle.
          const tmpDir = join(process.cwd(), ".transcode-tmp");
          mkdirSync(tmpDir, { recursive: true });
          const buf = Buffer.from(await audio.arrayBuffer());
          const hintPath = join(tmpDir, `sf_in_${Date.now()}.${ext || "webm"}`);
          const outPath = join(tmpDir, `sf_out_${Date.now()}.wav`);
          writeFileSync(hintPath, buf);
          execFileSync(/*turbopackIgnore: true*/ ff, [
            "-y",
            "-i",
            hintPath,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            outPath,
          ]);
          const wavBuf = readFileSync(outPath);
          const wavBlob = new Blob([wavBuf], { type: "audio/wav" });
          result = await callSiliconflow(wavBlob, "audio.wav");
          unlinkSync(hintPath);
          unlinkSync(outPath);
        } catch {
          // conversion failed — fall through to the original error below
        }
      }
    }

    if (!result.ok) {
      let msg = result.raw;
      try {
        msg = JSON.parse(result.raw)?.message || result.raw;
      } catch {
        /* keep raw */
      }
      return NextResponse.json(
        { error: `语音识别失败 (${result.status}): ${msg}` },
        { status: result.status >= 500 ? 502 : result.status },
      );
    }

    let text = result.raw;
    try {
      const j = JSON.parse(result.raw);
      text = j.text ?? j.transcript ?? result.raw;
    } catch {
      /* keep raw */
    }
    text = cleanTranscript(text);

    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { error: `服务器错误: ${e?.message || String(e)}` },
      { status: 500 },
    );
  }
}
