// GET /api/cron/permit-expiry — daily report of permits about to lapse.
//
// Named permit-expiry rather than expiry: this app already has three crons and
// "expiry" alone would not say which of them it is.
//
// Note this fails CLOSED on a missing CRON_SECRET, unlike the older crons here
// which skip the check when it is unset. That was a deliberate fix in the
// registry and it came across with it.

import { NextResponse } from "next/server";
import { ALERT_DAYS, bucketByExpiry } from "@/lib/registry/expiry";
import { adminRecipients, sendEmail } from "@/lib/registry/notify";
import { todayInDubai } from "@/lib/registry/permit-status";
import { getProjects } from "@/lib/registry/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Fails closed. An unset CRON_SECRET previously left this endpoint open to
  // anyone, which is the wrong way round for a misconfiguration to fail —
  // and it stayed open silently because nothing complained.
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const today = todayInDubai();
  const report = bucketByExpiry(await getProjects(), today);

  if (report.total === 0)
    return NextResponse.json({ today, total: 0, sent: false });

  const lines: string[] = [];
  const section = (title: string, rows: typeof report.expired) => {
    if (!rows.length) return;
    lines.push(`${title} (${rows.length})`);
    for (const r of rows)
      lines.push(
        `  ${r.listingEnd}  ${r.dldProjectNumber ?? "—"}  ${r.name}  permit ${r.permitNumber ?? "—"}`,
      );
    lines.push("");
  };

  section("EXPIRED — remove from marketing now", report.expired);
  for (const d of ALERT_DAYS)
    section(`Expiring within ${d} days`, report.dueIn[d]);

  const result = await sendEmail({
    to: await adminRecipients(),
    subject: `Permits: ${report.total} need attention`,
    text: lines.join("\n"),
  });

  return NextResponse.json({
    today,
    total: report.total,
    expired: report.expired.length,
    dueIn: Object.fromEntries(ALERT_DAYS.map((d) => [d, report.dueIn[d].length])),
    ...result,
  });
}
