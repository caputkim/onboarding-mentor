/**
 * 문서 텍스트를 섹션으로 나눈다. 제목 기호: #, Ⅰ., 1., □, 【 】. (docs/01_MVP_명세.md §5.2)
 */
export type Section = { heading: string; text: string };

const HEADING_RE = /^(?:#{1,6}\s+\S.*|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.\s*\S.*|\d{1,2}\.\s+\S.*|□\s*\S.*|【.+】|\[.{1,40}\])$/;
const MAX_HEADING_LEN = 120;

export function splitSections(text: string, maxChars = 4000): Section[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const raw: Section[] = [];
  let current: Section = { heading: "(머리말)", text: "" };
  let inFence = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("```")) inFence = !inFence; // 코드 블록 안의 번호 줄은 제목이 아니다
    if (!inFence && t.length > 0 && t.length <= MAX_HEADING_LEN && HEADING_RE.test(t)) {
      if (current.text.trim()) raw.push(current);
      current = { heading: t.replace(/^#{1,6}\s+/, ""), text: "" };
      continue;
    }
    current.text += line + "\n";
  }
  if (current.text.trim()) raw.push(current);

  const out: Section[] = [];
  for (const s of raw) {
    const body = s.text.trim();
    if (body.length <= maxChars) {
      out.push({ heading: s.heading, text: body });
      continue;
    }
    const paras = body.split(/\n{2,}/);
    let chunk = "";
    let n = 1;
    for (const p of paras) {
      if (chunk && chunk.length + p.length + 2 > maxChars) {
        out.push({ heading: `${s.heading} (${n++})`, text: chunk.trim() });
        chunk = "";
      }
      if (p.length > maxChars) {
        for (let i = 0; i < p.length; i += maxChars) out.push({ heading: `${s.heading} (${n++})`, text: p.slice(i, i + maxChars) });
        continue;
      }
      chunk += p + "\n\n";
    }
    if (chunk.trim()) out.push({ heading: `${s.heading} (${n})`, text: chunk.trim() });
  }
  return out.filter((s) => s.text.length > 0);
}
