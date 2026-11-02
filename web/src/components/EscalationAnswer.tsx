"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerEscalationAction, closeEscalationAction } from "@/app/actions/escalations";
import { buttonClass, inputClass } from "./ui";

export function AnswerForm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await answerEscalationAction(id, answer);
          setMsg(r.ok ? r.message ?? "보냈습니다." : r.error);
          if (r.ok) router.refresh();
        });
      }}
    >
      <textarea className={`${inputClass} min-h-24`} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="답변. 다음 신입을 위한 문서 초안이 자동으로 제안됩니다." disabled={pending} />
      <div className="flex items-center gap-3">
        <button className={buttonClass("primary", "sm")} disabled={pending || !answer.trim()}>답변 보내기</button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </form>
  );
}

export function CloseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className={buttonClass("ghost", "sm")} disabled={pending} onClick={() => start(async () => { await closeEscalationAction(id); router.refresh(); })}>닫기</button>
  );
}
