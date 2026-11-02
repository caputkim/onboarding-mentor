/**
 * 과제 검토 결과의 형식. 검토 실행(reviewSubmission)은 신입 서비스(newcomer)가 하고,
 * 이 서비스는 Submission.agentFeedback 을 읽어 화면에 보여주기만 하므로 스키마·타입만 둔다.
 * 두 서비스의 ReviewSchema 는 같아야 한다.
 */
import { z } from "zod";

export const ReviewSchema = z.object({
  verdict: z.enum(["PASS", "REVISE"]),
  summary: z.string().describe("두세 문장 총평. 존댓말"),
  findings: z.array(
    z.object({
      item: z.string().describe("평가 기준의 어느 항목인지"),
      severity: z.enum(["high", "medium", "low"]),
      quote: z.string().nullable().describe("제출물에서 문제가 된 부분 인용. 없으면 null"),
      suggestion: z.string().describe("어떻게 고치면 되는지"),
    }),
  ),
});
export type Review = z.infer<typeof ReviewSchema>;
