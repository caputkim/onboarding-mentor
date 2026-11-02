import { listUsers } from "@/services/admin";
import { updateUserAction } from "@/app/actions/admin";
import { buttonClass, Card, CardTitle, inputClass, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/forms";

export default async function PeoplePage() {
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <PageHeader title="사람 디렉터리" description="담당 영역은 쉼표로 구분합니다. 에이전트가 “누구에게 물어볼까”를 판단하는 근거입니다. 연락처는 저장하지 않습니다." />
      <Card>
        <CardTitle>구성원 {users.length}명</CardTitle>
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <ActionForm action={updateUserAction} className="grid md:grid-cols-[180px_110px_150px_1fr_80px_80px] gap-2 items-center text-sm">
                <input type="hidden" name="id" value={u.id} />
                <div className="min-w-0"><p className="font-medium truncate">{u.name}</p><p className="text-xs text-muted truncate">{u.email}</p></div>
                <select name="role" defaultValue={u.role} className={inputClass}>
                  <option value="NEWCOMER">구성원/신입</option>
                  <option value="MENTOR">멘토</option>
                  <option value="ADMIN">운영자</option>
                </select>
                <input name="title" defaultValue={u.title ?? ""} placeholder="직함" className={inputClass} />
                <input name="responsibilities" defaultValue={u.responsibilities.join(", ")} placeholder="담당 영역 (예: 휴가 규정, AWS 계정, 결과보고서)" className={inputClass} />
                <label className="text-xs flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={u.active} /> 활성</label>
                <button className={buttonClass("secondary", "sm")}>저장</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
