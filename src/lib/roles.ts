// Where a signed-in user belongs. Shared by the staff entry point (/) and the
// proxy's bounce redirect — they have to agree, or a multi-role user lands in
// a different place depending on how they arrived.

import type { Role } from "@/auth";

// Most-specific job first: a creator who also leads a team still works out of
// /creator, and only visits the review screen when there's something to verify.
//
// The registry roles sit last on purpose. Someone holding one alongside a
// content-ops role does that job first — Eloisa is {manager,agent} and belongs
// on the review screen, reaching /permits from the nav. Only people whose sole
// role is a registry one land there, which is every booking agent.
const HOME_BY_ROLE: [Role, string][] = [
  ["creator", "/creator"],
  ["manager", "/admin/review"],
  ["team_lead", "/admin/review"],
  ["executive", "/reports"],
  ["permit_admin", "/permits"],
  ["marketing", "/permits"],
  ["agent", "/permits"],
];

export function homeFor(roles: Role[]): string {
  return HOME_BY_ROLE.find(([r]) => roles.includes(r))?.[1] ?? "/login";
}
