// GET /api/leaderboard — current-month creator leaderboard for the office TV.
// PUBLIC (no auth), read-only, only display fields. Built on computeKpis so the
// numbers match the KPI dashboard exactly. Ranked by target attainment.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { arrayContains } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { computeKpis } from "@/lib/kpis";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Dubai";

export async function GET() {
  const now = dayjs().tz(TZ);
  const month = now.format("YYYY-MM");
  const kpis = await computeKpis(month);

  const photos = await db
    .select({ id: users.id, photo: users.photoUrl })
    .from(users)
    .where(arrayContains(users.roles, ["creator"]));
  const photoById = new Map(photos.map((p) => [p.id, p.photo]));

  const rows = kpis
    .map((k) => {
      // Photo and video aren't the same unit — a folder of images against a
      // clip count — so each is scored against its own target and the
      // percentages averaged. Keyed on craft, NOT on which targets happen to
      // be non-zero: a photographer still carrying a leftover deliverables
      // target from before the split would otherwise be dragged down by a
      // number nobody can see on their tab.
      const parts: number[] = [];
      if (k.craft !== "photo" && k.targetDeliverables > 0) {
        parts.push(k.approved / k.targetDeliverables);
      }
      if (k.craft !== "video" && k.targetImages > 0) {
        parts.push(k.imagesDelivered / k.targetImages);
      }
      return {
        name: k.creatorName,
        photoUrl: photoById.get(k.creatorId) ?? null,
        approved: k.approved,
        posted: k.posted,
        turnaroundHours: k.avgTurnaroundHours, // null if no shoot-tied deliverables
        target: k.targetDeliverables,
        images: k.imagesDelivered,
        targetImages: k.targetImages,
        attainment: parts.length
          ? parts.reduce((a, b) => a + b, 0) / parts.length
          : null,
      };
    })
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
