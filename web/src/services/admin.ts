import { prisma } from "@/lib/prisma";
import { DocSource, DocVisibility, DraftStatus, Role, type User } from "@prisma/client";
import { HttpError } from "@/lib/session";
import { ingestDocument } from "./knowledge";

function assertAdmin(u: User) {
  if (u.role !== Role.ADMIN) throw new HttpError(403, "운영자만");
}

// ---------- 사람 ----------
export async function listUsers() {
  return prisma.user.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] });
}

export async function updateUser(actor: User, id: string, data: { role?: Role; title?: string | null; responsibilities?: string[]; active?: boolean; name?: string }) {
  assertAdmin(actor);
  if (id === actor.id && data.role && data.role !== Role.ADMIN) throw new HttpError(400, "자기 자신의 운영자 권한은 뺄 수 없음");
  const u = await prisma.user.update({ where: { id }, data });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "user.update", target: id, detail: data } });
  return u;
}

// ---------- 문서 ----------
export async function listDocuments() {
  return prisma.document.findMany({ orderBy: [{ piiFlag: "desc" }, { lastSyncedAt: "desc" }], include: { _count: { select: { sections: true } } } });
}

export async function updateDocument(actor: User, id: string, data: { visibility?: DocVisibility; trackSlug?: string | null; piiFlag?: boolean; title?: string; summary?: string; tags?: string[] }) {
  assertAdmin(actor);
  const d = await prisma.document.update({ where: { id }, data });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "document.update", target: id, detail: data } });
  return d;
}

export async function deleteDocument(actor: User, id: string) {
  assertAdmin(actor);
  await prisma.document.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "document.delete", target: id } });
}

export async function uploadManualDocument(actor: User, input: { title: string; text: string; visibility: DocVisibility; trackSlug: string | null }) {
  assertAdmin(actor);
  const id = `manual:${Date.now().toString(36)}`;
  const result = await ingestDocument({ source: DocSource.MANUAL, path: id, title: input.title, text: input.text, visibility: input.visibility, trackSlug: input.trackSlug });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "document.upload", target: result.documentId ?? id, detail: { action: result.action } } });
  return result;
}

export async function listSyncRuns() {
  return prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
}

// ---------- 초안 ----------
export async function listDrafts() {
  return prisma.docDraft.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { escalation: { include: { queryLog: true } } } });
}

export async function acceptDraft(actor: User, id: string, edits?: { title?: string; content?: string }) {
  assertAdmin(actor);
  const draft = await prisma.docDraft.findUniqueOrThrow({ where: { id } });
  if (draft.status !== DraftStatus.PROPOSED) throw new HttpError(400, "이미 처리된 초안");
  const title = edits?.title?.trim() || draft.title;
  const content = edits?.content?.trim() || draft.content;
  const result = await ingestDocument({ source: DocSource.MANUAL, path: `manual:draft-${draft.id}`, title, text: `# ${title}\n\n${content}` });
  await prisma.docDraft.update({ where: { id }, data: { status: DraftStatus.ACCEPTED, documentId: result.documentId ?? null, title, content } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "draft.accept", target: id, detail: { documentId: result.documentId ?? null } } });
  return result;
}

export async function rejectDraft(actor: User, id: string) {
  assertAdmin(actor);
  await prisma.docDraft.update({ where: { id }, data: { status: DraftStatus.REJECTED } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "draft.reject", target: id } });
}

// ---------- 공백 리포트 ----------
export async function gapReport() {
  const [byTopic, unanswered] = await Promise.all([
    prisma.queryLog.groupBy({ by: ["topic", "answered"], _count: { _all: true } }),
    prisma.escalation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { assignee: { select: { name: true } }, queryLog: { select: { topic: true } }, draft: { select: { id: true, status: true } } },
    }),
  ]);
  const topics = new Map<string, { total: number; unanswered: number }>();
  for (const row of byTopic) {
    const t = topics.get(row.topic) ?? { total: 0, unanswered: 0 };
    t.total += row._count._all;
    if (!row.answered) t.unanswered += row._count._all;
    topics.set(row.topic, t);
  }
  return {
    topics: [...topics.entries()].map(([topic, v]) => ({ topic, ...v })).sort((a, b) => b.unanswered - a.unanswered || b.total - a.total),
    escalations: unanswered,
  };
}

// ---------- 플랜 가져오기 ----------
export async function listTracks() {
  return prisma.track.findMany({ orderBy: { order: "asc" }, include: { phases: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } } } });
}
