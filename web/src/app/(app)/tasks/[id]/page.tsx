import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { HttpError, requireUser } from "@/lib/session";
import { getTaskForUser } from "@/services/tasks";
import { dateKey } from "@/lib/dates";
import { Badge, Card, CardTitle, PageHeader, StatusBadge } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { MentorNoteForm, TaskActions } from "@/components/TaskPanel";
import type { Review } from "@/agent/review";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser([Role.MENTOR, Role.ADMIN]);
  const { id } = await params;
  let task;
  try {
    task = await getTaskForUser(id, user);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const t = task.template;
  const isStaff = user.role === Role.ADMIN || task.onboarding.mentorId === user.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t.code} ${t.title}`}
        description={`${t.phase.track.name} › ${t.phase.name} · ${t.type} · 기한 ${dateKey(task.dueDate)}`}
        action={<StatusBadge status={task.status} />}
      />
      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardTitle>설명</CardTitle>
            <Markdown text={t.description} />
            {t.optional && <p className="mt-3"><Badge>선택 과제</Badge></p>}
          </Card>
          {t.evidence && (
            <Card>
              <CardTitle>제출물</CardTitle>
              <Markdown text={t.evidence} />
              {t.rubric && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted mb-1">평가 기준</p>
                  <Markdown text={t.rubric} />
                </div>
              )}
            </Card>
          )}
          {task.submissions.length > 0 && (
            <Card>
              <CardTitle>제출 이력</CardTitle>
              <ul className="space-y-5">
                {task.submissions.map((s) => {
                  const fb = s.agentFeedback as Review | null;
                  return (
                    <li key={s.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">{s.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                        {s.verdict && <Badge tone={s.verdict === "PASS" ? "green" : "amber"}>{s.verdict === "PASS" ? "통과" : "보완 필요"}</Badge>}
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs text-accent cursor-pointer">제출 내용 보기</summary>
                        <pre className="mt-2 text-xs whitespace-pre-wrap bg-background rounded-lg p-3 max-h-80 overflow-auto">{s.content}</pre>
                      </details>
                      {fb && (
                        <div className="mt-3 text-sm">
                          <p>{fb.summary}</p>
                          {fb.findings.length > 0 && (
                            <ul className="mt-2 space-y-2">
                              {fb.findings.map((f, i) => (
                                <li key={i} className="rounded-lg bg-background p-3">
                                  <p className="text-xs font-medium">
                                    <Badge tone={f.severity === "high" ? "red" : f.severity === "medium" ? "amber" : "gray"}>{f.severity}</Badge>
                                    <span className="ml-2">{f.item}</span>
                                  </p>
                                  {f.quote && <p className="mt-1 text-xs text-muted">“{f.quote}”</p>}
                                  <p className="mt-1 text-sm">{f.suggestion}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {isStaff && <MentorNoteForm submissionId={s.id} taskId={task.id} initial={s.mentorNote} />}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardTitle>상태</CardTitle>
            {task.blockedReason && <p className="text-sm text-red-700 mb-3">막힘: {task.blockedReason}</p>}
            <TaskActions taskId={task.id} status={task.status} optional={t.optional} />
          </Card>
          {t.docRefs.length > 0 && (
            <Card>
              <CardTitle>참고 문서</CardTitle>
              <ul className="text-sm space-y-1">
                {t.docRefs.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">신입은 신입 서비스의 대화에서 본문을 찾아 읽습니다.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
