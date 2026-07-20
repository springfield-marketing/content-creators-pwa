// GET /api/me/activity?month=YYYY-MM — the signed-in creator's own history.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { auth } from "@/auth";
import { getActivity } from "@/lib/activity";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const month =
    new URL(req.url).searchParams.get("month") ?? dayjs().format("YYYY-MM");
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "Invalid month");

  const events = await getActivity({ month, subjectCreatorId: session.user.id });
  return NextResponse.json({ month, events });
}
