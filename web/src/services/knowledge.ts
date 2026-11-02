/**
 * 인제스트 파이프라인: 텍스트 → 섹션 → 개인정보 필터 → 요약·태그 → Document/DocSection.
 * Drive(운영자 맥 푸시)·GitHub·수동 업로드가 모두 이 함수를 쓴다.
 */
import { createHash } from "node:crypto";
import { DocSource, DocVisibility, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitSections } from "@/lib/knowledge/sections";
import { filterSections, PII_FILENAME } from "@/lib/knowledge/pii";
import { summarizeDocument } from "@/agent/summarize";

export type IngestInput = {
  source: DocSource;
  path: string; // 고유 키. drive:<상대경로> | github:<repo>/<경로> | manual:<id>
  title: string;
  text: string;
  sourceMeta?: Prisma.InputJsonValue;
  visibility?: DocVisibility;
  trackSlug?: string | null;
};

export type IngestResult = {
  path: string;
  action: "created" | "updated" | "skipped" | "excluded";
  reason?: string;
  documentId?: string;
  excludedSections?: { heading: string; reason: string }[];
  summarizedByModel?: boolean;
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function ingestDocument(input: IngestInput, opts: { force?: boolean } = {}): Promise<IngestResult> {
  if (PII_FILENAME.test(input.path) || PII_FILENAME.test(input.title)) {
    return { path: input.path, action: "excluded", reason: "파일명이 개인정보 패턴" };
  }
  const text = input.text.replace(/\r\n?/g, "\n").trim();
  if (!text) return { path: input.path, action: "excluded", reason: "본문 없음" };
  const contentHash = sha256(text);
  const existing = await prisma.document.findUnique({ where: { path: input.path } });
  if (existing && existing.contentHash === contentHash && !opts.force) return { path: input.path, action: "skipped", documentId: existing.id };

  const { kept, excluded } = filterSections(splitSections(text));
  if (kept.length === 0) return { path: input.path, action: "excluded", reason: "모든 섹션이 개인정보 필터에 걸림", excludedSections: excluded };

  const { meta, byModel } = await summarizeDocument(input.title, kept.map((s) => `${s.heading}\n${s.text}`).join("\n\n"));
  const piiFlag = meta.piiSuspected;
  const sourceMeta: Prisma.InputJsonValue = {
    ...(typeof input.sourceMeta === "object" && input.sourceMeta ? (input.sourceMeta as Record<string, unknown>) : {}),
    excludedSections: excluded,
    summarizedByModel: byModel,
  };
  const data = {
    source: input.source,
    title: meta.title,
    summary: meta.summary,
    tags: meta.tags,
    contentHash,
    sourceMeta,
    lastSyncedAt: new Date(),
    piiFlag: existing ? existing.piiFlag || piiFlag : piiFlag,
  };
  const doc = await prisma.$transaction(async (tx) => {
    const d = existing
      ? await tx.document.update({ where: { id: existing.id }, data })
      : await tx.document.create({
          data: { ...data, path: input.path, visibility: input.visibility ?? DocVisibility.ALL, trackSlug: input.trackSlug ?? null },
        });
    await tx.docSection.deleteMany({ where: { documentId: d.id } });
    await tx.docSection.createMany({
      data: kept.map((s, i) => ({ documentId: d.id, order: i, heading: s.heading, text: s.text, tokenCount: Math.ceil(s.text.length / 2) })),
    });
    return d;
  });
  return { path: input.path, action: existing ? "updated" : "created", documentId: doc.id, excludedSections: excluded, summarizedByModel: byModel };
}

export async function startSyncRun(source: DocSource) {
  return prisma.syncRun.create({ data: { source } });
}

export async function recordSyncResults(runId: string, results: IngestResult[], finalize: boolean) {
  const run = await prisma.syncRun.findUnique({ where: { id: runId } });
  if (!run) return;
  const prevExcluded = Array.isArray(run.excluded) ? (run.excluded as unknown[]) : [];
  const excludedNow = results.filter((r) => r.action === "excluded" || (r.excludedSections?.length ?? 0) > 0).map((r) => ({ path: r.path, reason: r.reason, sections: r.excludedSections }));
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      added: { increment: results.filter((r) => r.action === "created").length },
      updated: { increment: results.filter((r) => r.action === "updated").length },
      skipped: { increment: results.filter((r) => r.action === "skipped").length },
      excluded: [...prevExcluded, ...excludedNow] as Prisma.InputJsonValue,
      ...(finalize ? { finishedAt: new Date() } : {}),
    },
  });
}
