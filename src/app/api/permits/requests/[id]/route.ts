// PATCH /api/permits/requests/[id] — an admin moves a request through the
// queue. "issued" is not settable here: a request becomes issued by actually
// issuing a permit, which /api/permits/issue does as its final step.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { permitRequests } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { can } from "@/lib/registry/access";

const schema = z.object({
  status: z.enum(["new", "in_progress", "rejected"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "viewAllRequests")) return jsonError(403, "Forbidden");

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return jsonError(400, "Invalid request id");
  }

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const { status } = parsed.data;

  const [updated] = await db
    .update(permitRequests)
    .set({
      status,
      // Reopening clears the resolution, so a request bounced back to the
      // queue does not keep a date saying it was settled.
      resolvedAt: status === "rejected" ? new Date() : null,
    })
    .where(eq(permitRequests.id, requestId))
    .returning({ id: permitRequests.id });
  if (!updated) return jsonError(404, "Request not found");

  return NextResponse.json({ ok: true });
}
