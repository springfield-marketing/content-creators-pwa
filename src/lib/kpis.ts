// Live KPI aggregation (§B6). One implementation for the creator's progress
// screen, the manager dashboard, and executive reports.
// Decision #10: only APPROVED deliverables count toward targets; submitted
// totals are reported alongside. §B12.1: only creator-initiated cancellations
// attribute to the creator.

import { sql } from "drizzle-orm";
import { db } from "@/db";

export type CreatorKpis = {
  creatorId: string;
  creatorName: string;
  // Which targets apply. Before this existed, discipline was inferred from
  // whichever target was non-zero — which mis-scored a photographer carrying a
  // leftover deliverables target from before the split.
  craft: "video" | "photo" | "both";
  booked: number;
  completed: number;
  cancelled: number;
  cancelledByCreator: number;
  cancellationReasons: Record<string, number>;
  noShows: number;
  overtimeMinutes: number;
  submitted: number;
  approved: number;
  needsRevision: number;
  posted: number;
  avgTurnaroundHours: number | null;
  // Photo volume: a photo shoot is one folder link, so deliverable counts
  // undervalue it against per-clip videos. Summed over approved photo work.
  imagesDelivered: number;
  targetShoots: number;
  targetDeliverables: number;
  targetPosted: number;
  targetImages: number;
};

export async function computeKpis(month: string): Promise<CreatorKpis[]> {
  const monthStart = `${month}-01`;

  const bookingAgg = await db.execute(sql`
    SELECT u.id AS creator_id, u.full_name, u.craft,
      COUNT(b.id)::int AS booked,
      COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE b.status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE b.status = 'cancelled' AND b.cancelled_by = 'creator')::int AS cancelled_by_creator,
      COUNT(*) FILTER (WHERE b.status = 'no_show')::int AS no_shows,
      COALESCE(SUM(EXTRACT(EPOCH FROM (b.actual_ends_at - b.ends_at)) / 60)
        FILTER (WHERE b.actual_ends_at > b.ends_at), 0)::int AS overtime_minutes
    FROM users u
    LEFT JOIN bookings b ON b.creator_id = u.id
      AND date_trunc('month', b.starts_at AT TIME ZONE 'Asia/Dubai') = ${monthStart}::date
    WHERE 'creator' = ANY(u.roles) AND u.is_active
    GROUP BY u.id, u.full_name, u.craft
    ORDER BY u.full_name
  `);

  const reasonAgg = await db.execute(sql`
    SELECT b.creator_id, COALESCE(b.cancellation_reason, '(no reason)') AS reason, COUNT(*)::int AS n
    FROM bookings b
    WHERE b.status = 'cancelled'
      AND date_trunc('month', b.starts_at AT TIME ZONE 'Asia/Dubai') = ${monthStart}::date
    GROUP BY b.creator_id, reason
  `);

  const deliverableAgg = await db.execute(sql`
    SELECT d.creator_id,
      COUNT(*)::int AS submitted,
      COUNT(*) FILTER (WHERE d.review_status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE d.review_status = 'needs_revision')::int AS needs_revision,
      COUNT(*) FILTER (WHERE d.is_posted)::int AS posted,
      COALESCE(SUM(d.image_count) FILTER (WHERE d.review_status = 'approved'), 0)::int AS images_delivered,
      AVG(EXTRACT(EPOCH FROM (d.created_at - b.ends_at)) / 3600)
        FILTER (WHERE d.booking_id IS NOT NULL) AS avg_turnaround_hours
    FROM deliverables d
    LEFT JOIN bookings b ON b.id = d.booking_id
    WHERE date_trunc('month', d.work_date) = ${monthStart}::date
    GROUP BY d.creator_id
  `);

  const targetsAgg = await db.execute(sql`
    SELECT creator_id, target_shoots, target_deliverables, target_posted, target_images
    FROM kpi_targets WHERE month = ${monthStart}::date
  `);

  type Row = Record<string, unknown>;
  const byId = <T extends Row>(rows: T[], key = "creator_id") =>
    new Map(rows.map((r) => [String(r[key]), r]));

  const reasons = new Map<string, Record<string, number>>();
  for (const r of reasonAgg.rows as Row[]) {
    const id = String(r.creator_id);
    const entry = reasons.get(id) ?? {};
    entry[String(r.reason)] = Number(r.n);
    reasons.set(id, entry);
  }

  const dMap = byId(deliverableAgg.rows as Row[]);
  const tMap = byId(targetsAgg.rows as Row[]);

  return (bookingAgg.rows as Row[]).map((r) => {
    const id = String(r.creator_id);
    const d = dMap.get(id);
    const t = tMap.get(id);
    return {
      creatorId: id,
      creatorName: String(r.full_name),
      craft: String(r.craft) as CreatorKpis["craft"],
      booked: Number(r.booked),
      completed: Number(r.completed),
      cancelled: Number(r.cancelled),
      cancelledByCreator: Number(r.cancelled_by_creator),
      cancellationReasons: reasons.get(id) ?? {},
      noShows: Number(r.no_shows),
      overtimeMinutes: Number(r.overtime_minutes),
      submitted: d ? Number(d.submitted) : 0,
      approved: d ? Number(d.approved) : 0,
      needsRevision: d ? Number(d.needs_revision) : 0,
      posted: d ? Number(d.posted) : 0,
      avgTurnaroundHours:
        d && d.avg_turnaround_hours !== null
          ? Math.round(Number(d.avg_turnaround_hours) * 10) / 10
          : null,
      imagesDelivered: d ? Number(d.images_delivered) : 0,
      targetShoots: t ? Number(t.target_shoots) : 0,
      targetDeliverables: t ? Number(t.target_deliverables) : 0,
      targetPosted: t ? Number(t.target_posted) : 0,
      targetImages: t ? Number(t.target_images ?? 0) : 0,
    };
  });
}
