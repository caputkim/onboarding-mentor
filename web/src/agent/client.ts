import Anthropic from "@anthropic-ai/sdk";

/** 모델은 환경변수로 바꿀 수 있다. 기본은 Claude Opus 5.5. */
export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const globalForClient = globalThis as unknown as { anthropic?: Anthropic };
export const anthropic = globalForClient.anthropic ?? new Anthropic({ maxRetries: 2 });
if (process.env.NODE_ENV !== "production") globalForClient.anthropic = anthropic;

/** 질문 로그·요약 같은 가벼운 호출의 주제 분류 축. 공백 리포트의 집계 키. */
export const TOPICS = [
  "규정·인사",
  "도구·계정",
  "보고서 작성",
  "교육 운영",
  "AWS·기술",
  "회사·사업",
  "사람·담당",
  "과제·플랜",
  "기타",
] as const;
export type Topic = (typeof TOPICS)[number];
