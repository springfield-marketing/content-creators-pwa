// GET /api/creators — active creators for the public booking page.

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select({ id: users.id, slug: users.slug, name: users.fullName })
    .from(users)
    .where(and(eq(users.role, "creator"), eq(users.isActive, true)))
    .orderBy(asc(users.fullName));

  return NextResponse.json(rows);
}
