import fs from "node:fs";
import path from "node:path";

const projectRoot = import.meta.dirname + "/..";
const envText = fs.readFileSync(path.join(projectRoot, ".env.local"), "utf8");
const key = envText.match(/SILICONFLOW_API_KEY=(.+)/)?.[1]?.trim();
if (!key) {
  console.error("No SILICONFLOW_API_KEY found");
  process.exit(1);
}

const mp3 = path.join(projectRoot, "scripts-test", "speech.mp3");
const buf = fs.readFileSync(mp3);

function cleanTranscript(text) {
  return text.replace(/<\|[\w]*\|>/g, "").replace(/\s+/g, " ").trim();
}

const form = new FormData();
form.append("model", "FunAudioLLM/SenseVoiceSmall");
form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");

const res = await fetch("https://api.siliconflow.cn/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
const raw = await res.text();
console.log("HTTP", res.status);
let text = raw;
try {
  const j = JSON.parse(raw);
  text = j.text ?? j.transcript ?? raw;
} catch {}
console.log("raw:", raw);
console.log("cleaned:", cleanTranscript(String(text)));
