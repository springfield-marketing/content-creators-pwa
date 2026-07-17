// Where a signed-in user belongs. Shared by the staff entry point (/) and the
// proxy's bounce redirect — they have to agree, or a multi-role user lands in
// a different place depending on how they arrived.

import type { Role } from "@/auth";

// Most-specific job first: a creator who also leads a team still works out of
// /creator, and only visits the review screen when there's something to verify.
const HOME_BY_ROLE: [Role, string][] = [
  ["creator", "/creator"],
  ["manager", "/admin/review"],
  ["team_lead", "/admin/review"],
  ["executive", "/reports"],
];

export function homeFor(roles: Role[]): string {
  return HOME_BY_ROLE.find(([r]) => roles.includes(r))?.[1] ?? "/login";
}
