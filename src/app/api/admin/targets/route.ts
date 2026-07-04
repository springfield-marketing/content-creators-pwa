// GET/PUT /api/admin/targets?month=YYYY-MM — monthly KPI targets (screen 10).

import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { kpiTargets, users } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

function monthParam(req: Request) {
  const m =
    new URL(req.url).searchParams.get("month") ?? dayjs().format("YYYY-MM");
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

export async function GET(req: Request) {
  const month = monthParam(req);
  if (!month) return jsonError(400, "Invalid month");

  const creators = await db
    .select({ id: users.id, name: users.fullName })
    .from(users)
    .where(eq(users.role, "creator"))
    .orderBy(asc(users.fullName));

  const targets = await db
    .select()
    .from(kpiTargets)
    .where(eq(kpiTargets.month, `${month}-01`));
  const byCreator = new Map(targets.map((t) => [t.creatorId, t]));

  return NextResponse.json({
    month,
    rows: creators.map((c) => {
      const t = byCreator.get(c.id);
      return {
        creatorId: c.id,
        creatorName: c.name,
        shoots: t?.targetShoots ?? 0,
        deliverables: t?.targetDeliverables ?? 0,
        posted: t?.targetPosted ?? 0,
      };
    }),
  });
}

const putSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  rows: z
    .array(
      z.object({
        creatorId: z.string().uuid(),
        shoots: z.number().int().min(0).max(1000),
        deliverables: z.number().int().min(0).max(1000),
        posted: z.number().int().min(0).max(1000),
      })
    )
    .min(1),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, putSchema);
  if ("error" in parsed) return parsed.error;
  const { month, rows } = parsed.data;
  const monthDate = `${month}-01`;

  for (const r of rows) {
    await db
      .insert(kpiTargets)
      .values({
        creatorId: r.creatorId,
        month: monthDate,
        targetShoots: r.shoots,
        targetDeliverables: r.deliverables,
        targetPosted: r.posted,
      })
      .onConflictDoUpdate({
        target: [kpiTargets.creatorId, kpiTargets.month],
        set: {
          targetShoots: r.shoots,
          targetDeliverables: r.deliverables,
          targetPosted: r.posted,
        },
      });
  }

  await logAudit({
    entity: "kpi_targets",
    entityId: session.user.id,
    action: "set",
    actorId: session.user.id,
    diff: { month, count: rows.length },
  });

  return NextResponse.json({ ok: true });
}
