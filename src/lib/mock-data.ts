// Mock data for the wireframe stage. All screens read from this module only,
// so replacing it with real database queries is a single seam in stage 2.
// Dates are generated relative to "today" so the demo always looks current.

import dayjs from "dayjs";

export type ShootType = "photo" | "video" | "both";

export type Creator = {
  id: string;
  slug: string;
  name: string;
  color: string; // avatar/placeholder color until real photos exist
  active: boolean;
  settings: {
    workingHours: string; // display-only summary for wireframe
    workDays: number[]; // 0=Sun … 6=Sat
    photoDuration: number; // minutes
    videoDuration: number;
    buffer: number;
    minNoticeHours: number;
    horizonWeeks: number;
    maxShootsPerDay: number;
  };
  timeOff: { from: string; to: string; reason: string }[];
};

export type Agent = {
  id: string;
  name: string;
  office: string;
  email: string;
  phone: string;
  status: "active" | "pending" | "inactive";
};

export type BookingStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pending_cancellation";

export type Booking = {
  id: string;
  creatorId: string;
  agentId: string;
  start: string; // ISO datetime
  end: string;
  shootType: ShootType;
  projectName: string; // what the shoot is about
  location: { kind: "onsite"; address: string } | { kind: "office" };
  notes?: string;
  status: BookingStatus;
  cancellationReason?: string;
};

export type DeliverableStatus = "pending" | "approved" | "revision_requested";

export type Deliverable = {
  id: string;
  creatorId: string;
  bookingId?: string;
  agentId?: string;
  type: "photo_shoot" | "video_shoot";
  url: string;
  platform: "instagram" | "tiktok" | "drive" | "dropbox" | "other";
  posted: boolean;
  workDate: string; // ISO date
  submittedAt: string;
  status: DeliverableStatus;
  reviewComment?: string;
};

export type Target = {
  creatorId: string;
  month: string; // YYYY-MM
  shoots: number;
  deliverables: number;
  posted: number;
};

const today = dayjs();
const iso = (d: dayjs.Dayjs) => d.toISOString();
const day = (offset: number, hour: number, minute = 0) =>
  iso(today.add(offset, "day").hour(hour).minute(minute).second(0).millisecond(0));

export const creators: Creator[] = [
  {
    id: "c1",
    slug: "mia-laurens",
    name: "Mia Laurens",
    color: "indigo",
    active: true,
    settings: {
      workingHours: "Mon–Fri 09:00–17:00 (lunch 12:30–13:00)",
      workDays: [1, 2, 3, 4, 5],
      photoDuration: 90,
      videoDuration: 150,
      buffer: 30,
      minNoticeHours: 24,
      horizonWeeks: 4,
      maxShootsPerDay: 3,
    },
    timeOff: [
      {
        from: today.add(12, "day").format("YYYY-MM-DD"),
        to: today.add(16, "day").format("YYYY-MM-DD"),
        reason: "Vacation",
      },
    ],
  },
  {
    id: "c2",
    slug: "daan-vermeer",
    name: "Daan Vermeer",
    color: "teal",
    active: true,
    settings: {
      workingHours: "Mon–Sat 08:30–16:30",
      workDays: [1, 2, 3, 4, 5, 6],
      photoDuration: 90,
      videoDuration: 180,
      buffer: 45,
      minNoticeHours: 48,
      horizonWeeks: 4,
      maxShootsPerDay: 2,
    },
    timeOff: [],
  },
  {
    id: "c3",
    slug: "sofia-ramos",
    name: "Sofia Ramos",
    color: "grape",
    active: true,
    settings: {
      workingHours: "Tue–Sat 10:00–18:00",
      workDays: [2, 3, 4, 5, 6],
      photoDuration: 75,
      videoDuration: 150,
      buffer: 30,
      minNoticeHours: 24,
      horizonWeeks: 6,
      maxShootsPerDay: 4,
    },
    timeOff: [],
  },
  {
    id: "c4",
    slug: "jonas-brandt",
    name: "Jonas Brandt",
    color: "orange",
    active: true,
    settings: {
      workingHours: "Mon–Fri 09:00–17:00",
      workDays: [1, 2, 3, 4, 5],
      photoDuration: 90,
      videoDuration: 150,
      buffer: 30,
      minNoticeHours: 24,
      horizonWeeks: 4,
      maxShootsPerDay: 3,
    },
    timeOff: [],
  },
  {
    id: "c5",
    slug: "elin-kask",
    name: "Elin Kask",
    color: "pink",
    active: false, // deactivated — must not appear on the booking page
    settings: {
      workingHours: "Mon–Fri 09:00–17:00",
      workDays: [1, 2, 3, 4, 5],
      photoDuration: 90,
      videoDuration: 150,
      buffer: 30,
      minNoticeHours: 24,
      horizonWeeks: 4,
      maxShootsPerDay: 3,
    },
    timeOff: [],
  },
];

// A slice of the real 200+ agent list — enough to demo type-ahead search.
export const agents: Agent[] = [
  { id: "a1", name: "Rachel Meyer", office: "Springfield Central", email: "rachel.meyer@springfield-re.com", phone: "+1 555 0101", status: "active" },
  { id: "a2", name: "Tom Okafor", office: "Springfield North", email: "tom.okafor@springfield-re.com", phone: "+1 555 0102", status: "active" },
  { id: "a3", name: "Isabelle Fontaine", office: "Riverside", email: "isabelle.fontaine@springfield-re.com", phone: "+1 555 0103", status: "active" },
  { id: "a4", name: "Marcus Webb", office: "Springfield Central", email: "marcus.webb@springfield-re.com", phone: "+1 555 0104", status: "active" },
  { id: "a5", name: "Priya Nair", office: "Hillside", email: "priya.nair@springfield-re.com", phone: "+1 555 0105", status: "active" },
  { id: "a6", name: "Sven Lindqvist", office: "Riverside", email: "sven.lindqvist@springfield-re.com", phone: "+1 555 0106", status: "active" },
  { id: "a7", name: "Carla Mendes", office: "Springfield North", email: "carla.mendes@springfield-re.com", phone: "+1 555 0107", status: "active" },
  { id: "a8", name: "David Chen", office: "Hillside", email: "david.chen@springfield-re.com", phone: "+1 555 0108", status: "active" },
  { id: "a9", name: "Anna Kowalska", office: "Springfield Central", email: "anna.kowalska@springfield-re.com", phone: "+1 555 0109", status: "active" },
  { id: "a10", name: "Omar Haddad", office: "Riverside", email: "omar.haddad@springfield-re.com", phone: "+1 555 0110", status: "active" },
  { id: "a11", name: "Lena Fischer", office: "Hillside", email: "lena.fischer@springfield-re.com", phone: "+1 555 0111", status: "pending" }, // self-registered, awaiting approval
  { id: "a12", name: "Guy Ancien", office: "Springfield North", email: "guy.ancien@springfield-re.com", phone: "+1 555 0112", status: "inactive" },
];

export const bookings: Booking[] = [
  // Today
  { id: "b1", creatorId: "c1", agentId: "a1", start: day(0, 9, 30), end: day(0, 11, 0), shootType: "photo", projectName: "14 Maple Drive listing", location: { kind: "onsite", address: "14 Maple Drive, Springfield" }, notes: "Family home, focus on the garden.", status: "confirmed" },
  { id: "b2", creatorId: "c1", agentId: "a4", start: day(0, 13, 0), end: day(0, 15, 30), shootType: "video", projectName: "Lakeshore Blvd penthouse listing", location: { kind: "onsite", address: "82 Lakeshore Blvd, Riverside" }, status: "confirmed" },
  { id: "b3", creatorId: "c2", agentId: "a2", start: day(0, 10, 0), end: day(0, 13, 0), shootType: "video", projectName: "Agent intro video — socials", location: { kind: "office" }, notes: "Agent intro reel for socials.", status: "confirmed" },
  // Upcoming
  { id: "b4", creatorId: "c1", agentId: "a3", start: day(1, 10, 0), end: day(1, 11, 30), shootType: "photo", projectName: "3 Vineyard Lane listing", location: { kind: "onsite", address: "3 Vineyard Lane, Hillside" }, status: "confirmed" },
  { id: "b5", creatorId: "c3", agentId: "a5", start: day(1, 11, 0), end: day(1, 12, 15), shootType: "photo", projectName: "27 Crown Street listing", location: { kind: "onsite", address: "27 Crown Street, Springfield" }, status: "confirmed" },
  { id: "b6", creatorId: "c2", agentId: "a7", start: day(2, 9, 0), end: day(2, 12, 0), shootType: "video", projectName: "Harbor View penthouse launch", location: { kind: "onsite", address: "156 Harbor View, Riverside" }, notes: "Penthouse — drone shots approved.", status: "confirmed" },
  { id: "b7", creatorId: "c4", agentId: "a8", start: day(2, 14, 0), end: day(2, 15, 30), shootType: "photo", projectName: "Agent headshots refresh", location: { kind: "office" }, status: "confirmed" },
  { id: "b8", creatorId: "c1", agentId: "a9", start: day(3, 9, 0), end: day(3, 11, 30), shootType: "both", projectName: "9 Birchwood Court listing", location: { kind: "onsite", address: "9 Birchwood Court, Springfield" }, status: "confirmed" },
  { id: "b9", creatorId: "c3", agentId: "a10", start: day(4, 10, 0), end: day(4, 11, 15), shootType: "photo", projectName: "44 Elm Park listing", location: { kind: "onsite", address: "44 Elm Park, Hillside" }, status: "pending_cancellation", cancellationReason: "Seller postponed the listing." },
  // Past — feed the KPI numbers and deliverable links
  { id: "b10", creatorId: "c1", agentId: "a2", start: day(-1, 9, 0), end: day(-1, 10, 30), shootType: "photo", projectName: "5 Foxglove Way listing", location: { kind: "onsite", address: "5 Foxglove Way, Springfield" }, status: "completed" },
  { id: "b11", creatorId: "c1", agentId: "a5", start: day(-2, 13, 0), end: day(-2, 15, 30), shootType: "video", projectName: "Marina Walk apartment tour", location: { kind: "onsite", address: "18 Marina Walk, Riverside" }, status: "completed" },
  { id: "b12", creatorId: "c2", agentId: "a6", start: day(-2, 9, 0), end: day(-2, 12, 0), shootType: "video", projectName: "Office tour video", location: { kind: "office" }, status: "completed" },
  { id: "b13", creatorId: "c3", agentId: "a1", start: day(-3, 10, 0), end: day(-3, 11, 15), shootType: "photo", projectName: "61 Meadow Rise listing", location: { kind: "onsite", address: "61 Meadow Rise, Hillside" }, status: "completed" },
  { id: "b14", creatorId: "c4", agentId: "a3", start: day(-3, 14, 0), end: day(-3, 15, 30), shootType: "photo", projectName: "12 Orchard Close listing", location: { kind: "onsite", address: "12 Orchard Close, Springfield" }, status: "no_show" },
  { id: "b15", creatorId: "c2", agentId: "a4", start: day(-4, 9, 0), end: day(-4, 12, 0), shootType: "video", projectName: "Skyline Ave campaign", location: { kind: "onsite", address: "230 Skyline Ave, Riverside" }, status: "cancelled", cancellationReason: "Agent double-booked." },
];

export const deliverables: Deliverable[] = [
  // Awaiting review
  { id: "d1", creatorId: "c1", bookingId: "b10", agentId: "a2", type: "photo_shoot", url: "https://drive.google.com/drive/folders/mock-foxglove", platform: "drive", posted: false, workDate: today.subtract(1, "day").format("YYYY-MM-DD"), submittedAt: day(-1, 16, 40), status: "pending" },
  { id: "d2", creatorId: "c1", bookingId: "b11", agentId: "a5", type: "video_shoot", url: "https://www.instagram.com/reel/mock-marina", platform: "instagram", posted: true, workDate: today.subtract(2, "day").format("YYYY-MM-DD"), submittedAt: day(-1, 9, 10), status: "pending" },
  { id: "d3", creatorId: "c2", bookingId: "b12", agentId: "a6", type: "video_shoot", url: "https://www.dropbox.com/s/mock-office-tour", platform: "dropbox", posted: false, workDate: today.subtract(2, "day").format("YYYY-MM-DD"), submittedAt: day(0, 8, 5), status: "pending" },
  { id: "d4", creatorId: "c3", bookingId: "b13", agentId: "a1", type: "photo_shoot", url: "https://drive.google.com/drive/folders/mock-meadow", platform: "drive", posted: false, workDate: today.subtract(3, "day").format("YYYY-MM-DD"), submittedAt: day(-2, 17, 20), status: "pending" },
  // Sent back for revision
  { id: "d5", creatorId: "c1", agentId: "a4", type: "video_shoot", url: "https://www.tiktok.com/@springfieldre/video/mock-1", platform: "tiktok", posted: false, workDate: today.subtract(4, "day").format("YYYY-MM-DD"), submittedAt: day(-3, 15, 0), status: "revision_requested", reviewComment: "Logo watermark is missing on the outro — please re-export and resubmit." },
  // Approved this month
  { id: "d6", creatorId: "c1", agentId: "a1", type: "photo_shoot", url: "https://drive.google.com/drive/folders/mock-a", platform: "drive", posted: false, workDate: today.subtract(6, "day").format("YYYY-MM-DD"), submittedAt: day(-6, 18, 0), status: "approved" },
  { id: "d7", creatorId: "c1", agentId: "a3", type: "video_shoot", url: "https://www.instagram.com/reel/mock-b", platform: "instagram", posted: true, workDate: today.subtract(7, "day").format("YYYY-MM-DD"), submittedAt: day(-7, 12, 0), status: "approved" },
  { id: "d8", creatorId: "c2", agentId: "a2", type: "video_shoot", url: "https://drive.google.com/drive/folders/mock-c", platform: "drive", posted: true, workDate: today.subtract(5, "day").format("YYYY-MM-DD"), submittedAt: day(-5, 16, 30), status: "approved" },
  { id: "d9", creatorId: "c3", agentId: "a7", type: "photo_shoot", url: "https://drive.google.com/drive/folders/mock-d", platform: "drive", posted: false, workDate: today.subtract(8, "day").format("YYYY-MM-DD"), submittedAt: day(-8, 17, 45), status: "approved" },
  { id: "d10", creatorId: "c4", agentId: "a8", type: "video_shoot", url: "https://www.instagram.com/reel/mock-e", platform: "instagram", posted: true, workDate: today.subtract(4, "day").format("YYYY-MM-DD"), submittedAt: day(-4, 11, 15), status: "approved" },
];

export const currentMonth = today.format("YYYY-MM");

export const targets: Target[] = [
  { creatorId: "c1", month: currentMonth, shoots: 20, deliverables: 24, posted: 12 },
  { creatorId: "c2", month: currentMonth, shoots: 14, deliverables: 16, posted: 10 },
  { creatorId: "c3", month: currentMonth, shoots: 22, deliverables: 22, posted: 8 },
  { creatorId: "c4", month: currentMonth, shoots: 18, deliverables: 20, posted: 10 },
];

// Pre-computed monthly KPI figures for the dashboard (stage 2 computes these
// from bookings + deliverables; hardcoded here so the wireframe shows realistic numbers).
export type KpiRow = {
  creatorId: string;
  month: string;
  shootsBooked: number;
  shootsCompleted: number;
  shootsCancelled: number;
  noShows: number;
  cancellationReasons: Record<string, number>;
  submitted: number;
  approved: number;
  revisionRate: number; // 0..1
  postedCount: number;
  postRate: number; // 0..1
  avgTurnaroundHours: number;
};

export const kpis: KpiRow[] = [
  { creatorId: "c1", month: currentMonth, shootsBooked: 16, shootsCompleted: 12, shootsCancelled: 2, noShows: 1, cancellationReasons: { "Agent cancelled": 1, "Weather": 1 }, submitted: 15, approved: 12, revisionRate: 0.13, postedCount: 8, postRate: 0.67, avgTurnaroundHours: 22 },
  { creatorId: "c2", month: currentMonth, shootsBooked: 10, shootsCompleted: 8, shootsCancelled: 1, noShows: 0, cancellationReasons: { "Agent double-booked": 1 }, submitted: 9, approved: 8, revisionRate: 0.11, postedCount: 6, postRate: 0.75, avgTurnaroundHours: 30 },
  { creatorId: "c3", month: currentMonth, shootsBooked: 18, shootsCompleted: 15, shootsCancelled: 2, noShows: 1, cancellationReasons: { "Seller postponed": 2 }, submitted: 14, approved: 13, revisionRate: 0.07, postedCount: 5, postRate: 0.38, avgTurnaroundHours: 18 },
  { creatorId: "c4", month: currentMonth, shootsBooked: 12, shootsCompleted: 10, shootsCancelled: 0, noShows: 1, cancellationReasons: {}, submitted: 11, approved: 10, revisionRate: 0.09, postedCount: 7, postRate: 0.7, avgTurnaroundHours: 26 },
];

// Convenience lookups used across screens
export const creatorById = (id: string) => creators.find((c) => c.id === id);
export const creatorBySlug = (slug: string) => creators.find((c) => c.slug === slug);
export const agentById = (id: string) => agents.find((a) => a.id === id);
export const bookingById = (id: string) => bookings.find((b) => b.id === id);

export const shootTypeLabel: Record<ShootType, string> = {
  photo: "Photo",
  video: "Video",
  both: "Photo + Video",
};
