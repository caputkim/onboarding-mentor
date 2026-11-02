/**
 * POST /api/admin/ingest — 운영자 맥의 ingest.py 가 호출. Authorization: Bearer <INGEST_TOKEN>
 * body: { source: "DRIVE"|"GITHUB", runId?: string, finalize?: boolean, documents: [{ path, title, text, sourceMeta? }] }
 */
import { z } from "zod";
import type { NextRequest } from "next/server";
import { DocSource, type Prisma } from "@prisma/client";
import { ingestDocument, recordSyncResults, startSyncRun } from "@/services/knowledge";

const Body = z.object({
  source: z.enum(["DRIVE", "GITHUB"]),
  runId: z.string().nullable().optional(),
  finalize: z.boolean().optional(),
  force: z.boolean().optional(),
  documents: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        title: z.string().min(1).max(300),
        text: z.string().max(2_000_000),
        sourceMeta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(20),
});

export async function POST(req: NextRequest) {
  const token = process.env.INGEST_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  if (!token || header !== `Bearer ${token}`) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "잘못된 요청", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const body = parsed.data;
  const source = DocSource[body.source];
  const run = body.runId ? { id: body.runId } : await startSyncRun(source);

  const results = [];
  for (const d of body.documents) {
    const prefix = body.source === "DRIVE" ? "drive:" : "github:";
    const path = d.path.startsWith(prefix) ? d.path : prefix + d.path;
    try {
      results.push(await ingestDocument({ source, path, title: d.title, text: d.text, sourceMeta: d.sourceMeta as Prisma.InputJsonValue | undefined }, { force: body.force ?? false }));
    } catch (e) {
      console.error("[ingest]", path, e);
      results.push({ path, action: "excluded" as const, reason: "처리 오류" });
    }
  }
  await recordSyncResults(run.id, results, body.finalize ?? false);
  return Response.json({ runId: run.id, results });
}
