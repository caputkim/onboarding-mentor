/**
 * POST /api/admin/cron/weekly-summary — 매주 월요일 06:00 KST (infra/scheduler.tf)
 */
import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { runWeeklySummaries } from "@/agent/summary";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const result = await runWeeklySummaries();
    return Response.json(result);
  } catch (e) {
    console.error("[cron] weekly-summary", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
