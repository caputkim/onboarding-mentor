import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { onboardingsVisibleTo } from "@/services/onboardings";
import { createOnboardingAction } from "@/app/actions/admin";
import { dateKey, todayKst } from "@/lib/dates";
import { buttonClass, Card, CardTitle, Empty, inputClass, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/forms";

export default async function OnboardingsPage() {
  const user = await requireUser();
  const [obs, users, tracks] = await Promise.all([
    onboardingsVisibleTo(user),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.track.findMany({ orderBy: { order: "asc" } }),
  ]);
  const staff = users.filter((u) => u.role !== Role.NEWCOMER);
  return (
    <div className="space-y-6">
      <PageHeader title="온보딩 개설" />
      <Card>
        <CardTitle>새 온보딩</CardTitle>
        <ActionForm action={createOnboardingAction} className="grid md:grid-cols-2 gap-4" resetOnSuccess>
          <label className="text-sm">신입
            <select name="newcomerId" required className={`${inputClass} mt-1`}>
              <option value="">선택</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </label>
          <label className="text-sm">멘토
            <select name="mentorId" className={`${inputClass} mt-1`}>
              <option value="">미지정</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>
          <label className="text-sm">시작일
            <input type="date" name="startDate" required defaultValue={dateKey(todayKst())} className={`${inputClass} mt-1`} />
          </label>
          <fieldset className="text-sm">
            <legend>트랙</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {tracks.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5">
                  <input type="checkbox" name="trackSlugs" value={t.slug} defaultChecked={t.slug === "common"} /> {t.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <button className={buttonClass("primary")}>개설</button>
            <p className="text-xs text-muted mt-2">사용자는 회원가입을 해야 목록에 뜹니다. 역할·담당 영역은 “사람” 탭에서.</p>
          </div>
        </ActionForm>
      </Card>
      <Card>
        <CardTitle>목록</CardTitle>
        {obs.length === 0 ? <Empty>없음</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted text-left"><tr><th className="py-1">신입</th><th>트랙</th><th>시작</th><th>멘토</th><th>상태</th><th className="text-right">진행</th></tr></thead>
            <tbody>
              {obs.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="py-2">{o.newcomer.name}</td>
                  <td>{o.tracks.map((t) => t.track.name).join("+")}</td>
                  <td>{dateKey(o.startDate)}</td>
                  <td>{o.mentor?.name ?? "-"}</td>
                  <td>{o.status}</td>
                  <td className="text-right">{o.progress.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
