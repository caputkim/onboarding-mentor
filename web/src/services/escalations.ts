import { prisma } from "@/lib/prisma";
import { EscalationStatus, Role, type User } from "@prisma/client";
import { HttpError } from "@/lib/session";

/** 에스컬레이션 생성은 신입 서비스(newcomer)가 한다. 여기서는 담당자 인박스·답변·닫기만 다룬다. */

export async function inboxFor(user: User) {
  const where = user.role === Role.ADMIN ? {} : { assigneeId: user.id };
  return prisma.escalation.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { assignee: { select: { id: true, name: true } }, queryLog: { select: { topic: true } }, draft: true },
  });
}

export async function answerEscalation(actor: User, id: string, answer: string) {
  const esc = await prisma.escalation.findUnique({ where: { id } });
  if (!esc) throw new HttpError(404, "에스컬레이션이 없음");
  if (!(actor.role === Role.ADMIN || esc.assigneeId === actor.id)) throw new HttpError(403, "담당자·운영자만 답할 수 있음");
  if (!answer.trim()) throw new HttpError(400, "답변이 비어 있음");
  const updated = await prisma.escalation.update({
    where: { id },
    data: { answer: answer.trim(), status: EscalationStatus.ANSWERED, answeredAt: new Date() },
  });
  await prisma.queryLog.update({ where: { id: esc.queryLogId }, data: { answered: true } });
  return updated;
}

export async function closeEscalation(actor: User, id: string) {
  const esc = await prisma.escalation.findUnique({ where: { id } });
  if (!esc) throw new HttpError(404, "에스컬레이션이 없음");
  if (!(actor.role === Role.ADMIN || esc.askerId === actor.id || esc.assigneeId === actor.id)) throw new HttpError(403, "권한 없음");
  return prisma.escalation.update({ where: { id }, data: { status: EscalationStatus.CLOSED } });
}
