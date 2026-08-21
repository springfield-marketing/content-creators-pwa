// Auth.js v5 — Google sign-in for everyone at the company.
//
// Staff (creators, managers, executives) are pre-created and keep whatever
// roles they hold. Anyone else on the company domain provisions themselves as
// an agent on first sign-in: agents book shoots and look up permits, and there
// are ~150 of them, so an invite flow would be all cost and no security — the
// Workspace domain is already the real gate.
//
// Two consequences worth remembering:
//   - isAllowedEmail is now the only thing between a Google account and a
//     session, so it is checked before anything touches the database.
//   - a great many more people hold sessions than before. Routes are gated in
//     src/proxy.ts, which DENIES unmatched paths for exactly this reason.

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAllowedEmail } from "@/lib/domain";

export type Role =
  | "creator"
  | "team_lead"
  | "manager"
  | "executive"
  // The registry axis. Granted per person, never inferred from the roles
  // above — see src/lib/registry/access.ts.
  | "agent"
  | "marketing"
  | "permit_admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      slug: string | null;
    } & DefaultSession["user"];
  }
}

const SELECT = {
  id: users.id,
  roles: users.roles,
  name: users.fullName,
  slug: users.slug,
  isActive: users.isActive,
};

async function userByEmail(email: string) {
  const [row] = await db
    .select(SELECT)
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row;
}

/**
 * The signed-in person, creating them as an agent if this is their first time.
 *
 * Returns undefined for anyone off the company domain, so a caller that
 * forgets the domain check still cannot provision a stranger.
 *
 * A deactivated staff member already has a row, so they are returned as-is
 * (isActive false) and refused by signIn rather than being quietly reborn as
 * an agent.
 */
async function resolveUser(email: string, name?: string | null) {
  const normalised = email.trim().toLowerCase();
  if (!isAllowedEmail(normalised)) return undefined;

  const existing = await userByEmail(normalised);
  if (existing) return existing;

  // full_name is NOT NULL and Google does not always send one.
  const fullName = name?.trim() || normalised.split("@")[0];
  const [created] = await db
    .insert(users)
    .values({ email: normalised, fullName, roles: ["agent"] })
    .onConflictDoNothing({ target: users.email })
    .returning(SELECT);

  // onConflictDoNothing returns nothing if two sign-ins raced; the row exists
  // either way, so read it back rather than failing the second one.
  return created ?? (await userByEmail(normalised));
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
      const row = await resolveUser(user.email, user.name);
      return !!row && row.isActive !== false;
    },
    async jwt({ token, user }) {
      // Re-read on every token read, not just at sign-in.
      //
      // Roles used to be embedded once and never refreshed, which meant a role
      // granted to someone already signed in did nothing until they happened to
      // sign out — and the symptom was silent: the proxy simply bounced them
      // home. That is exactly what happened when permit_admin was granted for
      // the registry. A stale token denying access the database has already
      // allowed is not a trade worth one query.
      //
      // At this headcount an indexed lookup on a unique column costs nothing.
      const email = user?.email ?? token.email;
      if (email) {
        const row = await resolveUser(email, user?.name ?? token.name);
        if (row) {
          token.userId = row.id;
          token.roles = row.roles;
          token.slug = row.slug;
          token.name = row.name;
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
