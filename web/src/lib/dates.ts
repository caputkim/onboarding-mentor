/**
 * 날짜는 모두 "UTC 자정 Date" 로 다룬다. Prisma @db.Date 가 그렇게 돌려주기 때문이다.
 * 오늘은 KST 기준.
 */
const DAY = 86_400_000;

export function todayKst(): Date {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);
export const dateKey = (d: Date): string => d.toISOString().slice(0, 10);
export const diffDays = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / DAY);

export function parseDateKey(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`날짜 형식 오류: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatKo(d: Date): string {
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}

export function formatKoShort(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
