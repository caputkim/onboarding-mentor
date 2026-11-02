import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role, type User } from "@prisma/client";
import { redirect } from "next/navigation";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function currentUser(): Promise<User | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  return user && user.active ? user : null;
}

/** 페이지용. 미로그인은 /login, 권한 없음은 홈으로. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

/** API 용. 예외를 던지고 apiError 가 응답으로 바꾼다. */
export async function requireApiUser(roles?: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "unauthorized");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "forbidden");
  return user;
}

export function apiError(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "internal" }, { status: 500 });
}

export const isAdmin = (u: User) => u.role === Role.ADMIN;
export const isMentorOrAdmin = (u: User) => u.role === Role.MENTOR || u.role === Role.ADMIN;
