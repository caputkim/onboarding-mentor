import { prisma } from "@/lib/prisma";
import { OnboardingStatus, Role, TaskStatus, type User } from "@prisma/client";
import { addDays, todayKst } from "@/lib/dates";
import { HttpError } from "@/lib/session";

const OPEN_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.SUBMITTED];

export async function createOnboarding(
  actor: User,
  input: { newcomerId: string; mentorId?: string | null; trackSlugs: string[]; startDate: Date },
) {
  if (actor.role !== Role.ADMIN) throw new HttpError(403, "운영자만 개설할 수 있음");
  if (input.trackSlugs.length === 0) throw new HttpError(400, "트랙을 하나 이상 선택");
  const tracks = await prisma.track.findMany({
    where: { slug: { in: input.trackSlugs } },
    include: { phases: { include: { tasks: true } } },
  });
  if (tracks.length !== input.trackSlugs.length) throw new HttpError(400, "트랙 slug 가 잘못됨");
  const newcomer = await prisma.user.findUnique({ where: { id: input.newcomerId } });
  if (!newcomer) throw new HttpError(400, "신입 사용자가 없음");
  const status = input.startDate > todayKst() ? OnboardingStatus.PLANNED : OnboardingStatus.ACTIVE;

  return prisma.$transaction(async (tx) => {
    const ob = await tx.onboarding.create({
      data: {
        newcomerId: input.newcomerId,
        mentorId: input.mentorId ?? null,
        startDate: input.startDate,
        status,
        tracks: { create: tracks.map((t) => ({ trackId: t.id })) },
      },
    });
    const data = tracks.flatMap((t) =>
      t.phases.flatMap((p) =>
        p.tasks.map((tt) => ({ onboardingId: ob.id, templateId: tt.id, dueDate: addDays(input.startDate, tt.dueOffsetDays) })),
      ),
    );
    await tx.taskInstance.createMany({ data });
    if (newcomer.role === Role.NEWCOMER) {
      // 역할은 그대로. 멘토·운영자가 신입 트랙을 체험하는 경우도 허용.
    }
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "onboarding.create", target: ob.id, detail: { trackSlugs: input.trackSlugs, newcomerId: input.newcomerId } },
    });
    return ob;
  });
}

export async function activeOnboardingFor(userId: string) {
  return prisma.onboarding.findFirst({
    where: { newcomerId: userId, status: { in: [OnboardingStatus.ACTIVE, OnboardingStatus.PLANNED] } },
    orderBy: { createdAt: "desc" },
    include: { tracks: { include: { track: true } }, mentor: true, newcomer: true },
  });
}

export type PlanScope = "today" | "week" | "all";

export type PlanTask = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: TaskStatus;
  dueDate: Date;
  overdue: boolean;
  optional: boolean;
  evidence: string | null;
  docRefs: string[];
  track: string;
  trackSlug: string;
  trackOrder: number;
  phase: string;
  phaseOrder: number;
  blockedReason: string | null;
};

export async function getPlanView(onboardingId: string, scope: PlanScope): Promise<PlanTask[]> {
  const today = todayKst();
  const where =
    scope === "all"
      ? { onboardingId }
      : scope === "today"
        ? { onboardingId, status: { in: OPEN_STATUSES }, dueDate: { lte: today } }
        : { onboardingId, status: { in: OPEN_STATUSES }, dueDate: { lte: addDays(today, 7) } };
  const tasks = await prisma.taskInstance.findMany({
    where,
    include: { template: { include: { phase: { include: { track: true } } } } },
  });
  const rows = tasks.map((t) => ({
    id: t.id,
    code: t.template.code,
    title: t.template.title,
    type: t.template.type,
    status: t.status,
    dueDate: t.dueDate,
    overdue: OPEN_STATUSES.includes(t.status) && t.dueDate < today,
    optional: t.template.optional,
    evidence: t.template.evidence,
    docRefs: t.template.docRefs,
    track: t.template.phase.track.name,
    trackSlug: t.template.phase.track.slug,
    trackOrder: t.template.phase.track.order,
    phase: t.template.phase.name,
    phaseOrder: t.template.phase.order,
    blockedReason: t.blockedReason,
  }));
  rows.sort((a, b) => a.trackOrder - b.trackOrder || a.phaseOrder - b.phaseOrder || a.dueDate.getTime() - b.dueDate.getTime() || a.code.localeCompare(b.code));
  return rows;
}

export type Progress = { total: number; done: number; skipped: number; blocked: number; overdue: number; percent: number };

export async function progressOf(onboardingId: string): Promise<Progress> {
  const today = todayKst();
  const tasks = await prisma.taskInstance.findMany({ where: { onboardingId }, select: { status: true, dueDate: true } });
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const skipped = tasks.filter((t) => t.status === TaskStatus.SKIPPED).length;
  const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = tasks.filter((t) => OPEN_STATUSES.includes(t.status) && t.dueDate < today).length;
  const denom = total - skipped;
  return { total, done, skipped, blocked, overdue, percent: denom === 0 ? 0 : Math.round((done / denom) * 100) };
}

export async function onboardingsVisibleTo(user: User) {
  const where = user.role === Role.ADMIN ? {} : user.role === Role.MENTOR ? { mentorId: user.id } : { newcomerId: user.id };
  const list = await prisma.onboarding.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: { newcomer: true, mentor: true, tracks: { include: { track: true } } },
  });
  return Promise.all(list.map(async (ob) => ({ ...ob, progress: await progressOf(ob.id) })));
}

/** 요청자가 이 온보딩을 볼 수 있는가 (신입 본인 · 담당 멘토 · 운영자) */
export async function canViewOnboarding(user: User, onboardingId: string): Promise<boolean> {
  if (user.role === Role.ADMIN) return true;
  const ob = await prisma.onboarding.findUnique({ where: { id: onboardingId }, select: { newcomerId: true, mentorId: true } });
  if (!ob) return false;
  return ob.newcomerId === user.id || ob.mentorId === user.id;
}

/** 요청자가 접근 가능한 트랙 slug — 문서 가시성(TRACK) 판정에 쓴다 */
export async function allowedTrackSlugs(user: User): Promise<string[]> {
  if (user.role === Role.ADMIN) return (await prisma.track.findMany({ select: { slug: true } })).map((t) => t.slug);
  const where = user.role === Role.MENTOR ? { OR: [{ mentorId: user.id }, { newcomerId: user.id }] } : { newcomerId: user.id };
  const obs = await prisma.onboarding.findMany({ where, include: { tracks: { include: { track: true } } } });
  return [...new Set(obs.flatMap((o) => o.tracks.map((t) => t.track.slug)))];
}
