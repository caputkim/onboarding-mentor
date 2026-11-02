import Link from "next/link";
import { DraftStatus, EscalationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { onboardingsVisibleTo } from "@/services/onboardings";
import { dateKey } from "@/lib/dates";
import { Card, CardTitle, Empty, PageHeader, ProgressBar } from "@/components/ui";

export default async function AdminHome() {
  const user = await requireUser();
  const [obs, openEsc, drafts, docs, pii, lastSync] = await Promise.all([
    onboardingsVisibleTo(user),
    prisma.escalation.count({ where: { status: EscalationStatus.OPEN } }),
    prisma.docDraft.count({ where: { status: DraftStatus.PROPOSED } }),
    prisma.document.count(),
    prisma.document.count({ where: { piiFlag: true } }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const stat = (label: string, value: string | number, href: string) => (
    <Link href={href} className="bg-surface border border-border rounded-xl p-4 hover:bg-background">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </Link>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="운영 현황" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stat("진행 중 온보딩", obs.filter((o) => o.status === "ACTIVE").length, "/admin/onboardings")}
        {stat("대기 중 에스컬레이션", openEsc, "/inbox")}
        {stat("검토할 문서 초안", drafts, "/admin/gap-report")}
        {stat("지식 문서", `${docs}${pii ? ` (확인 필요 ${pii})` : ""}`, "/admin/documents")}
      </div>
      <Card>
        <CardTitle right={<span className="text-xs text-muted">마지막 동기화 {lastSync ? `${dateKey(lastSync.startedAt)} · +${lastSync.added} ~${lastSync.updated}` : "없음"}</span>}>온보딩</CardTitle>
        {obs.length === 0 ? <Empty>개설된 온보딩이 없습니다.</Empty> : (
          <ul className="divide-y divide-border">
            {obs.map((o) => (
              <li key={o.id} className="py-3 grid md:grid-cols-[1fr_220px_120px] gap-3 items-center text-sm">
                <div>
                  <span className="font-medium">{o.newcomer.name}</span>
                  <span className="text-xs text-muted ml-2">{o.tracks.map((t) => t.track.name).join("+")} · {dateKey(o.startDate)} · 멘토 {o.mentor?.name ?? "미지정"} · {o.status}</span>
                </div>
                <ProgressBar percent={o.progress.percent} />
                <span className="text-xs text-muted text-right">{o.progress.percent}%{o.progress.overdue ? ` · 지연 ${o.progress.overdue}` : ""}{o.progress.blocked ? ` · 막힘 ${o.progress.blocked}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
