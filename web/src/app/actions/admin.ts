"use server";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { DocVisibility, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDateKey } from "@/lib/dates";
import { parsePlan } from "@/lib/plans/parse";
import { applyPlan, diffPlan } from "@/lib/plans/import";
import { createOnboarding } from "@/services/onboardings";
import { acceptDraft, rejectDraft, updateDocument, deleteDocument, updateUser, uploadManualDocument } from "@/services/admin";
import type { ActionResult } from "./tasks";

const PLANS_DIR = process.env.PLANS_DIR ?? join(process.cwd(), "..", "plans");

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "오류" };
}

export async function listPlanFiles() {
  try {
    return readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

export async function previewPlanImport(file: string) {
  const plan = parsePlan(readFileSync(join(PLANS_DIR, file), "utf8"));
  return { plan, diff: await diffPlan(prisma, plan) };
}

export async function importPlanAction(file: string): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    if (!/^[^/\\]+\.md$/.test(file)) throw new Error("잘못된 파일명");
    const plan = parsePlan(readFileSync(join(PLANS_DIR, file), "utf8"));
    const order = (await prisma.track.count()) + 1;
    const diff = await applyPlan(prisma, plan, order);
    await prisma.auditLog.create({ data: { actorId: user.id, action: "track.import", target: plan.slug, detail: { file, tasks: diff.tasks.length, orphans: diff.orphans } } });
    revalidatePath("/admin/tracks");
    return { ok: true, message: `${plan.name} 트랙 반영: 과제 ${diff.tasks.length}개${diff.orphans.length ? `, md 에 없는 항목 ${diff.orphans.join(", ")}` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

export async function createOnboardingAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    const newcomerId = String(formData.get("newcomerId") ?? "");
    const mentorId = String(formData.get("mentorId") ?? "") || null;
    const trackSlugs = formData.getAll("trackSlugs").map(String);
    const startDate = parseDateKey(String(formData.get("startDate") ?? ""));
    await createOnboarding(user, { newcomerId, mentorId, trackSlugs, startDate });
    revalidatePath("/admin/onboardings");
    revalidatePath("/admin");
    return { ok: true, message: "온보딩을 개설했습니다." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    const id = String(formData.get("id"));
    const role = String(formData.get("role")) as Role;
    const title = String(formData.get("title") ?? "").trim() || null;
    const responsibilities = String(formData.get("responsibilities") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const active = formData.get("active") === "on";
    await updateUser(user, id, { role, title, responsibilities, active });
    revalidatePath("/admin/people");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    const id = String(formData.get("id"));
    const visibility = String(formData.get("visibility")) as DocVisibility;
    const trackSlug = String(formData.get("trackSlug") ?? "").trim() || null;
    const piiFlag = formData.get("piiFlag") === "on";
    await updateDocument(user, id, { visibility, trackSlug: visibility === DocVisibility.TRACK ? trackSlug : null, piiFlag });
    revalidatePath("/admin/documents");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    await deleteDocument(user, id);
    revalidatePath("/admin/documents");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    const title = String(formData.get("title") ?? "").trim();
    const text = String(formData.get("text") ?? "");
    const visibility = (String(formData.get("visibility") ?? "ALL") as DocVisibility) || DocVisibility.ALL;
    const trackSlug = String(formData.get("trackSlug") ?? "").trim() || null;
    if (!title || !text.trim()) throw new Error("제목과 본문이 필요함");
    const r = await uploadManualDocument(user, { title, text, visibility, trackSlug });
    revalidatePath("/admin/documents");
    return { ok: true, message: `문서 ${r.action}${r.summarizedByModel ? " (모델 요약)" : " (규칙 요약 — 모델 미설정)"}` };
  } catch (e) {
    return fail(e);
  }
}

export async function acceptDraftAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    await acceptDraft(user, id);
    revalidatePath("/admin/gap-report");
    revalidatePath("/admin/documents");
    return { ok: true, message: "문서로 등록했습니다." };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectDraftAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser([Role.ADMIN]);
    await rejectDraft(user, id);
    revalidatePath("/admin/gap-report");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
