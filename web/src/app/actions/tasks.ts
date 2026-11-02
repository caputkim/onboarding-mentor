"use server";

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { setMentorNote, updateTaskStatus } from "@/services/tasks";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "오류" };
}

export async function setTaskStatusAction(taskId: string, status: TaskStatus, note?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await updateTaskStatus(taskId, user, status, note);
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/");
    revalidatePath("/journey");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function mentorNoteAction(submissionId: string, taskId: string, note: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await setMentorNote(submissionId, user, note);
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
