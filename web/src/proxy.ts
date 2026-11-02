/**
 * 로그인 게이트 (낙관적 검사). 권한 검사는 서비스 계층(lib/session.ts)이 한다.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// 세션 대신 Bearer 토큰으로 인증하는 경로는 여기서 통과시킨다 (각 라우트가 토큰을 검사)
const PUBLIC_PREFIXES = ["/login", "/signup", "/api/auth", "/api/admin/ingest", "/api/admin/cron"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.auth?.user) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/login", req.url);
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
