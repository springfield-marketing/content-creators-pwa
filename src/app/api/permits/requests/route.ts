// /api/permits/requests — agents and marketing ask for a permit; permit admins
// work the queue.
//
// The requester is taken from the session, never the body: someone must be who
// they are signed in as.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { permitRequests, projects } from "@/db/schema";
import { jsonError, parseBody, rateLimit } from "@/lib/api";
import { can } from "@/lib/registry/access";
import { getRequests } from "@/lib/registry/queries";

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const roles = session.user.roles;
  if (!can(roles, "viewOwnRequests")) return jsonError(403, "Forbidden");

  // Admins get the whole queue; everyone else sees only what they raised.
  const all = can(roles, "viewAllRequests");
  return NextResponse.json(
    await getRequests(all ? undefined : session.user.email!),
  );
}

const schema = z
  .object({
    projectId: z.number().int().positive().nullable().optional(),
    projectName: z.string().trim().max(200).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.projectId != null || !!v.projectName, {
    message: "Name the project you need a permit for.",
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  // Agents can see availability but not raise requests; the UI hides the
  // form, and this stops a hand-rolled POST getting past it.
  if (!can(session.user.roles, "requestPermit")) return jsonError(403, "Forbidden");

  const limited = rateLimit(req, "permit-request", 10);
  if (limited) return limited;

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const { projectId, projectName, note } = parsed.data;

  // A request naming a project that does not exist would sit in the queue
  // pointing at nothing, so verify before writing.
  if (projectId != null) {
    const [found] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!found) return jsonError(422, "That project no longer exists.");
  }

  // Raising the same request twice usually means an impatient second click,
  // not a second permit.
  if (projectId != null) {
    const [open] = await db
      .select({ id: permitRequests.id })
      .from(permitRequests)
      .where(
        and(
          eq(permitRequests.projectId, projectId),
          eq(permitRequests.requestedByEmail, session.user.email!),
          eq(permitRequests.status, "new"),
        ),
      )
      .limit(1);
    if (open) {
      return jsonError(409, "You already have an open request for that project.");
    }
  }

  const [created] = await db
    .insert(permitRequests)
    .values({
      projectId: projectId ?? null,
      // Only meaningful when the project is not tracked yet.
      requestedProjectName: projectId ? null : (projectName ?? null),
      requestedByEmail: session.user.email!,
      note: note || null,
    })
    .returning({ id: permitRequests.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
