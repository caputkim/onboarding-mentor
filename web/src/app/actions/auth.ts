"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/password";
import { ALLOWED_DOMAIN, isCompanyEmail, normalizeEmail } from "@/auth.config";

export type AuthFormState = { error?: string } | undefined;

function safeCallback(url: string | null | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeCallback(String(formData.get("callbackUrl") ?? "/"));
  if (!isCompanyEmail(email)) return { error: `@${ALLOWED_DOMAIN} 이메일만 쓸 수 있습니다.` };
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    throw e; // redirect
  }
  return undefined;
}

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const redirectTo = safeCallback(String(formData.get("callbackUrl") ?? "/"));

  if (name.length < 2 || name.length > 40) return { error: "이름은 2~40자로 적어 주세요." };
  if (!isCompanyEmail(email)) return { error: `회사 이메일(@${ALLOWED_DOMAIN})만 가입할 수 있습니다.` };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "비밀번호 확인이 일치하지 않습니다." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { error: "이미 가입된 이메일입니다. 로그인해 주세요." };
  if (existing && !existing.active) return { error: "비활성 계정입니다. 운영자에게 문의해 주세요." };

  const passwordHash = await hashPassword(password);
  if (existing) {
    // 운영자가 미리 만들어 둔 계정(시드 등)은 가입으로 비밀번호를 설정한다. 역할은 유지.
    await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
  } else {
    // 운영자 부트스트랩: 아직 운영자가 없고 SEED_ADMIN_EMAIL 과 같은 이메일이면 운영자로 (시드 스크립트 없이도 첫 운영자 생성)
    const bootstrapAdmin =
      !!process.env.SEED_ADMIN_EMAIL &&
      email === normalizeEmail(process.env.SEED_ADMIN_EMAIL) &&
      (await prisma.user.count({ where: { role: Role.ADMIN } })) === 0;
    await prisma.user.create({ data: { email, name, passwordHash, role: bootstrapAdmin ? Role.ADMIN : Role.NEWCOMER } });
  }
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: "가입은 됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해 주세요." };
    throw e;
  }
  return undefined;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
