# Spec Part B — §B9–B13 (verbatim from product spec v1.1)

Companion to the implementation plan; §B12.3 is the authoritative slot
algorithm and §B12.1 the cancellation policy.

## B9. PWA implementation

- Manifest (app/manifest.ts): name, short_name, icons (192/512 + maskable), display: "standalone", theme/background colors, start_url: "/".
- Service worker via next-pwa or Serwist:
  - Precache app shell and static assets.
  - Runtime caching: network-first for API data (schedules, queues); never cache availability or booking POSTs.
  - Offline fallback page; cached read-only view of the creator's schedule.
- Install experience: custom "Install app" button using the beforeinstallprompt event on Android/desktop Chrome/Edge; on iOS Safari show a one-time instruction banner ("Share → Add to Home Screen") since iOS has no install prompt API.
- Desktop support: nothing extra required — a compliant manifest + service worker makes Chrome/Edge show the install icon in the address bar; the app then runs in its own window with a taskbar/dock icon. Same codebase, responsive layouts handle the wider viewport (dashboards and review queue get multi-column layouts ≥1024px).
- Push notifications (Phase 4): Web Push (VAPID). Full support on Android + desktop; on iOS requires 16.4+ AND home-screen installation. Therefore email remains the guaranteed channel for revision requests and booking confirmations; push is an enhancement.
- Updates: service worker skipWaiting + a subtle "New version available — refresh" toast so users are never stuck on stale builds.

## B10. Non-functional requirements

- Timezone: store UTC; render Asia/Dubai; explicit timeZone on all Calendar API calls.
- Secrets: service-account JSON / refresh tokens encrypted (pgcrypto or KMS); never in the repo.
- Idempotency: webhook handler and booking creation safe to retry (google_event_id uniqueness + upserts).
- Graceful degradation: Calendar API down → block new bookings with a friendly message.
- Mobile-first: every flow tested at 375px; desktop layouts for admin screens at ≥1024px.
- Simplicity guardrail: each role sees only its screens; no settings pages for creators; if a flow needs explaining, redesign it.

## B12. Edge cases & operational policies

### B12.1 Agent-requested cancellation & reschedule

Agents have no login, so all self-service goes through the secure manage link:

- On booking creation, generate a random token, store only its hash (bookings.manage_token_hash), and embed the raw token in the confirmation email/screen: /booking/[id]?token=.... Constant-time hash comparison on access; token invalidated once the booking is completed or cancelled.
- The manage page offers request cancellation (reason required) and request reschedule (re-runs the availability flow for the same creator).
- Two-tier cancellation policy:
  - starts_at − now() > 24h → instant: booking → cancelled with cancelled_by='agent', events.delete with sendUpdates=all, creator notified, slot freed.
  - ≤ 24h → creates a cancellation request; manager and creator are notified and either can approve (same effect) or decline (booking stands, agent notified). Late-cancellation requests left unanswered by shoot time resolve as no_show handling at the manager's discretion.
- KPI fairness: cancelled_by must be recorded on every cancellation. Agent- and manager-initiated cancellations never count against the creator's KPIs. Aggregate cancelled_by='agent' per agent — surfaces habitual late-cancellers in the dashboard.
- Invite declines: the webhook sync also reads attendee responseStatus. declined does NOT auto-cancel (declines can be accidental) — it flags the booking "agent declined invite" in the manager's bookings overview for follow-up.
- Reschedule = atomic cancel-and-rebook: validate the new slot server-side, events.patch the existing event with new times (sendUpdates=all), update Postgres. If the new slot fails validation, nothing changes.

### B12.2 Creator leave / temporary unavailability

- users.is_active is only for permanent removal (left the company). Temporary absence uses creator_time_off rows.
- Effects of an active time-off range: the creator is excluded from /book (hidden, not shown-but-full); the availability engine returns zero slots for dates in the range; manual admin bookings in the range require an explicit override confirmation.
- Conflict handling on entry (mandatory flow): when a time-off range is saved, the app immediately queries confirmed bookings overlapping it and presents each for resolution — reassign (pick another creator with a free matching slot: create new event on their calendar with the agent as attendee, delete the old one, notify agent) or cancel (cancelled_by='manager', reason auto-filled "creator unavailable", agent notified). The time-off record cannot be saved leaving unresolved conflicts.
- Same-day sickness is just a 1-day range; the conflict flow handles today's shoots identically.
- Defense in depth: multi-day "Out of office" events the creator sets in Google Calendar also block slots via FreeBusy even if nobody enters time off in the app — but the app flow is preferred because only it triggers conflict resolution and hides the creator from the booking page.

### B12.3 Slot generation (authoritative algorithm)

Inputs per creator (all manager-configured on screen #13): working_hours (arrays of ranges per weekday — supports lunch splits), shoot_durations per shoot type, buffer_minutes, min_notice_hours, max_horizon_days, max_shoots_per_day, plus creator_time_off.

For a requested creator + shoot type + date range:

1. Clamp the range to [now + min_notice_hours, today + max_horizon_days].
2. Drop dates covered by creator_time_off.
3. For each remaining date, expand working_hours ranges into candidate slots of shoot_durations[shoot_type] length (30-min step).
4. Fetch busy blocks: FreeBusy (creator's Google Calendar) ∪ confirmed Postgres bookings. Inflate each block by buffer_minutes on both sides; remove intersecting candidates.
5. Drop dates already at max_shoots_per_day confirmed bookings.
6. Return survivors. On submit, repeat steps 1–5 for the chosen slot server-side inside the booking transaction; the no_overlapping_confirmed exclusion constraint is the final backstop.

Config changes apply to future availability only; existing confirmed bookings are never altered by settings changes.

### B12.4 Phase mapping

Manage link + two-tier cancellation + cancelled_by → Phase 1 (part of the booking core). Time-off table + conflict resolution + creator settings screen → Phase 1 (settings, basic time off) and Phase 2 (reassignment flow). Agent late-cancellation analytics → Phase 3 (dashboard).

## B13. Open questions for the product owner (answer before Phase 1)

1. Google Workspace or personal Gmail accounts? (Determines §B3 Option A vs B.)
2. Do KPIs count submitted or approved deliverables?
3. Should agents verify their email before a booking is confirmed?
4. Fixed slot length for all creators, or per-creator / per-shoot-type durations?
5. Who can cancel a booking — creator directly, or manager approval required?
6. Migrate historical Google Sheets data, and how far back?
7. Does management want the view-only executive role (screen #14) in Phase 3, or is CSV export enough initially?
8. Confirm the agent cancellation cutoff (§B12.1) — is 24h the right threshold, and should late cancellations require creator or manager approval?
9. Can creators enter their own time off (with manager approval), or is it manager-entry only?
