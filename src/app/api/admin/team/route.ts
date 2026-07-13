// /api/admin/team — staff access management (managers + executives).
// Creators are managed via their own screen (they need calendar + booking
// setup); this list is about who can sign in to admin/reports.

import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const rows = await db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(inArray(users.role, ["manager", "executive"]))
    .orderBy(asc(users.fullName));
  return NextResponse.json(rows);
}

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .refine((e) => e.endsWith("@springfield-re.com"), {
      message: "Must be a company Google account (@springfield-re.com)",
    }),
  role: z.enum(["manager", "executive"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, createSchema);
  if ("error" in parsed) return parsed.error;
  const { fullName, email, role } = parsed.data;

  const [existing] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return jsonError(
      409,
      existing.isActive
        ? "This email already has access"
        : "This email exists but is deactivated — reactivate it instead"
    );
  }

  const [created] = await db
    .insert(users)
    .values({ email, fullName, role })
    .returning({ id: users.id });

  await logAudit({
    entity: "user",
    entityId: created.id,
    action: "team_add",
    actorId: session.user.id,
    diff: { email, role },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
