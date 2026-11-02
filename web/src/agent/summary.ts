/**
 * 멘토용 주간 요약. 입력에 Message 를 넣지 않는다 (docs/01_MVP_명세.md §4.7).
 */
import { OnboardingStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, dateKey, todayKst } from "@/lib/dates";
import { anthropic, MODEL } from "./client";

const SYSTEM = `신입 온보딩의 지난 한 주 데이터를 받아 멘토가 1분 안에 읽을 주간 요약을 씁니다. 마크다운, 300자 내외.
구성: 1) 진행 한 줄 2) 완료한 것 3) 기한 지난 것·막힌 것 (사유 그대로) 4) 질문이 몰린 주제 5) 멘토가 이번 주 챙기면 좋을 것 1~2개.
평가·비교 표현을 쓰지 않습니다. 데이터에 없는 내용을 추측하지 않습니다.`;

export async function buildWeeklyInput(onboardingId: string, weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);
  const [ob, tasks, logs] = await Promise.all([
    prisma.onboarding.findUniqueOrThrow({ where: { id: onboardingId }, include: { newcomer: true, tracks: { include: { track: true } } } }),
    prisma.taskInstance.findMany({ where: { onboardingId }, include: { template: true, submissions: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.queryLog.groupBy({ by: ["topic", "answered"], where: { onboardingId, createdAt: { gte: weekStart, lt: weekEnd } }, _count: { _all: true } }),
  ]);
  // 기준일: 요약 대상 주의 마지막 날 (지난주 요약을 오늘 기준으로 계산하면 어긋난다)
  const asOf = addDays(weekEnd, -1) < todayKst() ? addDays(weekEnd, -1) : todayKst();
  const done = tasks.filter((t) => t.status === TaskStatus.DONE && t.completedAt && t.completedAt >= weekStart && t.completedAt < weekEnd);
  const open: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.SUBMITTED];
  const overdue = tasks.filter((t) => open.includes(t.status) && t.dueDate <= asOf);
  const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED);
  const total = tasks.filter((t) => t.status !== TaskStatus.SKIPPED).length;
  const doneAll = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const lines = [
    `신입: ${ob.newcomer.name} · 트랙: ${ob.tracks.map((t) => t.track.name).join("+")} · 시작 ${dateKey(ob.startDate)} · 주간 ${dateKey(weekStart)}~${dateKey(addDays(weekStart, 6))}`,
    `전체 진행(현재): ${doneAll}/${total}`,
    `기준일: ${dateKey(asOf)} (주간 마지막 날 기준으로 기한 판정)`,
    `이번 주 완료: ${done.map((t) => `${t.template.code} ${t.template.title}${t.submissions[0]?.verdict ? ` (${t.submissions[0].verdict})` : ""}`).join(", ") || "없음"}`,
    `기한 지남: ${overdue.map((t) => `${t.template.code} ${t.template.title} (기한 ${dateKey(t.dueDate)})`).join(", ") || "없음"}`,
    `막힘: ${blocked.map((t) => `${t.template.code} — ${t.blockedReason ?? "사유 없음"}`).join("; ") || "없음"}`,
    `질문 주제: ${logs.map((l) => `${l.topic}(${l.answered ? "답변" : "미응답"}) ${l._count._all}건`).join(", ") || "없음"}`,
  ];
  return { ob, text: lines.join("\n") };
}

export async function generateWeeklySummary(onboardingId: string, weekStart: Date) {
  const { text } = await buildWeeklyInput(onboardingId, weekStart);
  let content: string;
  if (process.env.ANTHROPIC_API_KEY) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: text }],
    });
    content = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  } else {
    content = `(모델 미설정 — 원자료)\n\n${text}`;
  }
  return prisma.weeklySummary.upsert({
    where: { onboardingId_weekStart: { onboardingId, weekStart } },
    create: { onboardingId, weekStart, content },
    update: { content },
  });
}

/** 매주 월요일 실행: 활성 온보딩마다 지난 주(월~일) 요약 생성. scripts/weekly-summary.ts 와 cron API 가 공용으로 쓴다. */
export async function runWeeklySummaries() {
  const today = todayKst();
  const dow = today.getUTCDay(); // 0=일
  const thisMonday = addDays(today, -((dow + 6) % 7));
  const lastMonday = addDays(thisMonday, -7);
  const obs = await prisma.onboarding.findMany({ where: { status: OnboardingStatus.ACTIVE }, select: { id: true } });
  const results = [];
  for (const ob of obs) {
    const s = await generateWeeklySummary(ob.id, lastMonday);
    results.push({ onboardingId: ob.id, weekStart: dateKey(s.weekStart), chars: s.content.length });
  }
  return { weekStart: dateKey(lastMonday), count: results.length, results };
}
