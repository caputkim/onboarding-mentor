import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ALLOWED_DOMAIN } from "@/auth.config";
import { SignupForm } from "@/components/AuthForms";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = "/" } = await searchParams;
  if (await currentUser()) redirect(callbackUrl.startsWith("/") ? callbackUrl : "/");
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="text-xs font-medium text-accent">NxtCloud</p>
        <h1 className="mt-1 text-xl font-semibold">회원가입</h1>
        <p className="mt-2 text-sm text-muted">@{ALLOWED_DOMAIN} 이메일로만 가입할 수 있습니다. 가입 후 역할은 운영자가 지정합니다.</p>
        <SignupForm callbackUrl={callbackUrl} domain={ALLOWED_DOMAIN} />
      </div>
    </main>
  );
}
