// /api/admin/agents — master agent list (GET) and manual add (POST).
// The proxy gates /api/admin to managers; these check the session again so the
// route doesn't depend solely on it, and so the audit entry has an actor.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { agentCreateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const rows = await db
    .select({
      id: agents.id,
      name: agents.fullName,
      email: agents.email,
      phone: agents.phone,
      office: agents.office,
      isApproved: agents.isApproved,
      isActive: agents.isActive,
    })
    .from(agents)
    .orderBy(asc(agents.fullName));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, agentCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { fullName, email, phone, office } = parsed.data;

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.email, email))
    .limit(1);
  if (existing) return jsonError(409, "An agent with this email already exists");

  const [created] = await db
    .insert(agents)
    .values({ fullName, email, phone, office })
    .returning({ id: agents.id });

  await logAudit({
    entity: "agent",
    entityId: created.id,
    action: "create",
    actorId: session.user.id,
    diff: parsed.data,
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
