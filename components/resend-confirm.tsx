"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** 在"请查收邮件"页重发注册确认邮件 —— 自带 SMTP 有频率限制，收不到时很有用。 */
export function ResendConfirm({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else {
      setState("sent");
      setMsg("已重新发送，请查收（也看一下垃圾箱）。");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={resend}
        disabled={state === "sending"}
      >
        {state === "sending" ? "发送中…" : "重新发送确认邮件"}
      </Button>
      {msg && (
        <p
          className={
            state === "error" ? "text-sm text-brand" : "text-sm text-ink-soft"
          }
        >
          {msg}
        </p>
      )}
    </div>
  );
}