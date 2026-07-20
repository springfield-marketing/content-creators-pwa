// GET /api/admin/activity?month=YYYY-MM&creatorId=<uuid?> — history for one
// creator, or (creatorId omitted) the global feed across everyone.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { auth } from "@/auth";
import { getActivity } from "@/lib/activity";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? dayjs().format("YYYY-MM");
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "Invalid month");

  const creatorId = url.searchParams.get("creatorId") || undefined;
  if (creatorId && !/^[0-9a-f-]{36}$/i.test(creatorId)) {
    return jsonError(400, "Invalid creatorId");
  }

  const events = await getActivity({ month, subjectCreatorId: creatorId });
  return NextResponse.json({ month, creatorId: creatorId ?? null, events });
}
