import Link from "next/link";
import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getPlanView, onboardingsVisibleTo } from "@/services/onboardings";
import { dateKey, diffDays, todayKst } from "@/lib/dates";
import { Badge, Card, CardTitle, Empty, PageHeader, ProgressBar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";

export default async function MentorPage() {
  const user = await requireUser([Role.MENTOR, Role.ADMIN]);
  const obs = (await onboardingsVisibleTo(user)).filter((o) => o.status !== "COMPLETED");
  const today = todayKst();
  const details = await Promise.all(
    obs.map(async (ob) => {
      const [tasks, subs, summaries] = await Promise.all([
        getPlanView(ob.id, "all"),
        prisma.submission.findMany({ where: { taskInstance: { onboardingId: ob.id } }, orderBy: { createdAt: "desc" }, take: 3, include: { taskInstance: { include: { template: true } } } }),
        prisma.weeklySummary.findMany({ where: { onboardingId: ob.id }, orderBy: { weekStart: "desc" }, take: 1 }),
      ]);
      return { ob, overdue: tasks.filter((t) => t.overdue), blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED), subs, summary: summaries[0] ?? null };
    }),
  );
  return (
    <div className="space-y-6">
      <PageHeader title="멘토 현황" description="진행률·기한·막힘·제출물만 보입니다. 대화 원문은 보이지 않습니다." />
      {details.length === 0 && <Card><Empty>담당 중인 온보딩이 없습니다.</Empty></Card>}
      {details.map(({ ob, overdue, blocked, subs, summary }) => (
        <Card key={ob.id}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{ob.newcomer.name}</h2>
              <p className="text-xs text-muted">{ob.tracks.map((t) => t.track.name).join(" + ")} · 시작 {dateKey(ob.startDate)} · D+{diffDays(today, ob.startDate)} · 멘토 {ob.mentor?.name ?? "미지정"}</p>
            </div>
            <div className="text-right text-xs text-muted">
              {ob.progress.percent}% · 완료 {ob.progress.done}/{ob.progress.total - ob.progress.skipped}
            </div>
          </div>
          <div className="mt-3"><ProgressBar percent={ob.progress.percent} /></div>
          <div className="grid md:grid-cols-3 gap-5 mt-5">
            <div>
              <CardTitle>기한 지남 {overdue.length ? <Badge tone="red">{overdue.length}</Badge> : null}</CardTitle>
              {overdue.length === 0 ? <p className="text-xs text-muted">없음</p> : (
                <ul className="text-sm space-y-1">{overdue.map((t) => <li key={t.id}><Link href={`/tasks/${t.id}`} className="hover:underline">{t.code} {t.title}</Link> <span className="text-xs text-muted">{dateKey(t.dueDate)}</span></li>)}</ul>
              )}
            </div>
            <div>
              <CardTitle>막힘 {blocked.length ? <Badge tone="red">{blocked.length}</Badge> : null}</CardTitle>
              {blocked.length === 0 ? <p className="text-xs text-muted">없음</p> : (
                <ul className="text-sm space-y-1">{blocked.map((t) => <li key={t.id}><Link href={`/tasks/${t.id}`} className="hover:underline">{t.code} {t.title}</Link><p className="text-xs text-red-700">{t.blockedReason}</p></li>)}</ul>
              )}
            </div>
            <div>
              <CardTitle>최근 제출</CardTitle>
              {subs.length === 0 ? <p className="text-xs text-muted">없음</p> : (
                <ul className="text-sm space-y-1">{subs.map((s) => <li key={s.id} className="flex justify-between gap-2"><Link href={`/tasks/${s.taskInstanceId}`} className="hover:underline truncate">{s.taskInstance.template.code} {s.taskInstance.template.title}</Link><span className={`text-xs shrink-0 ${s.verdict === "PASS" ? "text-green-700" : s.verdict === "REVISE" ? "text-amber-700" : "text-muted"}`}>{s.verdict ?? "검토 전"}</span></li>)}</ul>
              )}
            </div>
          </div>
          {summary && (
            <div className="mt-5 border-t border-border pt-4">
              <CardTitle>주간 요약 · {dateKey(summary.weekStart)} 주</CardTitle>
              <Markdown text={summary.content} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
