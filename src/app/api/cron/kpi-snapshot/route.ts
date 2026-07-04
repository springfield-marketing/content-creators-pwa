// GET /api/cron/kpi-snapshot — nightly snapshot for history/trends (§B6).

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { db } from "@/db";
import { kpiSnapshots } from "@/db/schema";
import { computeKpis } from "@/lib/kpis";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "Unauthorized");
  }

  const month = dayjs().format("YYYY-MM");
  const kpis = await computeKpis(month);
  const today = dayjs().format("YYYY-MM-DD");

  for (const k of kpis) {
    await db
      .insert(kpiSnapshots)
      .values({
        creatorId: k.creatorId,
        snapshotDate: today,
        month: `${month}-01`,
        shootsCompleted: k.completed,
        shootsCancelled: k.cancelled,
        deliverablesTotal: k.submitted,
        deliverablesApproved: k.approved,
        postedTotal: k.posted,
        avgTurnaroundHours:
          k.avgTurnaroundHours === null ? null : String(k.avgTurnaroundHours),
      })
      .onConflictDoUpdate({
        target: [kpiSnapshots.creatorId, kpiSnapshots.snapshotDate],
        set: {
          shootsCompleted: k.completed,
          shootsCancelled: k.cancelled,
          deliverablesTotal: k.submitted,
          deliverablesApproved: k.approved,
          postedTotal: k.posted,
          avgTurnaroundHours:
            k.avgTurnaroundHours === null ? null : String(k.avgTurnaroundHours),
        },
      });
  }

  return NextResponse.json({ snapshotted: kpis.length });
}
