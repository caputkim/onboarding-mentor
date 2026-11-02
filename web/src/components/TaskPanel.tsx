"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { setTaskStatusAction, mentorNoteAction } from "@/app/actions/tasks";
import { buttonClass, inputClass } from "./ui";

/** 멘토·운영자의 상태 조정. 제출물 검토는 신입 서비스가 하므로 여기서는 완료·건너뛰기·다시 열기만 다룬다. */
export function TaskActions({ taskId, status, optional }: { taskId: string; status: TaskStatus; optional: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);

  function go(next: TaskStatus, note?: string) {
    start(async () => {
      const r = await setTaskStatusAction(taskId, next, note);
      setMsg(r.ok ? null : r.error);
      if (r.ok) {
        setShowBlock(false);
        router.refresh();
      }
    });
  }

  const can = (s: TaskStatus) => status !== s;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {can(TaskStatus.IN_PROGRESS) && status !== TaskStatus.SUBMITTED && status !== TaskStatus.DONE && (
          <button className={buttonClass("secondary", "sm")} disabled={pending} onClick={() => go(TaskStatus.IN_PROGRESS)}>진행 중으로</button>
        )}
        {can(TaskStatus.DONE) && (
          <button className={buttonClass("primary", "sm")} disabled={pending} onClick={() => go(TaskStatus.DONE)}>완료 처리</button>
        )}
        {can(TaskStatus.BLOCKED) && (
          <button className={buttonClass("danger", "sm")} disabled={pending} onClick={() => setShowBlock((v) => !v)}>막힘 표시</button>
        )}
        {optional && can(TaskStatus.SKIPPED) && (
          <button className={buttonClass("ghost", "sm")} disabled={pending} onClick={() => go(TaskStatus.SKIPPED)}>건너뛰기</button>
        )}
        {status === TaskStatus.DONE && (
          <button className={buttonClass("ghost", "sm")} disabled={pending} onClick={() => go(TaskStatus.IN_PROGRESS)}>다시 열기</button>
        )}
      </div>
      {showBlock && (
        <div className="flex gap-2">
          <input className={inputClass} placeholder="막힌 사유 (신입에게 보입니다)" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          <button className={buttonClass("danger", "sm")} disabled={pending || !blockReason.trim()} onClick={() => go(TaskStatus.BLOCKED, blockReason)}>기록</button>
        </div>
      )}
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </div>
  );
}

export function MentorNoteForm({ submissionId, taskId, initial }: { submissionId: string; taskId: string; initial: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex gap-2 mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await mentorNoteAction(submissionId, taskId, note);
          setSaved(r.ok);
          if (r.ok) router.refresh();
        });
      }}
    >
      <input className={inputClass} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} placeholder="멘토 메모" disabled={pending} />
      <button className={buttonClass("secondary", "sm")} disabled={pending}>{saved ? "저장됨" : "메모 저장"}</button>
    </form>
  );
}
