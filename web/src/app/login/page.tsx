import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ALLOWED_DOMAIN } from "@/auth.config";
import { LoginForm } from "@/components/AuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = "/" } = await searchParams;
  if (await currentUser()) redirect(callbackUrl.startsWith("/") ? callbackUrl : "/");
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="text-xs font-medium text-accent">NxtCloud</p>
        <h1 className="mt-1 text-xl font-semibold">온보딩 동료</h1>
        <p className="mt-2 text-sm text-muted">넥스트클라우드 구성원만 쓸 수 있습니다.</p>
        <LoginForm callbackUrl={callbackUrl} domain={ALLOWED_DOMAIN} />
      </div>
    </main>
  );
}
