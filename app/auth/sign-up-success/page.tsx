import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResendConfirm } from "@/components/resend-confirm";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">注册成功，还差一步</CardTitle>
              <CardDescription>去邮箱点确认链接</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                账号已创建{email ? `（${email}）` : ""}，但还需要
                <strong> 去邮箱点一下确认链接 </strong>
                才能登录。没收到就看看垃圾箱，或点下面按钮重发。
              </p>
              {email ? (
                <ResendConfirm email={email} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  回注册页重新提交一次即可再次发送确认邮件。
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}