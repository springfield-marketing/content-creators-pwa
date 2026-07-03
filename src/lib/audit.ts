// Audit trail for mutations (§B1). Actor is null until Auth.js lands (step 4).

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function logAudit(params: {
  entity: string;
  entityId: string;
  action: string;
  diff?: unknown;
  actorId?: string | null;
}) {
  await db.insert(auditLog).values({
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    diff: params.diff ?? null,
    actorId: params.actorId ?? null,
  });
}
