import { VerifyCodeForm } from "@/components/verify-code-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <VerifyCodeForm email={email ?? ""} />
      </div>
    </div>
  );
}