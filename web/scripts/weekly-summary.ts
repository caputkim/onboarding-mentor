/**
 * 매주 월요일 실행: 활성 온보딩마다 지난 주 요약 생성. 운영에서는 EventBridge → /api/admin/cron/weekly-summary 가 같은 일을 한다.
 *   npm run summary:weekly
 */
import { PrismaClient } from "@prisma/client";
import { runWeeklySummaries } from "../src/agent/summary";

const prisma = new PrismaClient();

runWeeklySummaries()
  .then((r) => { for (const x of r.results) console.log(`${x.onboardingId} ← ${x.weekStart} (${x.chars}자)`); console.log(`완료: ${r.count}건`); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
