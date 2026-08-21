import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppChrome, type ChromeLink } from "@/components/AppChrome";
import { can } from "@/lib/registry/access";

// Permits inside the app's own shell — same header, same sidebar as every
// other signed-in area. It used to carry its own header and horizontal tab
// strip, inherited from the standalone registry, which made one product look
// like two.
export default async function PermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;

  const links: (ChromeLink & { show: boolean })[] = [
    { href: "/permits", label: "All permits", icon: "list", show: true },
    {
      href: "/permits/requests",
      label: can(roles, "viewAllRequests") ? "Requests" : "My requests",
      icon: "requests",
      show: can(roles, "viewOwnRequests"),
    },
    {
      href: "/permits/renew",
      label: "Renewals",
      icon: "renewals",
      show: can(roles, "batchRenew"),
    },
  ];

  return (
    <AppChrome
      title="Content Team · Permits"
      groups={[{ links: links.filter((l) => l.show) }]}
    >
      {children}
    </AppChrome>
  );
}
