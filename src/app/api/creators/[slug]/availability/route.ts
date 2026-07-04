// GET /api/creators/[slug]/availability?type=photo|video|photo_video
// Real slots per §B12.3. Never cached (§B9): availability must be live.

import { NextResponse } from "next/server";
import {
  CalendarUnavailableError,
  getAvailability,
  type DbShootType,
} from "@/lib/availability";
import { jsonError, rateLimit } from "@/lib/api";

const TYPES: DbShootType[] = ["photo", "video", "photo_video"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = rateLimit(req, "availability", 60);
  if (limited) return limited;

  const { slug } = await params;
  const type = new URL(req.url).searchParams.get("type") ?? "photo";
  if (!TYPES.includes(type as DbShootType)) {
    return jsonError(400, "Invalid shoot type");
  }

  try {
    const availability = await getAvailability(slug, type as DbShootType);
    if (!availability) return jsonError(404, "Creator not found");
    return NextResponse.json(availability, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof CalendarUnavailableError) {
      return jsonError(
        503,
        "Live availability is temporarily unavailable — please try again in a few minutes."
      );
    }
    throw e;
  }
}
