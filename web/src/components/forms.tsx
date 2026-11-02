"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions/tasks";
import { buttonClass } from "./ui";

/** FormData 서버 액션을 감싸 결과 메시지를 보여준다 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [resetCount, setResetCount] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: ActionResult | null, fd: FormData) => {
    const r = await action(fd);
    if (r.ok) {
      router.refresh();
      if (resetOnSuccess) setResetCount((n) => n + 1);
    }
    return r;
  }, null);
  return (
    <form action={formAction} className={className} key={resetCount}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && (
        <p className={`mt-2 text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.ok ? state.message ?? "저장했습니다." : state.error}</p>
      )}
    </form>
  );
}

/** id 하나를 받는 서버 액션 버튼 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={buttonClass(variant, size)}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setMsg(r.ok ? r.message ?? null : r.error);
            if (r.ok) router.refresh();
          });
        }}
      >
        {children}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
