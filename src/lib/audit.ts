// Audit trail for mutations (§B1). Actor is null for agent/manage-link and
// system (webhook) actions.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, bookings, deliverables } from "@/db/schema";

export async function logAudit(params: {
  entity: string;
  entityId: string;
  action: string;
  diff?: unknown;
  actorId?: string | null;
  // The creator the event is about. Pass explicitly, or leave it to be derived
  // for booking/deliverable events (their owner). Powers the activity timeline.
  subjectCreatorId?: string | null;
}) {
  let subject = params.subjectCreatorId ?? null;
  if (!subject && params.entity === "booking") {
    const [row] = await db
      .select({ c: bookings.creatorId })
      .from(bookings)
      .where(eq(bookings.id, params.entityId))
      .limit(1);
    subject = row?.c ?? null;
  } else if (!subject && params.entity === "deliverable") {
    const [row] = await db
      .select({ c: deliverables.creatorId })
      .from(deliverables)
      .where(eq(deliverables.id, params.entityId))
      .limit(1);
    subject = row?.c ?? null;
  }

  await db.insert(auditLog).values({
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    diff: params.diff ?? null,
    actorId: params.actorId ?? null,
    subjectCreatorId: subject,
  });
}
