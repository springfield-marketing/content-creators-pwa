// GET /api/cron/renew-watch-channels — daily (§B5.4): channels expire ~7
// days; renew any expiring within 48h. No-ops until APP_URL is configured.

import { NextResponse } from "next/server";
import { renewWatchChannels } from "@/lib/watch-channels";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "Unauthorized");
  }
  return NextResponse.json(await renewWatchChannels());
}
