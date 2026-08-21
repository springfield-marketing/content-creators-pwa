import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppChrome, type ChromeGroup } from "@/components/AppChrome";
import { LapsingPermitsBanner } from "@/components/LapsingPermitsBanner";

// Manager shell: desktop-first sidebar, grouped by function, collapsible on
// mobile. A team_lead only reaches the review queue, so they see just that,
// and marketing reaches permits without the rest of the dashboard.
//
// A server component, so the sidebar is decided before the HTML is sent.
// Deriving it from useSession() meant every visitor was served a sidebar built
// from "nobody" and it only filled in after hydration — which for marketing
// rendered the review link they would be bounced from, and no permits link at
// all.
const NAV_GROUPS: ChromeGroup[] = [
  {
    title: "Review",
    links: [
      { href: "/admin/review", label: "Queue", icon: "queue" },
      { href: "/admin/review-log", label: "Review log", icon: "reviewLog" },
    ],
  },
  {
    title: "Permits",
    links: [
      { href: "/admin/permits", label: "All permits", icon: "permits" },
      { href: "/admin/permits/requests", label: "Requests", icon: "requests" },
      { href: "/admin/permits/renew", label: "Renewals", icon: "renewals" },
    ],
  },
  {
    title: "Schedule",
    links: [
      { href: "/admin/schedule", label: "Weekly plan", icon: "schedule" },
      { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
    ],
  },
  {
    title: "Insights",
    links: [
      { href: "/admin/activity", label: "Activity", icon: "history" },
      { href: "/admin/kpis", label: "KPIs", icon: "chart" },
      { href: "/admin/targets", label: "Targets", icon: "targets" },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/creators", label: "Creators", icon: "creators" },
      { href: "/admin/agents", label: "Agents", icon: "users" },
      { href: "/admin/team", label: "Team", icon: "team" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  const isManager = roles.includes("manager");
  // The review queue is the one admin screen a team lead reaches.
  const isTeamLead = roles.includes("team_lead");
  // Marketing and permit admins hold no content-ops role but maintain permits,
  // so the sidebar shows them that group and nothing else.
  const maintainsPermits = roles.some((r) =>
    ["permit_admin", "marketing"].includes(r),
  );

  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    // Mirrors route-access.ts. Offering a link someone would be bounced from
    // is worse than not offering it.
    links: g.links.filter(
      (l) =>
        isManager ||
        (isTeamLead && l.href === "/admin/review") ||
        (maintainsPermits && l.href.startsWith("/admin/permits")),
    ),
  })).filter((g) => g.links.length > 0);

  return (
    <AppChrome
      title="Content Team · Admin"
      groups={groups}
      // Managers act on lapsing permits; nobody else can.
      banner={isManager ? <LapsingPermitsBanner /> : null}
    >
      {children}
    </AppChrome>
  );
}
