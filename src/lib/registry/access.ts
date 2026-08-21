// Who may do what with Trakheesi permits.
//
// Carried over from the standalone registry, with one change: roles here are a
// SET, matching this app, rather than the single value the registry used. A
// capability is granted if ANY role the person holds grants it.
//
// `manager` carries the dashboard permit capabilities, because the permits tab
// lives in the admin dashboard and exists for admins to view, edit, renew and
// add. Offering a manager the Renewals link and then bouncing them off it was
// the alternative, and that is what it used to do.
//
// This is a widening: managers who were only agents against the old registry
// (Eloisa, Nihaal) can now issue and renew permits. `permit_admin` and
// `marketing` remain separate roles because they grant permit rights WITHOUT
// any content-ops access — marketing reaches /admin/permits and nothing else.
//
// `requestPermit` is deliberately not a manager capability: they issue permits
// directly, so asking for one would be asking themselves.

import type { Role } from "@/auth";

/**
 * Every permission the app checks, in one table.
 *
 * Adding a capability means adding a row here and reading it with `can()` —
 * not scattering role comparisons through components.
 *
 * Roles absent from a row simply don't grant it, which is why the content-ops
 * roles appear only where they genuinely need to.
 */
const CAPABILITIES = {
  /** See the permit number, project number and expiry date. */
  viewPermitDetails: ["manager", "permit_admin", "marketing", "creator"],
  /** Reach the QR image at all. Enforced server-side, not just in the UI. */
  viewQr: ["manager", "permit_admin", "marketing", "creator"],
  requestPermit: ["permit_admin", "marketing", "agent"],
  issuePermit: ["manager", "permit_admin"],
  /** The admin queue: everyone's requests, with actions. */
  viewAllRequests: ["manager", "permit_admin"],
  /** Raise requests and see the ones you raised. */
  viewOwnRequests: ["manager", "permit_admin", "marketing", "agent"],
  batchRenew: ["manager", "permit_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(roles: Role[], capability: Capability): boolean {
  return CAPABILITIES[capability].some((r) => roles.includes(r));
}

/**
 * Whether the registry appears for this person at all.
 *
 * Creators read permits but never request them, so `viewPermitDetails` and
 * `viewOwnRequests` between them cover everyone who has any reason to be here.
 */
export function canReachRegistry(roles: Role[]): boolean {
  return can(roles, "viewPermitDetails") || can(roles, "viewOwnRequests");
}
