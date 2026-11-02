import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

/** 역할별 첫 화면. 신입(구성원)은 이 서비스에 화면이 없으므로 신입 서비스로 안내한다. */
export default async function HomePage() {
  const user = await requireUser();
  if (user.role === Role.ADMIN) redirect("/admin");
  if (user.role === Role.MENTOR) redirect("/mentor");
  const newcomerUrl = process.env.NEWCOMER_APP_URL ?? "http://localhost:3000";
  return (
    <div className="space-y-6">
      <PageHeader title="사수·운영자용 서비스입니다" description="멘토 현황, 전달된 질문 답변, 운영자 콘솔을 제공합니다." />
      <Card>
        <p className="text-sm">{user.name}님의 역할은 구성원입니다. 온보딩 플랜·과제·에이전트 대화는 신입 서비스에서 이용합니다.</p>
        <p className="mt-3 text-sm"><a className="text-accent underline" href={newcomerUrl}>{newcomerUrl}</a></p>
        <p className="mt-2 text-xs text-muted">멘토·운영자 권한이 필요하면 운영자에게 요청하세요.</p>
      </Card>
    </div>
  );
}
