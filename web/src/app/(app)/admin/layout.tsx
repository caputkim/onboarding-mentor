import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";

const TABS = [
  { href: "/admin", label: "현황" },
  { href: "/admin/onboardings", label: "온보딩" },
  { href: "/admin/tracks", label: "플랜" },
  { href: "/admin/documents", label: "지식" },
  { href: "/admin/people", label: "사람" },
  { href: "/admin/gap-report", label: "공백 리포트" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUser([Role.ADMIN]);
  return (
    <div>
      <nav className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="text-sm px-3 py-2 -mb-px border-b-2 border-transparent hover:border-border">{t.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
