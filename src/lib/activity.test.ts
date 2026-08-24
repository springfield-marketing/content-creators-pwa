import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { deliverables } from "@/db/schema";
import { auditRowFor } from "./activity";

describe("auditRowFor", () => {
  // Compiled through drizzle's own dialect, so this asserts what Postgres
  // would actually receive — the whole bug was in the SQL, not in the shape of
  // the drizzle object.
  const compiled = new PgDialect().sqlToQuery(
    auditRowFor("deliverable", deliverables.id)
  ).sql;

  it("casts the uuid side, because audit_log.entity_id is text", () => {
    // Without this the timeline never ran at all: `uuid = text` is 42883, so
    // /api/me/activity 500'd and the history screen rendered as empty.
    expect(compiled).toContain(`"deliverables"."id"::text`);
    expect(compiled).not.toContain("entity_id\"::uuid");
  });

  it("still pins the entity, so a booking id cannot match a deliverable", () => {
    expect(compiled).toContain(`"audit_log"."entity"`);
  });
});
