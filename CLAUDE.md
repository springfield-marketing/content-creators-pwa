## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Trakheesi registry (merged in from the standalone app)

Three audiences, three entry points, one set of components:

- `/admin/permits` — the dashboard tab. View, edit, renew, add, work the
  request queue. Manager, permit_admin and marketing. Renders in the admin
  shell, so the dashboard sidebar stays put.
- `/creator/permits` — a tab in the creator's mobile shell. Offplan, read-only.
- `/permits` — agents, reached from a link in the booking header. Offplan,
  read-only, redacted, plus their own requests.

Logic lives in `src/lib/registry/`. The shell is
`src/components/AppChrome.tsx`, shared by `/admin` and anything else that needs
a sidebar. Permits once carried its own header and tab strip inherited from the
standalone registry, which made one product look like two — don't reintroduce a
second chrome.

`/admin/permits` sits ABOVE `/admin` in `route-access.ts` so marketing reaches
permits without the rest of the dashboard. The admin layout is a server
component for the same reason its sidebar must be: deriving nav from
`useSession()` served everyone a sidebar built from "nobody" until hydration.

**One table, several kinds. Keep the meanings apart.**

Everything lives in `permits`, distinguished by `category`:

- `offplan` — per-project DLD permits deciding **whether a project may be
  marketed**. The Trakheesi registry. Needs a project and a listing window.
- `general` — company-content codes deciding **who reviews** a deliverable.
  No project, a `label`, a digits-only `permit_number`, and an `is_active`
  switch that routing keys on. Manager-only, and edited from a row action on
  the same list.

`category` is text with a CHECK, not a pgEnum, so the next kind (secondary, and
whatever follows) is one migration swapping the constraint rather than the enum
type-swap 0024 needed. Per-category shape rules are CHECK constraints —
`permits_offplan_shape`, `permits_general_shape` — because what a row requires
depends on its kind.

**Anything reading permits must pin the category.** 32 offplan permit numbers
also appear on deliverables, so an unpinned review-routing query would silently
hide that work from team leads. Watch for column shadowing too: a bare
`permit_number` inside a subquery over `deliverables` binds to the inner table,
which is exactly how the "uses" count on the general permits screen broke.

**Permit roles are a second axis, not a rank.** `agent`, `marketing` and
`permit_admin` are granted per person and are never implied by `manager` — the
two apps disagreed about the same people, so inferring would have handed three
content managers the ability to issue permits. See `src/lib/registry/access.ts`.

**Agents provision themselves.** Any `@springfield-re.com` Google account that
signs in without a `users` row is created as `{agent}`. `isAllowedEmail` is
therefore the only thing between a Google account and a session, and
`src/proxy.ts` fails **shut** on an unmatched path.

### Scope — do not design around these

- DLD / Trakheesi API. Permit issuance and payment stay manual; this app is the
  record, not the buyer.
- WhatsApp Cloud API. Notifications go out by email.
- Automated project-number to WordPress post mapping. A separate script owns it.

The goal is to reduce workload and keep a reliable record, **not** to remove
humans from the flow. An admin stays in the loop for payment and permit upload.

### Data notes

- ~400 projects; 389 permits share the same expiry, 15 Oct 2026. **Batch
  renewal is a hard requirement, not a nice-to-have** — `/permits/renew`.
- The 1,523 QR images live in Vercel Blob under store `v2wbfk4mwfbidj1o`
  (`project-tracker-blob`). That id is baked into every `permit_files.url`, so
  the store must outlive the old project and cannot be renamed. Two stores are
  connected to this project, so `src/lib/registry/storage.ts` pins `storeId`
  rather than letting the SDK pick — see docs/deploy.md.
- The original source sheet had 8 duplicate project numbers, four date formats,
  and developer-level permits with no project number ("Aldar General QR Code").
  Its CSV importer did **not** come across — the data is migrated and that path
  is dead. Only `parseListingDate` survives, in `src/lib/registry/dates.ts`,
  because the renewal template still uses those formats.

### Migrations here are hand-written

`drizzle-kit generate` has not worked in this repo since the 0011 snapshot
stopped being committed (`drizzle/meta/` stops at 0010, the journal has 25
entries). Every migration from 0011 on is hand-written with a comment saying
why. Follow that; do not try to regenerate the snapshot chain as a side quest.
