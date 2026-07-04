// GET /api/admin/kpis?month=YYYY-MM — all creators, live (§B6).

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { computeKpis } from "@/lib/kpis";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const month =
    new URL(req.url).searchParams.get("month") ?? dayjs().format("YYYY-MM");
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "Invalid month");
  return NextResponse.json({ month, kpis: await computeKpis(month) });
}
