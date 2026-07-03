// POST /api/agents — public self-registration from the booking form.
// New agents are created unapproved and land in the manager's inbox.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { jsonError, parseBody, rateLimit } from "@/lib/api";
import { agentCreateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const limited = rateLimit(req, "agent-register", 5);
  if (limited) return limited;

  const parsed = await parseBody(req, agentCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { fullName, email, phone, office } = parsed.data;

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.email, email))
    .limit(1);
  if (existing) {
    return jsonError(409, "An agent with this email already exists");
  }

  const [created] = await db
    .insert(agents)
    .values({ fullName, email, phone, office, isApproved: false })
    .returning({ id: agents.id, name: agents.fullName });

  await logAudit({
    entity: "agent",
    entityId: created.id,
    action: "self_register",
    diff: { fullName, email },
  });

  return NextResponse.json(created, { status: 201 });
}
