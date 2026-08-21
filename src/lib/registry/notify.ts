/**
 * Resend over plain fetch — the SDK would be a dependency for one POST.
 *
 * Returns rather than throws when unconfigured, so the expiry cron still runs
 * and reports before email is set up.
 */
export async function sendEmail(opts: {
  to: string[];
  subject: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured" };
  if (!opts.to.length) return { sent: false, reason: "no recipients" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...opts }),
  });

  if (!res.ok) return { sent: false, reason: `resend ${res.status}` };
  return { sent: true };
}

/** Who the expiry cron reports to: the people who can actually renew. */
export async function adminRecipients(): Promise<string[]> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { and, arrayContains, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        arrayContains(users.roles, ["permit_admin"]),
        eq(users.isActive, true),
      ),
    );
  return rows.map((r) => r.email);
}
