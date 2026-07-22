// GET /api/leaderboard — current-month creator leaderboard for the office TV.
// PUBLIC (no auth), read-only, only display fields. Built on computeKpis so the
// numbers match the KPI dashboard exactly. Ranked by target attainment.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { computeKpis } from "@/lib/kpis";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Dubai";

export async function GET() {
  const now = dayjs().tz(TZ);
  const month = now.format("YYYY-MM");
  const kpis = await computeKpis(month);

  const rows = kpis
    .map((k) => ({
      name: k.creatorName,
      approved: k.approved,
      posted: k.posted,
      turnaroundHours: k.avgTurnaroundHours, // null if no shoot-tied deliverables
      target: k.targetDeliverables,
      // Fraction of the monthly deliverables target that's been approved.
      attainment: k.targetDeliverables > 0 ? k.approved / k.targetDeliverables : null,
    }))
    .sort((a, b) => {
      const aa = a.attainment ?? -1;
      const bb = b.attainment ?? -1;
      if (bb !== aa) return bb - aa;
      if (b.approved !== a.approved) return b.approved - a.approved;
      return a.name.localeCompare(b.name);
    })
    .map((r, i) => ({ rank: i + 1, ...r }));

  return NextResponse.json(
    { month, updatedAt: now.toISOString(), rows },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
