/**
 * 파싱된 플랜을 Track/Phase/TaskTemplate 으로 반영한다.
 * 규칙 (docs/02_데이터모델.md §5): code 가 같으면 갱신, 없으면 추가, md 에서 사라진 항목은 삭제하지 않고 보고.
 */
import type { PrismaClient } from "@prisma/client";
import type { ParsedPlan } from "./parse";

export type ImportDiff = {
  track: { slug: string; created: boolean };
  phases: { name: string; created: boolean }[];
  tasks: { code: string; action: "created" | "updated" | "unchanged" }[];
  orphans: string[]; // DB 에는 있으나 md 에 없는 code
};

export async function diffPlan(prisma: PrismaClient, plan: ParsedPlan): Promise<ImportDiff> {
  const track = await prisma.track.findUnique({
    where: { slug: plan.slug },
    include: { phases: { include: { tasks: true } } },
  });
  const existingTasks = new Map<string, { title: string; description: string; type: string; dueOffsetDays: number; evidence: string | null; rubric: string | null; docRefs: string[]; optional: boolean }>();
  for (const ph of track?.phases ?? []) for (const t of ph.tasks) existingTasks.set(t.code, t);

  const diff: ImportDiff = {
    track: { slug: plan.slug, created: !track },
    phases: plan.phases.map((p) => ({ name: p.name, created: !track?.phases.some((x) => x.name === p.name) })),
    tasks: [],
    orphans: [],
  };
  const seen = new Set<string>();
  for (const ph of plan.phases) {
    for (const t of ph.tasks) {
      seen.add(t.code);
      const ex = existingTasks.get(t.code);
      if (!ex) diff.tasks.push({ code: t.code, action: "created" });
      else {
        const same =
          ex.title === t.title && ex.description === t.description && ex.type === t.type &&
          ex.dueOffsetDays === t.dueOffsetDays && ex.evidence === t.evidence && ex.rubric === t.rubric &&
          ex.optional === t.optional && JSON.stringify(ex.docRefs) === JSON.stringify(t.docRefs);
        diff.tasks.push({ code: t.code, action: same ? "unchanged" : "updated" });
      }
    }
  }
  for (const code of existingTasks.keys()) if (!seen.has(code)) diff.orphans.push(code);
  return diff;
}

export async function applyPlan(prisma: PrismaClient, plan: ParsedPlan, order = 0): Promise<ImportDiff> {
  const diff = await diffPlan(prisma, plan);
  await prisma.$transaction(async (tx) => {
    const track = await tx.track.upsert({
      where: { slug: plan.slug },
      create: { slug: plan.slug, name: plan.name, order },
      update: { name: plan.name },
    });
    for (const ph of plan.phases) {
      // Phase 는 이름으로 매칭. order 충돌을 피하려고 먼저 음수로 밀어둔다.
      const existing = await tx.phase.findFirst({ where: { trackId: track.id, name: ph.name } });
      const phase = existing
        ? await tx.phase.update({
            where: { id: existing.id },
            data: { order: -1 - ph.order, startOffsetDays: ph.startOffsetDays, endOffsetDays: ph.endOffsetDays },
          })
        : await tx.phase.create({
            data: { trackId: track.id, name: ph.name, order: -1 - ph.order, startOffsetDays: ph.startOffsetDays, endOffsetDays: ph.endOffsetDays },
          });
      for (const t of ph.tasks) {
        // code 는 트랙 안에서 유일해야 한다. 다른 phase 에 같은 code 가 있으면 그쪽을 옮긴다.
        const prior = await tx.taskTemplate.findFirst({ where: { code: t.code, phase: { trackId: track.id } } });
        const data = {
          title: t.title, description: t.description, type: t.type, dueOffsetDays: t.dueOffsetDays,
          evidence: t.evidence, rubric: t.rubric, docRefs: t.docRefs, optional: t.optional, order: t.order,
        };
        if (prior) await tx.taskTemplate.update({ where: { id: prior.id }, data: { ...data, phaseId: phase.id } });
        else await tx.taskTemplate.create({ data: { ...data, phaseId: phase.id, code: t.code } });
      }
    }
    // order 를 양수로 되돌린다.
    const phases = await tx.phase.findMany({ where: { trackId: track.id, order: { lt: 0 } } });
    for (const p of phases) await tx.phase.update({ where: { id: p.id }, data: { order: -1 - p.order } });
  });
  return diff;
}
