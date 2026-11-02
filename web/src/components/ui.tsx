import Link from "next/link";
import type { ReactNode } from "react";
import { TaskStatus } from "@prisma/client";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`bg-surface border border-border rounded-xl p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted py-6 text-center">{children}</p>;
}

const btn = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "bg-surface border border-border hover:bg-background",
  danger: "bg-surface border border-red-200 text-red-700 hover:bg-red-50",
  ghost: "hover:bg-background",
} as const;

export function buttonClass(variant: keyof typeof btn = "secondary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${size === "sm" ? "text-xs px-2.5 py-1.5" : "text-sm px-3.5 py-2"} ${btn[variant]}`;
}

export function LinkButton({ href, children, variant = "secondary", size = "md" }: { href: string; children: ReactNode; variant?: keyof typeof btn; size?: "sm" | "md" }) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

export const inputClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";

const STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  TODO: { label: "할 일", cls: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "진행 중", cls: "bg-blue-50 text-blue-700" },
  SUBMITTED: { label: "검토 대기", cls: "bg-amber-50 text-amber-700" },
  DONE: { label: "완료", cls: "bg-green-50 text-green-700" },
  BLOCKED: { label: "막힘", cls: "bg-red-50 text-red-700" },
  SKIPPED: { label: "건너뜀", cls: "bg-gray-100 text-gray-500" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export const statusLabel = (s: TaskStatus) => STATUS[s].label;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "blue" | "green" | "red" | "amber" }) {
  const cls = { gray: "bg-gray-100 text-gray-700", blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-border overflow-hidden">
      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}
