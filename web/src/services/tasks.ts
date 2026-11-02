import { prisma } from "@/lib/prisma";
import { Role, TaskStatus, type User } from "@prisma/client";
import { HttpError } from "@/lib/session";

export async function getTaskForUser(taskId: string, requester: User) {
  const task = await prisma.taskInstance.findUnique({
    where: { id: taskId },
    include: {
      template: { include: { phase: { include: { track: true } } } },
      onboarding: { select: { id: true, newcomerId: true, mentorId: true, startDate: true } },
      submissions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) throw new HttpError(404, "과제가 없음");
  const ob = task.onboarding;
  const allowed = requester.role === Role.ADMIN || ob.newcomerId === requester.id || ob.mentorId === requester.id;
  if (!allowed) throw new HttpError(404, "과제가 없음");
  return task;
}

const NEWCOMER_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
  IN_PROGRESS: [TaskStatus.TODO, TaskStatus.BLOCKED, TaskStatus.DONE],
  BLOCKED: [TaskStatus.IN_PROGRESS, TaskStatus.TODO],
  SUBMITTED: [TaskStatus.IN_PROGRESS],
  DONE: [TaskStatus.IN_PROGRESS],
  SKIPPED: [],
};

/**
 * 상태 전이 규칙: docs/02_데이터모델.md §3.
 * - 제출물(evidence)이 있는 과제는 신입이 직접 DONE 으로 못 바꾼다 (검토 PASS 로만).
 * - BLOCKED 는 사유 필수.
 * - SKIPPED 는 선택 과제에 한해 멘토·운영자만.
 */
export async function updateTaskStatus(taskId: string, requester: User, status: TaskStatus, note?: string | null) {
  const task = await getTaskForUser(taskId, requester);
  const isOwner = task.onboarding.newcomerId === requester.id;
  const isStaff = requester.role === Role.ADMIN || task.onboarding.mentorId === requester.id;

  if (status === TaskStatus.BLOCKED && !note?.trim()) throw new HttpError(400, "막힌 사유를 적어야 함");
  if (status === TaskStatus.SKIPPED) {
    if (!isStaff) throw new HttpError(403, "건너뛰기는 멘토·운영자만");
    if (!task.template.optional) throw new HttpError(400, "선택 과제만 건너뛸 수 있음");
  }
  if (isOwner && !isStaff) {
    if (!NEWCOMER_TRANSITIONS[task.status].includes(status)) throw new HttpError(400, `${task.status} → ${status} 전이는 허용되지 않음`);
    if (status === TaskStatus.DONE && task.template.evidence) throw new HttpError(400, "제출물이 필요한 과제는 제출 후 검토를 통과해야 완료됨");
  }

  const updated = await prisma.taskInstance.update({
    where: { id: taskId },
    data: {
      status,
      blockedReason: status === TaskStatus.BLOCKED ? note?.trim() : null,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
    },
  });
  if (isStaff && !isOwner) {
    await prisma.auditLog.create({ data: { actorId: requester.id, action: "task.status", target: taskId, detail: { status, note: note ?? null } } });
  }
  return updated;
}

export async function setMentorNote(submissionId: string, requester: User, note: string) {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { taskInstance: { include: { onboarding: true } } } });
  if (!sub) throw new HttpError(404, "제출물이 없음");
  const ob = sub.taskInstance.onboarding;
  if (!(requester.role === Role.ADMIN || ob.mentorId === requester.id)) throw new HttpError(403, "담당 멘토·운영자만");
  return prisma.submission.update({ where: { id: submissionId }, data: { mentorNote: note } });
}
