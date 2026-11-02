/**
 * 에스컬레이션 답변 → 지식베이스 문서 초안 (연결 역할의 마지막 단계)
 */
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { anthropic, MODEL } from "./client";

const Schema = z.object({
  title: z.string().describe("문서 제목. '~ 안내' '~ 절차' 처럼 명사형. 30자 이내"),
  content: z.string().describe("마크다운 본문. 질문-답변 형식이 아니라 다음 신입이 그대로 읽을 수 있는 안내문으로. 300~800자"),
});

const SYSTEM = `신입이 담당자에게 물어 받은 답변을, 다음 신입이 바로 읽을 수 있는 사내 안내 문서 초안으로 바꿉니다.
- 개인 이름·개인 사정을 넣지 않습니다. "담당자에게 문의" 처럼 역할로 씁니다.
- 답변에 없는 내용을 추측해 보태지 않습니다. 불확실한 부분은 "확인 필요" 로 표시합니다.
- 개조식 또는 짧은 단락. 마크다운 제목은 ## 부터.`;

export async function createDraftFromEscalation(escalationId: string) {
  const esc = await prisma.escalation.findUnique({ where: { id: escalationId }, include: { queryLog: true, draft: true } });
  if (!esc || !esc.answer || esc.draft) return null;
  if (!process.env.ANTHROPIC_API_KEY) {
    return prisma.docDraft.create({
      data: { escalationId, title: esc.question.slice(0, 30), content: `## 질문\n${esc.question}\n\n## 답변\n${esc.answer}` },
    });
  }
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(Schema), effort: "medium" },
    messages: [{ role: "user", content: `[주제] ${esc.queryLog.topic}\n[질문]\n${esc.question}\n\n[담당자 답변]\n${esc.answer}` }],
  });
  const out = response.parsed_output;
  if (!out) return null;
  return prisma.docDraft.create({ data: { escalationId, title: out.title, content: out.content } });
}
