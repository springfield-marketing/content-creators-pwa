// Which roles may reach which routes. Split out of src/proxy.ts so it can be
// tested without pulling Auth.js and a database pool into the test run — the
// gate is the only thing standing between ~150 self-provisioned agents and the
// admin screens, so it is worth pinning down.

import type { Role } from "@/auth";

// FIRST MATCH WINS — the review entries must stay above the general /admin
// ones, or a team_lead is bounced from the only screen they're here for.
export const ROUTE_ROLES: [string, Role[]][] = [
  ["/admin/review", ["manager", "team_lead"]],
  ["/api/admin/review-queue", ["manager", "team_lead"]],
  ["/api/admin/deliverables", ["manager", "team_lead"]],
  ["/admin", ["manager"]],
  ["/api/admin", ["manager"]],
  ["/creator", ["creator"]],
  ["/api/me", ["creator"]],
  ["/reports", ["executive", "manager"]],
  ["/api/reports", ["executive", "manager"]],
  // The permits section lists both kinds. Manager appears here despite
  // granting nothing in the registry itself, because managers own the general
  // company-content codes; the page redacts the offplan detail they have no
  // capability for.
  //
  // Creators read offplan permits from inside their own shell at
  // /creator/permits, so they need the API but not the standalone screen.
  ["/permits", ["permit_admin", "marketing", "agent", "manager"]],
  ["/api/permits", ["permit_admin", "marketing", "agent", "creator"]],
];

/**
 * Deny, not allow, when nothing matches.
 *
 * Everything the matcher covers is meant to be gated, so an unmatched path is a
 * missing rule. Since agents now provision themselves on sign-in, the cost of
 * guessing wrong went from "a manager sees a manager screen" to "150 agents see
 * it" — failing shut makes that a locked door someone reports, not a silent
 * hole.
 */
export function allowed(pathname: string, roles: Role[]): boolean {
  const rule = ROUTE_ROLES.find(([prefix]) => pathname.startsWith(prefix));
  if (!rule) return false;
  return rule[1].some((r) => roles.includes(r));
}
