// GET /api/admin/reviews?month=YYYY-MM — every review decision for the month.
// Part of the removable review-log feature. The screen filters + summarises.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { auth } from "@/auth";
import { getReviewLog } from "@/lib/review-log";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const month =
    new URL(req.url).searchParams.get("month") ?? dayjs().format("YYYY-MM");
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "Invalid month");

  const rows = await getReviewLog(month);
  return NextResponse.json({ month, rows });
}
