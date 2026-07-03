// Shared route-handler helpers: JSON errors, Zod body parsing, rate limiting.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError(400, "Invalid JSON body") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Validation failed", issues: result.error.issues },
        { status: 422 }
      ),
    };
  }
  return { data: result.data };
}

// In-memory fixed-window rate limiter — fine for a single dev/small deploy
// process; swap for a shared store (Upstash/Postgres) when scaling out.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs = 60_000
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return jsonError(429, "Too many requests — slow down.");
  }
  return null;
}
