/**
 * DB 를 건드리지 않는 Auth.js 설정. proxy.ts(JWT 검사)와 auth.ts 가 공유한다.
 * 프로바이더(이메일·비밀번호)는 DB 가 필요하므로 auth.ts 에만 둔다.
 */
import type { NextAuthConfig } from "next-auth";

export const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "nxtcloud.kr").toLowerCase();

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isCompanyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email) && email.endsWith(`@${ALLOWED_DOMAIN}`);
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers: [],
} satisfies NextAuthConfig;
