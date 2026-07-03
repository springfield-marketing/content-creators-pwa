// One-shot check that domain-wide delegation works: reads free/busy for the
// emails passed as arguments (defaults to the manager account).
// Run: npx tsx --env-file=.env src/lib/verify-delegation.ts [email ...]

import { freeBusy } from "./google-calendar";

async function main() {
  const emails = process.argv.slice(2);
  const targets = emails.length > 0 ? emails : ["zed@springfield-re.com"];
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  for (const email of targets) {
    try {
      const busy = await freeBusy(email, timeMin, timeMax);
      console.log(
        `✅ ${email}: delegation OK — ${busy.length} busy block(s) in the next 7 days`
      );
    } catch (e) {
      console.log(`❌ ${email}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main();
