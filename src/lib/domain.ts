// The company Google Workspace domain, and the check that decides whether an
// account may sign in at all.
//
// This lives outside src/lib/registry because it is no longer a registry
// concern: since agents provision themselves on first sign-in, the domain check
// is the only thing standing between a Google account and a session.

export const ALLOWED_DOMAIN = "springfield-re.com";

/**
 * Only Google Workspace accounts on the company domain may sign in.
 *
 * The domain is compared against everything after the final `@`, not matched
 * as a suffix of the whole address — otherwise `notspringfield-re.com` and
 * `springfield-re.com@evil.com` would both pass.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  return email.slice(at + 1).toLowerCase() === ALLOWED_DOMAIN;
}
