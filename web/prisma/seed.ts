/**
 * 시드: 최초 운영자 + plans/*.md 가져오기.
 *   npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePlan } from "../src/lib/plans/parse";
import { hashPassword } from "../src/lib/password";
import { applyPlan } from "../src/lib/plans/import";

const prisma = new PrismaClient();
const PLANS_DIR = join(process.cwd(), "..", "plans");

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (email) {
    const passwordHash = process.env.SEED_ADMIN_PASSWORD ? await hashPassword(process.env.SEED_ADMIN_PASSWORD) : undefined;
    const admin = await prisma.user.upsert({
      where: { email },
      create: { email, name: process.env.SEED_ADMIN_NAME ?? email.split("@")[0], role: Role.ADMIN, passwordHash },
      update: { role: Role.ADMIN, ...(passwordHash ? { passwordHash } : {}) },
    });
    console.log(`운영자: ${admin.email}${passwordHash ? " (비밀번호 설정)" : " (비밀번호는 회원가입 화면에서 설정)"}`);
  } else {
    console.log("SEED_ADMIN_EMAIL 없음 — 운영자 시드 건너뜀");
  }

  const files = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md")).sort();
  let order = 0;
  for (const f of files) {
    const plan = parsePlan(readFileSync(join(PLANS_DIR, f), "utf8"));
    const diff = await applyPlan(prisma, plan, order++);
    const counts = diff.tasks.reduce((acc, t) => ((acc[t.action] = (acc[t.action] ?? 0) + 1), acc), {} as Record<string, number>);
    console.log(`${f} → track=${plan.slug} phases=${plan.phases.length} tasks=${JSON.stringify(counts)}${diff.orphans.length ? ` orphans=${diff.orphans.join(",")}` : ""}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
