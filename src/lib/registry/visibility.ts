import { type Capability, can } from "./access";
import type { PermitStatus } from "./permit-status";
import type { Role } from "@/auth";

/**
 * The fields that have to be withheld from someone without detail access.
 *
 * Structural rather than tied to one row type: the permits list and the
 * projects list carry the same sensitive fields and must be redacted the same
 * way. A new list gets the same treatment by having these fields, not by
 * remembering to call something.
 */
type Redactable = {
  dldProjectNumber: string | null;
  permitNumber: string | null;
  listingEnd: string | null;
  qrUrl: string | null;
  fileCount: number;
  status: PermitStatus;
};

/**
 * Redacts rows for a set of roles before they leave the server.
 *
 * The whole list is sent to the browser so search can filter without a round
 * trip, which means anything the client receives is readable by the user
 * regardless of what the UI renders. Restrictions have to happen here.
 */
export function forRoles<T extends Redactable>(rows: T[], roles: Role[]): T[] {
  const allow = (c: Capability) => can(roles, c);
  const details = allow("viewPermitDetails");
  const qr = allow("viewQr");
  if (details && qr) return rows;

  return rows.map((r) => ({
    ...r,
    ...(details
      ? {}
      : {
          dldProjectNumber: null,
          permitNumber: null,
          listingEnd: null,
          // Present on the projects list, absent from the permits list; the
          // spread only overwrites it where it exists.
          ...("otherPermits" in r ? { otherPermits: 0 } : {}),
          // Agents get a usable/not-usable answer rather than a countdown:
          // "expiring" is still valid today, everything else is not.
          status: r.status === "active" || r.status === "expiring" ? "active" : "none",
        }),
    ...(qr ? {} : { qrUrl: null, fileCount: 0 }),
  }));
}
