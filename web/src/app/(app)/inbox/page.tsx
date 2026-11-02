import { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { inboxFor } from "@/services/escalations";
import { Badge, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { AnswerForm, CloseButton } from "@/components/EscalationAnswer";

const STATUS = { OPEN: { label: "대기", tone: "amber" }, ANSWERED: { label: "답변됨", tone: "green" }, CLOSED: { label: "닫힘", tone: "gray" } } as const;

export default async function InboxPage() {
  const user = await requireUser([Role.MENTOR, Role.ADMIN]);
  const inbox = await inboxFor(user);
  return (
    <div className="space-y-6">
      <PageHeader title="인박스" description="에이전트가 답하지 못해 사람에게 전달된 질문. 답하면 신입에게 전달되고 문서 초안이 제안됩니다." />
      <Card>
        <CardTitle>내게 온 질문{user.role === Role.ADMIN ? " (운영자는 전체)" : ""}</CardTitle>
        {inbox.length === 0 ? (
          <Empty>전달된 질문이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {inbox.map((e) => (
              <li key={e.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{e.question}</p>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge>{e.queryLog.topic}</Badge>
                    <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">담당 {e.assignee?.name ?? "미지정"} · {e.createdAt.toLocaleDateString("ko-KR")}</p>
                {e.status === "OPEN" ? (
                  <AnswerForm id={e.id} />
                ) : (
                  <div className="mt-2 text-sm">
                    <p className="whitespace-pre-wrap">{e.answer}</p>
                    <p className="mt-1 text-xs text-muted">
                      문서 초안: {e.draft ? ({ PROPOSED: "제안됨 (콘솔에서 검토)", ACCEPTED: "등록됨", REJECTED: "거절됨" } as const)[e.draft.status] : "생성 중 또는 없음"}
                    </p>
                    {e.status === "ANSWERED" && <div className="mt-2"><CloseButton id={e.id} /></div>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
