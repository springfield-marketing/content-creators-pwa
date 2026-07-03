// PATCH /api/admin/agents/[id] — edit, approve/reject, activate/deactivate.
// NOTE: role middleware arrives with Auth.js in step 4.

import { NextResponse } from "next/server";
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
    diff: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
