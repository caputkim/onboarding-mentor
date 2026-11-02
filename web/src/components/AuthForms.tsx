"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction, type AuthFormState } from "@/app/actions/auth";
import { buttonClass, inputClass } from "./ui";

export function LoginForm({ callbackUrl, domain }: { callbackUrl: string; domain: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-3 text-left">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block text-sm">이메일
        <input name="email" type="email" required autoComplete="username" placeholder={`이름@${domain}`} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm">비밀번호
        <input name="password" type="password" required autoComplete="current-password" className={`${inputClass} mt-1`} />
      </label>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      <button className={`${buttonClass("primary")} w-full`} disabled={pending}>{pending ? "확인 중…" : "로그인"}</button>
      <p className="text-xs text-muted text-center pt-2">
        계정이 없나요? <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-accent underline">회원가입</Link>
      </p>
    </form>
  );
}

export function SignupForm({ callbackUrl, domain }: { callbackUrl: string; domain: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-3 text-left">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block text-sm">이름
        <input name="name" required minLength={2} maxLength={40} autoComplete="name" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm">회사 이메일
        <input name="email" type="email" required autoComplete="username" placeholder={`이름@${domain}`} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm">비밀번호
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} />
        <span className="text-xs text-muted">8자 이상, 영문과 숫자 포함</span>
      </label>
      <label className="block text-sm">비밀번호 확인
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} />
      </label>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      <button className={`${buttonClass("primary")} w-full`} disabled={pending}>{pending ? "가입 중…" : "가입하고 시작하기"}</button>
      <p className="text-xs text-muted text-center pt-2">
        이미 계정이 있나요? <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-accent underline">로그인</Link>
      </p>
    </form>
  );
}
