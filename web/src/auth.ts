import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig, isCompanyEmail, normalizeEmail } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "이메일·비밀번호",
      credentials: { email: { label: "이메일", type: "email" }, password: { label: "비밀번호", type: "password" } },
      authorize: async (creds) => {
        const email = normalizeEmail(String(creds?.email ?? ""));
        const password = String(creds?.password ?? "");
        if (!isCompanyEmail(email) || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active || !user.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") (session.user as { id?: string }).id = token.uid;
      return session;
    },
  },
});
