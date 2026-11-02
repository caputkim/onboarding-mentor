import { prisma } from "@/lib/prisma";
import { listDocuments, listSyncRuns } from "@/services/admin";
import { deleteDocumentAction, updateDocumentAction, uploadDocumentAction } from "@/app/actions/admin";
import { dateKey } from "@/lib/dates";
import { Badge, buttonClass, Card, CardTitle, Empty, inputClass, PageHeader } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/forms";

export default async function DocumentsPage() {
  const [docs, runs, tracks] = await Promise.all([listDocuments(), listSyncRuns(), prisma.track.findMany({ orderBy: { order: "asc" } })]);
  return (
    <div className="space-y-6">
      <PageHeader title="지식 소스" description="Drive 는 운영자 맥에서 ingest/ingest.py 로 푸시합니다. 여기서는 수동 등록과 가시성 관리." />
      <Card>
        <CardTitle>마크다운 수동 등록</CardTitle>
        <ActionForm action={uploadDocumentAction} className="grid gap-3" resetOnSuccess>
          <div className="grid md:grid-cols-[1fr_140px_160px] gap-3">
            <input name="title" required placeholder="제목" className={inputClass} />
            <select name="visibility" className={inputClass} defaultValue="ALL">
              <option value="ALL">전 직원</option>
              <option value="TRACK">트랙 한정</option>
              <option value="ADMIN">운영자만</option>
            </select>
            <select name="trackSlug" className={inputClass} defaultValue="">
              <option value="">트랙 선택(TRACK 일 때)</option>
              {tracks.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
          </div>
          <textarea name="text" required placeholder="본문 (마크다운). 제목 기호로 섹션이 나뉩니다." className={`${inputClass} min-h-32 font-mono text-xs`} />
          <div><button className={buttonClass("primary")}>등록</button></div>
        </ActionForm>
      </Card>
      <Card>
        <CardTitle>문서 {docs.length}건</CardTitle>
        {docs.length === 0 ? <Empty>아직 문서가 없습니다.</Empty> : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title} {d.piiFlag && <Badge tone="red">개인정보 의심</Badge>}</p>
                    <p className="text-xs text-muted truncate">{d.summary}</p>
                    <p className="text-xs text-muted">{d.path} · 섹션 {d._count.sections} · {dateKey(d.lastSyncedAt)} · {d.tags.join(", ")}</p>
                  </div>
                  <ActionButton action={deleteDocumentAction.bind(null, d.id)} variant="danger" confirm="이 문서를 삭제할까요?">삭제</ActionButton>
                </div>
                <ActionForm action={updateDocumentAction} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <input type="hidden" name="id" value={d.id} />
                  <select name="visibility" defaultValue={d.visibility} className={`${inputClass} w-32`}>
                    <option value="ALL">전 직원</option>
                    <option value="TRACK">트랙 한정</option>
                    <option value="ADMIN">운영자만</option>
                  </select>
                  <select name="trackSlug" defaultValue={d.trackSlug ?? ""} className={`${inputClass} w-36`}>
                    <option value="">트랙 없음</option>
                    {tracks.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1"><input type="checkbox" name="piiFlag" defaultChecked={d.piiFlag} /> 개인정보 의심 (답변 제외)</label>
                  <button className={buttonClass("secondary", "sm")}>저장</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>동기화 이력</CardTitle>
        {runs.length === 0 ? <Empty>없음</Empty> : (
          <ul className="text-xs text-muted space-y-1">
            {runs.map((r) => (
              <li key={r.id}>{r.startedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {r.source} · 추가 {r.added} · 갱신 {r.updated} · 동일 {r.skipped} · 제외 {Array.isArray(r.excluded) ? r.excluded.length : 0}{r.finishedAt ? "" : " · 진행 중"}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
