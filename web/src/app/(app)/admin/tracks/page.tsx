import { listTracks } from "@/services/admin";
import { importPlanAction, listPlanFiles, previewPlanImport } from "@/app/actions/admin";
import { Badge, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forms";

export default async function TracksPage() {
  const [tracks, files] = await Promise.all([listTracks(), listPlanFiles()]);
  const previews = await Promise.all(
    files.map(async (f) => {
      try {
        return { file: f, ...(await previewPlanImport(f)), error: null };
      } catch (e) {
        return { file: f, plan: null, diff: null, error: e instanceof Error ? e.message : "파싱 실패" };
      }
    }),
  );
  return (
    <div className="space-y-6">
      <PageHeader title="플랜 템플릿" description="plans/*.md 를 가져와 트랙 템플릿을 만듭니다. 이미 개설된 온보딩에는 영향이 없습니다." />
      <Card>
        <CardTitle>가져오기</CardTitle>
        {previews.length === 0 ? <Empty>plans/ 폴더에 md 파일이 없습니다 (PLANS_DIR 환경변수로 위치 지정 가능).</Empty> : (
          <ul className="divide-y divide-border">
            {previews.map((p) => (
              <li key={p.file} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium">{p.file}{p.plan && <span className="text-muted font-normal"> → {p.plan.name} ({p.plan.slug})</span>}</p>
                  {p.error ? <p className="text-xs text-red-700">{p.error}</p> : p.diff && (
                    <p className="text-xs text-muted">
                      {p.diff.track.created ? "새 트랙 · " : ""}
                      추가 {p.diff.tasks.filter((t) => t.action === "created").length} · 갱신 {p.diff.tasks.filter((t) => t.action === "updated").length} · 동일 {p.diff.tasks.filter((t) => t.action === "unchanged").length}
                      {p.diff.orphans.length ? ` · md 에 없는 기존 항목 ${p.diff.orphans.join(", ")} (삭제하지 않음)` : ""}
                    </p>
                  )}
                </div>
                {!p.error && <ActionButton action={importPlanAction.bind(null, p.file)} variant="primary">반영</ActionButton>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {tracks.map((t) => (
        <Card key={t.id}>
          <CardTitle right={<span className="text-xs text-muted">{t.slug}</span>}>{t.name}</CardTitle>
          {t.phases.map((ph) => (
            <div key={ph.id} className="mt-3">
              <p className="text-xs font-medium text-muted">{ph.name} (D{ph.startOffsetDays >= 0 ? "+" : ""}{ph.startOffsetDays} ~ D{ph.endOffsetDays >= 0 ? "+" : ""}{ph.endOffsetDays})</p>
              <table className="w-full text-sm mt-1">
                <tbody>
                  {ph.tasks.map((task) => (
                    <tr key={task.id} className="border-t border-border">
                      <td className="py-1.5 w-12 text-muted">{task.code}</td>
                      <td>{task.title}{task.optional && <Badge>선택</Badge>}</td>
                      <td className="w-28 text-xs text-muted">{task.type}</td>
                      <td className="w-16 text-xs text-muted">D+{task.dueOffsetDays}</td>
                      <td className="w-24 text-xs text-muted">{task.evidence ? "제출물" : ""}{task.rubric ? " · 기준" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
