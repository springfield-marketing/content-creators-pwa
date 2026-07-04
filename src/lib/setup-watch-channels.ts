// Post-deployment one-shot: open/renew calendar watch channels (§B5.4).
// Run: npx tsx --env-file=.env src/lib/setup-watch-channels.ts
// The daily cron (/api/cron/renew-watch-channels) keeps them alive after.

import { renewWatchChannels } from "./watch-channels";

renewWatchChannels()
  .then((r) => {
    console.log(r.skipped ?? `opened ${r.opened}, healthy ${r.healthy}`);
    process.exit(r.skipped ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
