// Dev seed. Destructive — dev only.
//
// SEED_DEMO=0 skips the fictional bookings/deliverables/snapshots — clean
// slate for real end-to-end testing (real creators/agents/targets only).
//
// Real data (never committed) is loaded from gitignored local files when present:
//   seed-data/creators.local.json  [{ email, name }]  → creator users
//   Agent list.csv                 name,phone,email   → agents
// Without them, the fictional wireframe creators/agents are used instead.
// Demo bookings/deliverables/targets are always fictional and are re-pointed
// at whichever creators exist — wiped before go-live.
//
// Mapping notes (mock → §B4):
//   shoot type  "both" → "photo_video"
//   booking     "pending_cancellation" → "confirmed" (request flow arrives with §B12)
//   deliverable "pending" → "submitted", "revision_requested" → "needs_revision"

import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import * as t from "./schema";
import type { WorkingHours } from "./schema";
import {
  agents as mockAgents,
  bookings as mockBookings,
  creators as mockCreators,
  currentMonth,
  deliverables as mockDeliverables,
  kpis as mockKpis,
  targets as mockTargets,
  type ShootType as MockShootType,
} from "../lib/mock-data";

const mapShootType = (s: MockShootType) =>
  s === "both" ? ("photo_video" as const) : s;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const ROOT = path.resolve(__dirname, "../..");

function loadRealCreators():
  | { email: string; name: string; photo?: string; branch?: string }[]
  | null {
  const f = path.join(ROOT, "seed-data/creators.local.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function loadRealAgents(): { name: string; phone: string; email: string }[] | null {
  const f = path.join(ROOT, "Agent list.csv");
  if (!fs.existsSync(f)) return null;
  return fs
    .readFileSync(f, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, phone, email] = line.split(",").map((s) => s.trim());
      return {
        name,
        phone: phone ? (phone.startsWith("+") ? phone : `+${phone}`) : "",
        email,
      };
    });
}

// Per-creator working hours, matching the wireframe's display strings.
const hoursBySlug: Record<string, WorkingHours> = {
  "mia-laurens": {
    mon: [["09:00", "12:30"], ["13:00", "17:00"]],
    tue: [["09:00", "12:30"], ["13:00", "17:00"]],
    wed: [["09:00", "12:30"], ["13:00", "17:00"]],
    thu: [["09:00", "12:30"], ["13:00", "17:00"]],
    fri: [["09:00", "12:30"], ["13:00", "17:00"]],
  },
  "daan-vermeer": {
    mon: [["08:30", "16:30"]], tue: [["08:30", "16:30"]], wed: [["08:30", "16:30"]],
    thu: [["08:30", "16:30"]], fri: [["08:30", "16:30"]], sat: [["08:30", "16:30"]],
  },
  "sofia-ramos": {
    tue: [["10:00", "18:00"]], wed: [["10:00", "18:00"]], thu: [["10:00", "18:00"]],
    fri: [["10:00", "18:00"]], sat: [["10:00", "18:00"]],
  },
  "jonas-brandt": {
    mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]],
    thu: [["09:00", "17:00"]], fri: [["09:00", "17:00"]],
  },
  "elin-kask": {
    mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]],
    thu: [["09:00", "17:00"]], fri: [["09:00", "17:00"]],
  },
};

const seedDemo = process.env.SEED_DEMO !== "0";

async function main() {
  console.log("Truncating…");
  await db.execute(sql`
    TRUNCATE audit_log, kpi_snapshots, kpi_targets, deliverables, bookings,
      creator_time_off, agents, users RESTART IDENTITY CASCADE
  `);

  console.log("Users…");
  const realCreators = loadRealCreators();
  let creatorId: Map<string, string>;
  let allCreatorIds: string[] = [];

  if (realCreators) {
    console.log(`  using ${realCreators.length} real creators (defaults for hours/durations)`);
    const rows = await db
      .insert(t.users)
      .values(
        realCreators.map((c, i) => ({
          email: c.email,
          fullName: c.name,
          role: "creator" as const,
          slug: slugify(c.name),
          sortOrder: i + 1,
          photoUrl: c.photo ?? null,
          branch: c.branch ?? "Dubai",
          googleCalendarId: c.email,
          // working hours, durations, buffers: §B4 defaults —
          // the manager tunes them in /admin/creators.
        }))
      )
      .returning({ id: t.users.id });
    allCreatorIds = rows.map((r) => r.id);
    // Demo bookings/deliverables reference fictional creators c1..c5 —
    // re-point them at real creators, cycling.
    creatorId = new Map(
      mockCreators.map((c, i) => [c.id, rows[i % rows.length].id])
    );
  } else {
    const rows = await db
      .insert(t.users)
      .values(
        mockCreators.map((c) => ({
          email: `${c.slug}@springfield-re.com`,
          fullName: c.name,
          role: "creator" as const,
          slug: c.slug,
          googleCalendarId: `${c.slug}@springfield-re.com`,
          workingHours: hoursBySlug[c.slug],
          shootDurations: {
            photo: c.settings.photoDuration,
            video: c.settings.videoDuration,
            photo_video: c.settings.videoDuration + 30,
          },
          bufferMinutes: c.settings.buffer,
          minNoticeHours: c.settings.minNoticeHours,
          maxHorizonDays: c.settings.horizonWeeks * 7,
          maxShootsPerDay: c.settings.maxShootsPerDay,
          isActive: c.active,
        }))
      )
      .returning({ id: t.users.id, slug: t.users.slug });
    creatorId = new Map(
      mockCreators.map((c) => [
        c.id,
        rows.find((r) => r.slug === c.slug)!.id,
      ])
    );
    allCreatorIds = rows.map((r) => r.id);
  }

  if (seedDemo) {
    // Dev convenience: open current + next week so slots exist immediately.
    // Production (SEED_DEMO=0) starts unplanned — the manager opens weeks
    // in /admin/schedule, which is the real workflow.
    console.log("Week plans…");
    const monday = dayjs().subtract((dayjs().day() + 6) % 7, "day");
    await db.insert(t.creatorWeekSchedules).values(
      allCreatorIds.flatMap((id) => [
        { creatorId: id, weekStart: monday.format("YYYY-MM-DD"), role: "all" as const },
        { creatorId: id, weekStart: monday.add(7, "day").format("YYYY-MM-DD"), role: "all" as const },
      ])
    );
  }

  const [manager] = await db
    .insert(t.users)
    .values([
      // Managers get real account emails so Google sign-in maps to these rows.
      { email: "zed@springfield-re.com", fullName: "Zed", role: "manager" as const },
      { email: "nihaal@springfield-re.com", fullName: "Nihaal", role: "manager" as const },
      // Placeholder executive account is dev-demo only.
      ...(seedDemo
        ? [{ email: "exec@springfield-re.com", fullName: "Exec Viewer", role: "executive" as const }]
        : []),
    ])
    .returning({ id: t.users.id });

  if (seedDemo) {
  console.log("Time off…");
  for (const c of mockCreators) {
    if (c.timeOff.length === 0) continue;
    await db.insert(t.creatorTimeOff).values(
      c.timeOff.map((o) => ({
        creatorId: creatorId.get(c.id)!,
        startsOn: o.from,
        endsOn: o.to,
        reason: o.reason,
        createdBy: manager.id,
      }))
    );
  }
  }

  console.log("Agents…");
  const realAgents = loadRealAgents();
  let agentId: Map<string, string>;

  if (realAgents) {
    console.log(`  importing ${realAgents.length} real agents from CSV`);
    const rows = await db
      .insert(t.agents)
      .values(
        realAgents.map((a) => ({
          fullName: a.name,
          email: a.email,
          phone: a.phone,
        }))
      )
      .returning({ id: t.agents.id });
    if (seedDemo) {
      // One fictional pending registration so the approval inbox is demoable.
      await db.insert(t.agents).values({
        fullName: "Lena Fischer (demo)",
        email: "lena.demo@example.invalid",
        isApproved: false,
      });
    }
    // Demo bookings/deliverables reference fictional agents — re-point, cycling.
    agentId = new Map(
      mockAgents.map((a, i) => [a.id, rows[i % rows.length].id])
    );
  } else {
    const rows = await db
      .insert(t.agents)
      .values(
        mockAgents.map((a) => ({
          fullName: a.name,
          email: a.email,
          phone: a.phone,
          office: a.office,
          isApproved: a.status !== "pending",
          isActive: a.status !== "inactive",
        }))
      )
      .returning({ id: t.agents.id, email: t.agents.email });
    agentId = new Map(
      mockAgents.map((a) => [
        a.id,
        rows.find((r) => r.email === a.email)!.id,
      ])
    );
  }

  if (!seedDemo) {
    console.log(
      "Seed complete (production-clean: real creators, agents, managers only — no plans, targets, bookings, or deliverables)."
    );
    process.exit(0);
  }

  console.log("Bookings…");
  const bookingRows = await db
    .insert(t.bookings)
    .values(
      mockBookings.map((b) => ({
        creatorId: creatorId.get(b.creatorId)!,
        agentId: agentId.get(b.agentId)!,
        source: "agent" as const,
        shootType: mapShootType(b.shootType),
        projectName: b.projectName,
        locationType:
          b.location.kind === "onsite" ? ("on_site" as const) : ("office" as const),
        propertyAddress:
          b.location.kind === "onsite" ? b.location.address : null,
        notes: b.notes ?? null,
        startsAt: new Date(b.start),
        endsAt: new Date(b.end),
        status:
          b.status === "pending_cancellation" ? ("confirmed" as const) : b.status,
        cancellationReason:
          b.status === "cancelled" ? (b.cancellationReason ?? null) : null,
        cancelledBy: b.status === "cancelled" ? "agent" : null,
        cancelledAt: b.status === "cancelled" ? new Date(b.start) : null,
      }))
    )
    .returning({ id: t.bookings.id });

  const bookingId = new Map(
    mockBookings.map((b, i) => [b.id, bookingRows[i].id])
  );

  console.log("Deliverables…");
  await db.insert(t.deliverables).values(
    mockDeliverables.map((d) => ({
      creatorId: creatorId.get(d.creatorId)!,
      bookingId: d.bookingId ? bookingId.get(d.bookingId)! : null,
      agentId: d.agentId ? agentId.get(d.agentId)! : null,
      type: d.type,
      platform: d.platform,
      url: d.url,
      isPosted: d.posted,
      postedAt: d.posted ? new Date(d.submittedAt) : null,
      workDate: d.workDate,
      reviewStatus:
        d.status === "pending"
          ? ("submitted" as const)
          : d.status === "revision_requested"
            ? ("needs_revision" as const)
            : ("approved" as const),
      reviewComment: d.reviewComment ?? null,
      reviewedBy: d.status === "pending" ? null : manager.id,
      reviewedAt: d.status === "pending" ? null : new Date(d.submittedAt),
      createdAt: new Date(d.submittedAt),
    }))
  );

  const monthStart = `${currentMonth}-01`;

  console.log("Targets…");
  await db.insert(t.kpiTargets).values(
    mockTargets.map((x) => ({
      creatorId: creatorId.get(x.creatorId)!,
      month: monthStart,
      targetShoots: x.shoots,
      targetDeliverables: x.deliverables,
      targetPosted: x.posted,
    }))
  );

  console.log("KPI snapshots…");
  await db.insert(t.kpiSnapshots).values(
    mockKpis.map((k) => ({
      creatorId: creatorId.get(k.creatorId)!,
      snapshotDate: dayjs().format("YYYY-MM-DD"),
      month: monthStart,
      shootsCompleted: k.shootsCompleted,
      shootsCancelled: k.shootsCancelled,
      deliverablesTotal: k.submitted,
      deliverablesApproved: k.approved,
      postedTotal: k.postedCount,
      avgTurnaroundHours: String(k.avgTurnaroundHours),
    }))
  );

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
