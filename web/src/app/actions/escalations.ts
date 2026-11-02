"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { answerEscalation, closeEscalation } from "@/services/escalations";
import { createDraftFromEscalation } from "@/agent/draft";
import type { ActionResult } from "./tasks";

export async function answerEscalationAction(id: string, answer: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await answerEscalation(user, id, answer);
    void createDraftFromEscalation(id).catch((e) => console.error("[draft]", e));
    revalidatePath("/inbox");
    return { ok: true, message: "답변을 보냈습니다. 문서 초안은 운영자 콘솔에 제안됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "오류" };
  }
}

export async function closeEscalationAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await closeEscalation(user, id);
    revalidatePath("/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "오류" };
  }
}
