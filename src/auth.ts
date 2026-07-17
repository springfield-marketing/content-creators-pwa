// Auth.js v5 — Google sign-in for staff (creators, manager, executives).
// Access is allow-listed: the Google account's email must exist in users.
// Agents never log in (public booking flow + signed manage links).

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type Role = "creator" | "team_lead" | "manager" | "executive";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      slug: string | null;
    } & DefaultSession["user"];
  }
}

async function staffByEmail(email: string) {
  const [row] = await db
    .select({
      id: users.id,
      roles: users.roles,
      name: users.fullName,
      slug: users.slug,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // required behind Vercel's proxy
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const staff = await staffByEmail(user.email);
      return !!staff && staff.isActive !== false;
    },
    async jwt({ token, user }) {
      // On initial sign-in, embed the app roles so the proxy can gate
      // routes without a database round-trip per request.
      if (user?.email) {
        const staff = await staffByEmail(user.email);
        if (staff) {
          token.userId = staff.id;
          token.roles = staff.roles;
          token.slug = staff.slug;
          token.name = staff.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.roles = (token.roles as Role[]) ?? [];
      session.user.slug = (token.slug as string | null) ?? null;
      if (token.name) session.user.name = token.name;
      return session;
    },
  },
});
