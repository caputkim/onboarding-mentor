import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const nav: { href: string; label: string }[] = [];
  if (user.role === Role.MENTOR || user.role === Role.ADMIN) nav.push({ href: "/mentor", label: "멘토 현황" }, { href: "/inbox", label: "인박스" });
  if (user.role === Role.ADMIN) nav.push({ href: "/admin", label: "콘솔" });
  const roleKo = { ADMIN: "운영자", MENTOR: "멘토", NEWCOMER: "구성원" }[user.role];

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-sm">NxtCloud 온보딩 · 운영</Link>
            <nav className="flex items-center gap-1">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-sm px-2.5 py-1.5 rounded-md hover:bg-background">{n.label}</Link>
              ))}
            </nav>
          </div>
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="text-xs text-muted">{user.name} · {roleKo}</span>
            <button className="text-xs text-muted hover:text-foreground">로그아웃</button>
          </form>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
