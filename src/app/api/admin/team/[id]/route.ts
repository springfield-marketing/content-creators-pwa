// PATCH /api/admin/team/[id] — activate/deactivate staff access.
// Guards: you can't lock yourself out, and the last active manager
// can't be deactivated.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, arrayContains, arrayOverlaps, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({ isActive: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const { isActive } = parsed.data;

  if (!isActive) {
    if (id === session.user.id) {
      return jsonError(409, "You can't deactivate your own access");
    }
    const [target] = await db
      .select({ roles: users.roles })
      .from(users)
      .where(
        and(
          eq(users.id, id),
          arrayOverlaps(users.roles, ["manager", "executive"])
        )
      )
      .limit(1);
    if (!target) return jsonError(404, "Team member not found");
    if (target.roles.includes("manager")) {
      const others = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            arrayContains(users.roles, ["manager"]),
            eq(users.isActive, true),
            ne(users.id, id)
          )
        );
      if (others.length === 0) {
        return jsonError(409, "At least one active manager is required");
      }
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isActive })
    .where(
      and(eq(users.id, id), arrayOverlaps(users.roles, ["manager", "executive"]))
    )
    .returning({ id: users.id });
  if (!updated) return jsonError(404, "Team member not found");

  await logAudit({
    entity: "user",
    entityId: id,
    action: isActive ? "team_reactivate" : "team_deactivate",
    actorId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
