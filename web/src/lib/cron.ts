/**
 * 배치 엔드포인트 인증. EventBridge API Destination 이 Authorization: Bearer <CRON_TOKEN> 으로 호출한다.
 */
import type { NextRequest } from "next/server";

export function authorizeCron(req: NextRequest): Response | null {
  const token = process.env.CRON_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  if (!token || header !== `Bearer ${token}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
