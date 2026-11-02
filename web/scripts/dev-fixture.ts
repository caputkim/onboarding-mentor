/**
 * 개발·테스트용 계정과 온보딩을 만든다. production 에서는 실행하지 않는다.
 *   npx tsx scripts/dev-fixture.ts
 * 계정 (비밀번호 모두 Test12345):
 *   onboard.test@nxtcloud.kr 신입 · mentor.test@nxtcloud.kr 멘토(담당)
 *   ops.test@nxtcloud.kr 운영자 · cloud.test@nxtcloud.kr 멘토(클라우드) · dev.test@nxtcloud.kr 구성원(개발)
 * 뒤의 세 명은 사람 디렉터리·담당자 찾기·운영자 콘솔 확인용이며 온보딩은 없다.
 */
import { OnboardingStatus, PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { addDays, todayKst } from "../src/lib/dates";

const prisma = new PrismaClient();
const PASSWORD = "Test12345";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("production 에서는 실행 금지");
  const passwordHash = await hashPassword(PASSWORD);
  const resp = ["결과보고서", "교육 운영", "휴가 규정"];
  const mentor = await prisma.user.upsert({
    where: { email: "mentor.test@nxtcloud.kr" },
    create: { email: "mentor.test@nxtcloud.kr", name: "박멘토", role: Role.MENTOR, title: "교육사업팀장", responsibilities: resp, passwordHash },
    update: { role: Role.MENTOR, title: "교육사업팀장", responsibilities: resp, passwordHash },
  });
  const newcomer = await prisma.user.upsert({
    where: { email: "onboard.test@nxtcloud.kr" },
    create: { email: "onboard.test@nxtcloud.kr", name: "이신입", role: Role.NEWCOMER, passwordHash },
    update: { passwordHash },
  });
  // 디렉터리용 구성원 (온보딩 없음). responsibilities 는 find_person 도구가 담당자를 고를 때 쓴다.
  const extras: { email: string; name: string; role: Role; title: string; responsibilities: string[] }[] = [
    { email: "ops.test@nxtcloud.kr", name: "최운영", role: Role.ADMIN, title: "경영지원", responsibilities: ["계정·장비", "휴가·근태", "경비 정산", "Slack 관리", "온보딩 플랫폼 운영"] },
    { email: "cloud.test@nxtcloud.kr", name: "한클라우드", role: Role.MENTOR, title: "클라우드사업팀장", responsibilities: ["AWS 계정 관리", "MSP 운영", "LLM Gateway 인프라", "자격증명·보안"] },
    { email: "dev.test@nxtcloud.kr", name: "정개발", role: Role.NEWCOMER, title: "개발팀 리드", responsibilities: ["AI Makers", "AI Professor", "CertiNavigator", "GitHub 리포 관리"] },
  ];
  for (const x of extras) {
    await prisma.user.upsert({
      where: { email: x.email },
      create: { ...x, passwordHash },
      update: { role: x.role, title: x.title, responsibilities: x.responsibilities, passwordHash },
    });
  }
  let ob = await prisma.onboarding.findFirst({ where: { newcomerId: newcomer.id, status: { in: [OnboardingStatus.ACTIVE, OnboardingStatus.PLANNED] } } });
  if (!ob) {
    const tracks = await prisma.track.findMany({ where: { slug: { in: ["common", "education"] } }, include: { phases: { include: { tasks: true } } } });
    const startDate = addDays(todayKst(), -3);
    const created = await prisma.onboarding.create({
      data: { newcomerId: newcomer.id, mentorId: mentor.id, startDate, status: OnboardingStatus.ACTIVE, tracks: { create: tracks.map((t) => ({ trackId: t.id })) } },
    });
    await prisma.taskInstance.createMany({
      data: tracks.flatMap((t) => t.phases.flatMap((p) => p.tasks.map((tt) => ({ onboardingId: created.id, templateId: tt.id, dueDate: addDays(startDate, tt.dueOffsetDays) })))),
    });
    ob = created;
  }
  const count = await prisma.taskInstance.count({ where: { onboardingId: ob.id } });
  console.log(`신입 ${newcomer.email} · 멘토 ${mentor.email} · 구성원 ${extras.map((x) => x.email).join(", ")} · 비밀번호 ${PASSWORD} · 온보딩 ${ob.id} (과제 ${count})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
