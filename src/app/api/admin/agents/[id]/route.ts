// PATCH /api/admin/agents/[id] — edit, approve/reject, activate/deactivate.
// Checked here as well as in the proxy: approving or deactivating an agent is
// worth attributing, and the audit entry needs an actor to be worth keeping.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { agentUpdateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, agentUpdateSchema);
  if ("error" in parsed) return parsed.error;

  const [updated] = await db
    .update(agents)
    .set(parsed.data)
    .where(eq(agents.id, id))
    .returning({ id: agents.id });

  if (!updated) return jsonError(404, "Agent not found");

  await logAudit({
    entity: "agent",
    entityId: id,
    action: "update",
    actorId: session.user.id,
    diff: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
