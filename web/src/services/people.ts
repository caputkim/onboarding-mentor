/**
 * 사람 디렉터리. User.responsibilities 를 쓴다. 연락처는 반환하지 않는다.
 */
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type Person = { id: string; name: string; title: string | null; role: Role; responsibilities: string[] };

export async function directory(): Promise<Person[]> {
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, title: true, role: true, responsibilities: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
}

/** 주제어와 담당 영역·직함의 부분 일치로 점수를 매긴다. 아무도 없으면 운영자. */
export async function findPeople(topic: string, limit = 3): Promise<Person[]> {
  const all = await directory();
  const terms = topic.toLowerCase().split(/[\s,·/]+/).filter((t) => t.length >= 2);
  const scored = all
    .map((p) => {
      const hay = [p.title ?? "", ...p.responsibilities].join(" ").toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
  if (scored.length) return scored;
  return all.filter((p) => p.role === Role.ADMIN).slice(0, limit);
}
