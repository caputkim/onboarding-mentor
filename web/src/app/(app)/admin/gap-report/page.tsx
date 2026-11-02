import { gapReport, listDrafts } from "@/services/admin";
import { acceptDraftAction, rejectDraftAction } from "@/app/actions/admin";
import { Badge, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { Markdown } from "@/components/Markdown";

export default async function GapReportPage() {
  const [report, drafts] = await Promise.all([gapReport(), listDrafts()]);
  const proposed = drafts.filter((d) => d.status === "PROPOSED");
  const handled = drafts.filter((d) => d.status !== "PROPOSED").slice(0, 10);
  return (
    <div className="space-y-6">
      <PageHeader title="문서 공백 리포트" description="에이전트가 답하지 못한 질문 = 회사에 없는 문서. 질문 원문은 보이지 않고, 주제 집계와 전달된 질문만 보입니다." />
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardTitle>주제별 질문</CardTitle>
          {report.topics.length === 0 ? <Empty>아직 질문 로그가 없습니다.</Empty> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted text-left"><tr><th className="py-1">주제</th><th className="text-right">질문</th><th className="text-right">미응답</th></tr></thead>
              <tbody>
                {report.topics.map((t) => (
                  <tr key={t.topic} className="border-t border-border">
                    <td className="py-1.5">{t.topic}</td>
                    <td className="text-right">{t.total}</td>
                    <td className={`text-right ${t.unanswered ? "text-red-700 font-medium" : ""}`}>{t.unanswered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <CardTitle>전달된 질문 (최근 50)</CardTitle>
          {report.escalations.length === 0 ? <Empty>없음</Empty> : (
            <ul className="divide-y divide-border text-sm">
              {report.escalations.map((e) => (
                <li key={e.id} className="py-2">
                  <p>{e.question}</p>
                  <p className="text-xs text-muted">{e.queryLog.topic} · {e.assignee?.name ?? "미지정"} · {e.status}{e.draft ? ` · 초안 ${e.draft.status}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card>
        <CardTitle>문서 초안 제안 {proposed.length ? <Badge tone="amber">{proposed.length}</Badge> : null}</CardTitle>
        {proposed.length === 0 ? <Empty>검토할 초안이 없습니다. 담당자가 에스컬레이션에 답하면 자동으로 생깁니다.</Empty> : (
          <ul className="space-y-5">
            {proposed.map((d) => (
              <li key={d.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted">질문: {d.escalation.question} · {d.escalation.queryLog.topic}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <ActionButton action={acceptDraftAction.bind(null, d.id)} variant="primary">문서로 등록</ActionButton>
                    <ActionButton action={rejectDraftAction.bind(null, d.id)} variant="ghost">거절</ActionButton>
                  </div>
                </div>
                <div className="mt-3 bg-background rounded-lg p-3"><Markdown text={d.content} /></div>
              </li>
            ))}
          </ul>
        )}
        {handled.length > 0 && (
          <ul className="mt-4 text-xs text-muted space-y-1">
            {handled.map((d) => <li key={d.id}>{d.status === "ACCEPTED" ? "등록" : "거절"} · {d.title}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
