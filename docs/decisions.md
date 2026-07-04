# Product & implementation decisions log

Running record of decisions made during development, including answers to the
spec's §B13 open questions. Update this file when a decision is made or changed.

| # | Decision | Answer | Date |
|---|---|---|---|
| 1 | Calendar access (§B3) | **Option A** — Google Workspace service account with domain-wide delegation. Verified working 2026-07-04. | 2026-07-03 |
| 2 | UI framework | Mantine 9, themed; no Tailwind | 2026-07-03 |
| 3 | ORM / database | Drizzle + PostgreSQL (Homebrew 18 in dev; host TBD at deploy) | 2026-07-03 |
| 4 | Deliverable types | **Photo Shoot / Video Shoot** only (reel removed); creators pick type when logging | 2026-07-03 |
| 5 | Creator specialty | Not stored — all creators shoot both photo and video | 2026-07-03 |
| 6 | Branch separation | `users.branch` (Dubai / Abu Dhabi); badge on booking cards | 2026-07-03 |
| 7 | Booking project name | Required `bookings.project_name` field on the agent form | 2026-07-03 |
| 8 | Overtime tracking | **Post-hoc only** (`bookings.actual_ends_at`, offset computed): prompt at completion + auto-capture from calendar edits via webhook sync. No live-extension feature. | 2026-07-04 |
| 9 | Slot duration per shoot type (§B13 Q4) | Per-creator, per-shoot-type durations (already in `users.shoot_durations`); agent picks shoot type **before** seeing slots | 2026-07-04 |

## Open §B13 questions (awaiting product owner)

- Q2: KPIs count **submitted** or **approved** deliverables? (Spec + dev recommendation: approved.)
- Q3: Agent email verification before a booking confirms?
- Q5: Creator cancellation — direct, or manager approval required? (Dev recommendation: request → manager decides, reassign-first.)
- Q6: Migrate historical Google Sheets data? How far back?
- Q7: Executive view-only role in Phase 3, or CSV export enough initially?
- Q8: Confirm 24h agent-cancellation cutoff; late cancellations approved by creator or manager?
- Q9: Can creators enter their own time off (with approval), or manager-entry only?
