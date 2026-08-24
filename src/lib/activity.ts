// Activity timeline: audit events resolved into readable rows, scoped to one
// creator or global, for a given month. Backs /api/me/activity and
// /api/admin/activity.

import { and, desc, eq, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { agents, auditLog, bookings, deliverables, users } from "@/db/schema";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

export type ActivityEvent = {
  at: string; // ISO timestamp
  actor: string | null; // who did it (null = agent / system)
  subject: string | null; // whose plate it's on
  action: string;
  entity: string;
  label: string; // plain-language sentence
  detail: string | null; // permit / comment / reason
  url: string | null; // deliverable link, if any
};

const deliverableWord: Record<string, string> = {
  photo_shoot: "photo",
  video_shoot: "video",
  other: "deliverable",
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

type Row = {
  action: string;
  entity: string;
  diff: unknown;
  dType: string | null;
  dProject: string | null; // the deliverable's shoot project
  dTitle: string | null; // creator-supplied title (untied deliverables)
  dAgent: string | null; // the deliverable's agent
  bProject: string | null;
  bType: DbShootType | null;
};

function describe(r: Row): { label: string; detail: string | null } {
  const diff = (r.diff ?? {}) as Record<string, unknown>;
  const d = (r.dType && deliverableWord[r.dType]) || "deliverable";
  const proj = r.bProject ? ` — ${r.bProject}` : "";
  const shoot = r.bType ? ` (${dbShootTypeLabel[r.bType]})` : "";
  // Name the video/photo by its shoot (or title) and the agent it's for.
  const nameParts = [r.dProject ?? r.dTitle, r.dAgent].filter(Boolean).join(" · ");
  const named = nameParts ? ` — ${nameParts}` : "";

  if (r.entity === "deliverable") {
    switch (r.action) {
      case "create":
        return {
          label: `Logged a ${d}${named}`,
          detail: str(diff.permitNumber) && `Permit ${str(diff.permitNumber)}`,
        };
      case "approve":
        return {
          label: `Approved a ${d}${named}`,
          detail: str(diff.permitNumber) && `Permit ${str(diff.permitNumber)}`,
        };
      case "request_changes":
        return { label: `Requested changes on a ${d}${named}`, detail: str(diff.comment) };
      case "resubmit":
        return { label: `Resubmitted a ${d}${named}`, detail: null };
      case "mark_posted":
        return { label: `Marked a ${d}${named} as posted`, detail: null };
      case "delete":
        return { label: `Removed a ${d}${named}`, detail: null };
    }
  }
  if (r.entity === "booking") {
    switch (r.action) {
      case "create":
        return { label: `Booked a shoot${proj}${shoot}`, detail: null };
      case "create_company":
        return { label: `Company shoot booked${proj}`, detail: null };
      case "reassign":
        return {
          label: `Reassigned a shoot${str(diff.to) ? ` to ${str(diff.to)}` : ""}`,
          detail: null,
        };
      case "cancel":
        return { label: `Cancelled a shoot${proj}`, detail: str(diff.reason) };
      case "cancel_requested":
        return { label: `Cancellation requested${proj}`, detail: str(diff.reason) };
      case "complete":
        return { label: `Shoot completed${proj}`, detail: null };
      case "no_show":
        return { label: `Marked no-show${proj}`, detail: null };
      case "reschedule":
        return { label: `Rescheduled a shoot${proj}`, detail: null };
      case "synced_time_change":
        return { label: `Shoot time updated from calendar`, detail: null };
    }
  }
  if (r.entity === "week_plan") return { label: "Week plan updated", detail: null };
  if (r.entity === "kpi_targets") return { label: "Targets set", detail: null };
  if (r.entity === "agent")
    return { label: r.action === "create" ? "Agent added" : "Agent updated", detail: null };
  if (r.entity === "user") {
    if (r.action === "self_register") return { label: "Registered", detail: null };
    if (r.action === "team_add") return { label: "Team member added", detail: null };
    return { label: "Profile updated", detail: null };
  }
  return { label: `${r.action.replace(/_/g, " ")} ${r.entity}`, detail: null };
}

/**
 * Join an audit row to the row it is about.
 *
 * audit_log.entity_id is text, because permits are integer-keyed — so a plain
 * column comparison against a uuid primary key is `uuid = text`, which Postgres
 * rejects outright (42883) and which took the whole timeline down with it.
 *
 * The uuid is cast to text, not the other way round: the entity guard sits in
 * the same ON clause, and Postgres is free to evaluate `entity_id::uuid` on the
 * permit rows regardless, where it would fail on a value like "12".
 */
export const auditRowFor = (entity: string, id: PgColumn) =>
  sql`${auditLog.entity} = ${entity} and ${id}::text = ${auditLog.entityId}`;

export async function getActivity(params: {
  month: string; // YYYY-MM
  subjectCreatorId?: string; // omit for the global feed
}): Promise<ActivityEvent[]> {
  const actor = alias(users, "actor");
  const subject = alias(users, "subject");
  const dBooking = alias(bookings, "d_booking"); // the deliverable's shoot
  const dAgent = alias(agents, "d_agent"); // the deliverable's agent

  const rows = await db
    .select({
      at: auditLog.createdAt,
      action: auditLog.action,
      entity: auditLog.entity,
      diff: auditLog.diff,
      actorName: actor.fullName,
      subjectName: subject.fullName,
      dType: deliverables.type,
      dUrl: deliverables.url,
      dTitle: deliverables.title,
      dProject: dBooking.projectName,
      dAgent: dAgent.fullName,
      bProject: bookings.projectName,
      bType: bookings.shootType,
    })
    .from(auditLog)
    .leftJoin(actor, eq(actor.id, auditLog.actorId))
    .leftJoin(subject, eq(subject.id, auditLog.subjectCreatorId))
    .leftJoin(deliverables, auditRowFor("deliverable", deliverables.id))
    .leftJoin(dBooking, eq(dBooking.id, deliverables.bookingId))
    .leftJoin(dAgent, eq(dAgent.id, deliverables.agentId))
    .leftJoin(bookings, auditRowFor("booking", bookings.id))
    .where(
      and(
        sql`date_trunc('month', ${auditLog.createdAt} AT TIME ZONE 'Asia/Dubai') = ${`${params.month}-01`}::date`,
        params.subjectCreatorId
          ? eq(auditLog.subjectCreatorId, params.subjectCreatorId)
          : undefined
      )
    )
    .orderBy(desc(auditLog.createdAt));

  return rows.map((r) => {
    const { label, detail } = describe(r);
    return {
      at: r.at?.toISOString() ?? "",
      actor: r.actorName,
      subject: r.subjectName,
      action: r.action,
      entity: r.entity,
      label,
      detail,
      url: r.dUrl ?? null,
    };
  });
}
