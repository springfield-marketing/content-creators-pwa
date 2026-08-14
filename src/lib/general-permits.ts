// General permits decide who reviews a deliverable: work logged under one is
// hidden from team leads and left to managers.
//
// Permits are free text, so the same permit arrives spelled several ways
// ("0275066700", "PERMIT NUMBER 0275066700", "General QR code 2113748196").
// Matching therefore compares digits only, on both sides. A permit with no
// digits ("N/A", "No permit - Omar Essam") can never match — general_permits.code
// is CHECK-constrained to digits, so there is no blank code to match it.

import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { deliverables, generalPermits } from "@/db/schema";
import type { Role } from "@/auth";

export const digitsOnly = (permit: string) => permit.replace(/\D/g, "");

// Managers see everything; a team lead who isn't also a manager doesn't see
// general-permit work.
export function hidesGeneralPermits(roles: Role[]) {
  return roles.includes("team_lead") && !roles.includes("manager");
}

// SQL predicate: true when this deliverable is NOT under an active general
// permit. Deliverables with no permit stay visible — nothing to match on.
export function notGeneralPermit(): SQL {
  return sql`not exists (
    select 1 from general_permits gp
    where gp.is_active
      and gp.code = regexp_replace(coalesce(${deliverables.permitNumber}, ''), '[^0-9]', '', 'g')
  )`;
}

// Same rule for a single permit, for the decision endpoint — hiding a
// deliverable from the queue isn't enough on its own, since the POST can be
// called directly.
export async function isGeneralPermit(permit: string | null) {
  const code = digitsOnly(permit ?? "");
  if (!code) return false;
  const [hit] = await db
    .select({ id: generalPermits.id })
    .from(generalPermits)
    .where(and(eq(generalPermits.code, code), eq(generalPermits.isActive, true)))
    .limit(1);
  return !!hit;
}
