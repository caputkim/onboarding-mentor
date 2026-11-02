/**
 * 개인정보·고객정보 필터 (docs/01_MVP_명세.md §5.3)
 */
import type { Section } from "./sections";

export const PII_FILENAME = /(출석부|명단|연락처|개인정보|계약서|견적|accessKeys|credentials|\.env$|secret)/i;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /(?:^|\D)0\d{1,2}-?\d{3,4}-?\d{4}(?!\d)/g;
const RRN = /\d{6}-[1-4]\d{6}/g;

export function piiCounts(text: string) {
  return {
    emails: (text.match(EMAIL) ?? []).length,
    phones: (text.match(PHONE) ?? []).length,
    rrns: (text.match(RRN) ?? []).length,
  };
}

export type Excluded = { heading: string; reason: string };

/** 섹션 단위로 걸러낸다. 이메일·전화가 3건 이상이거나 주민번호가 1건이라도 있으면 제외. */
export function filterSections(sections: Section[]): { kept: Section[]; excluded: Excluded[] } {
  const kept: Section[] = [];
  const excluded: Excluded[] = [];
  for (const s of sections) {
    const c = piiCounts(s.text);
    if (c.rrns > 0) excluded.push({ heading: s.heading, reason: "주민등록번호 형식" });
    else if (c.emails + c.phones >= 3) excluded.push({ heading: s.heading, reason: `연락처 ${c.emails + c.phones}건` });
    else kept.push(s);
  }
  return { kept, excluded };
}
