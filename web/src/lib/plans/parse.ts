/**
 * plans/*.md 파서. 형식은 docs/02_데이터모델.md §5.
 *
 *   track: common
 *   name: 공통
 *   ## Phase: 1주차 (D+0 ~ D+6)
 *   | ID | 제목 | 유형 | 기한 | 설명 | 제출물 | 평가 기준 | 참고 문서 | 선택 |
 */
import { TaskType } from "@prisma/client";

export type ParsedTask = {
  code: string;
  title: string;
  type: TaskType;
  dueOffsetDays: number;
  description: string;
  evidence: string | null;
  rubric: string | null;
  docRefs: string[];
  optional: boolean;
  order: number;
};

export type ParsedPhase = {
  name: string;
  order: number;
  startOffsetDays: number;
  endOffsetDays: number;
  tasks: ParsedTask[];
};

export type ParsedPlan = {
  slug: string;
  name: string;
  phases: ParsedPhase[];
};

const TASK_TYPES = new Set<string>(Object.values(TaskType));
const COLUMNS = ["ID", "제목", "유형", "기한", "설명", "제출물", "평가 기준", "참고 문서", "선택"];

export class PlanParseError extends Error {
  constructor(message: string, public readonly line: number) {
    super(`${line}행: ${message}`);
  }
}

function parseOffset(raw: string, line: number): number {
  const m = raw.trim().match(/^D?([+-]?\d+)$/);
  if (!m) throw new PlanParseError(`기한/오프셋 형식이 아님: "${raw}"`, line);
  return Number(m[1]);
}

function splitRow(row: string): string[] {
  // 앞뒤 '|' 제거 후 분리. 셀 안의 '|' 는 지원하지 않는다 (플랜 작성 규칙).
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

export function parsePlan(markdown: string): ParsedPlan {
  const lines = markdown.split(/\r?\n/);
  let slug: string | null = null;
  let name: string | null = null;
  const phases: ParsedPhase[] = [];
  let current: ParsedPhase | null = null;
  let inTable = false;
  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    const meta = line.match(/^(track|name):\s*(.+)$/);
    if (meta && !current) {
      if (meta[1] === "track") slug = meta[2].trim();
      else name = meta[2].trim();
      continue;
    }

    const phase = line.match(/^##\s*Phase:\s*(.+?)\s*\(D([+-]?\d+)\s*~\s*D([+-]?\d+)\)\s*$/);
    if (phase) {
      current = {
        name: phase[1].trim(),
        order: phases.length,
        startOffsetDays: Number(phase[2]),
        endOffsetDays: Number(phase[3]),
        tasks: [],
      };
      phases.push(current);
      inTable = false;
      headerSeen = false;
      continue;
    }

    if (!line.trim().startsWith("|")) {
      inTable = false;
      continue;
    }
    if (!current) throw new PlanParseError("Phase 밖에 표가 있음", n);

    const cells = splitRow(line);
    if (!inTable) {
      // 헤더 행
      if (cells.length !== COLUMNS.length || cells.some((c, idx) => c !== COLUMNS[idx])) {
        throw new PlanParseError(`표 헤더가 규칙과 다름. 기대: ${COLUMNS.join(" | ")}`, n);
      }
      inTable = true;
      headerSeen = true;
      continue;
    }
    if (headerSeen && /^\|?\s*-+/.test(line.trim())) {
      headerSeen = false; // 구분선
      continue;
    }
    if (cells.length !== COLUMNS.length) {
      throw new PlanParseError(`열 수가 ${cells.length}개 (기대 ${COLUMNS.length})`, n);
    }
    const [code, title, typeRaw, dueRaw, description, evidence, rubric, docRefsRaw, optionalRaw] = cells;
    if (!code) throw new PlanParseError("ID 가 비어 있음", n);
    if (!TASK_TYPES.has(typeRaw)) throw new PlanParseError(`유형 "${typeRaw}" 은 허용 목록 밖`, n);
    if (current.tasks.some((t) => t.code === code)) throw new PlanParseError(`ID 중복: ${code}`, n);

    current.tasks.push({
      code,
      title,
      type: typeRaw as TaskType,
      dueOffsetDays: parseOffset(dueRaw, n),
      description,
      evidence: evidence || null,
      rubric: rubric || null,
      docRefs: docRefsRaw ? docRefsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      optional: optionalRaw === "선택",
      order: current.tasks.length,
    });
  }

  if (!slug) throw new PlanParseError("`track:` 메타가 없음", 0);
  if (!name) throw new PlanParseError("`name:` 메타가 없음", 0);
  if (phases.length === 0) throw new PlanParseError("Phase 가 하나도 없음", 0);
  return { slug, name, phases };
}
