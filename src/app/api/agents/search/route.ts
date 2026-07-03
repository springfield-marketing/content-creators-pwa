// GET /api/agents/search?q= — type-ahead over the agent list.
// Combines substring match with trigram word similarity (typo-tolerant),
// both served by the agents_name_trgm gin index. Rate-limited, min 2 chars.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jsonError, rateLimit } from "@/lib/api";

export async function GET(req: Request) {
  const limited = rateLimit(req, "agent-search", 60);
  if (limited) return limited;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return jsonError(400, "Query must be at least 2 characters");
  if (q.length > 100) return jsonError(400, "Query too long");

  const result = await db.execute(sql`
    SELECT id, full_name AS "name", email, phone, office
    FROM agents
    WHERE is_active AND is_approved
      AND (full_name ILIKE '%' || ${q} || '%' OR ${q} <% full_name)
    ORDER BY word_similarity(${q}, full_name) DESC, full_name ASC
    LIMIT 8
  `);

  return NextResponse.json(result.rows);
}
