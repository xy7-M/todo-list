"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LEN = 6;

/** 6 位邮箱验证码：注册后用邮箱里收到的 6 位数字完成验证（verifyOtp type=signup）。 */
export function VerifyCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array(LEN).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function fill(from: number, text: string) {
    const nums = text.replace(/\D/g, "").slice(0, LEN - from).split("");
    if (!nums.length) return;
    setDigits((prev) => {
      const next = [...prev];
      nums.forEach((n, i) => {
        next[from + i] = n;
      });
      return next;
    });
    inputs.current[Math.min(from + nums.length, LEN - 1)]?.focus();
  }

  async function verify(value: string) {
    if (value.length !== LEN) {
      setError("请输入 6 位验证码");
      return;
    }
    setVerifying(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: value,
      type: "signup",
    });
    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "验证码不正确或已过期，可以点下面重新发送"
          : error.message,
      );
      setVerifying(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  // 输满 6 位自动提交
  useEffect(() => {
    if (code.length === LEN && !verifying) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    if (cooldown > 0 || !email) return;
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setError(error.message);
    } else {
      setNotice("验证码已重新发送，请查收邮箱（也看一下垃圾箱）。");
      setCooldown(60);
    }
  }

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">缺少邮箱</CardTitle>
          <CardDescription>这个链接不完整</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            回注册页重新填一次邮箱即可收到验证码。
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/sign-up">去注册</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">输入验证码</CardTitle>
        <CardDescription>6 位验证码已发到 {email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                aria-label={`第 ${i + 1} 位`}
                disabled={verifying}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (!v) {
                    setDigits((prev) => {
                      const next = [...prev];
                      next[i] = "";
                      return next;
                    });
                    return;
                  }
                  fill(i, v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) {
                    inputs.current[i - 1]?.focus();
                  } else if (e.key === "ArrowLeft" && i > 0) {
                    inputs.current[i - 1]?.focus();
                  } else if (e.key === "ArrowRight" && i < LEN - 1) {
                    inputs.current[i + 1]?.focus();
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  fill(0, e.clipboardData.getData("text"));
                }}
                className="h-12 w-11 rounded-lg border-2 border-ink bg-card text-center text-xl font-semibold text-ink shadow-[2px_2px_0_0_var(--ink)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
              />
            ))}
          </div>

          {error && <p className="text-sm text-brand">{error}</p>}
          {notice && <p className="text-sm text-ink-soft">{notice}</p>}

          <Button type="submit" className="w-full" disabled={verifying}>
            {verifying ? "验证中…" : "验证并登录"}
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `重新发送（${cooldown}s）` : "重新发送验证码"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            已通过验证？{" "}
            <Link href="/auth/login" className="underline underline-offset-4">
              去登录
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}