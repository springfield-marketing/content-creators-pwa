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

| 10 | KPI counting (§B13 Q2) | **Approved only** — deliverables count toward targets once approved; submitted shown separately | 2026-07-04 |
| 11 | Agent email verification (§B13 Q3) | **Self-registered agents only** — known agents book instantly; new registrants confirm via emailed link before the booking is finalized | 2026-07-04 |
| 12 | Creator cancellation (§B13 Q5) | **Direct** — takes effect immediately (event deleted, agent notified, slot freed), manager informed; attributed to the creator in KPI cancellation stats | 2026-07-04 |
| 13 | Agent cancellation cutoff (§B13 Q8) | **24h confirmed**; within 24h, manager **or** the affected creator can approve/decline (first to act) | 2026-07-04 |

## Open §B13 questions (awaiting product owner)

- Q6: Migrate historical Google Sheets data? How far back?
- Q7: Executive view-only role in Phase 3, or CSV export enough initially?
- Q9: Can creators enter their own time off (with approval), or manager-entry only?
