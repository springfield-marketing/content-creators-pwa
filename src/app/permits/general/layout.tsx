import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canReachRegistry } from "@/lib/registry/access";

// General permits are manager-only, but they live under /permits, whose route
// rule admits the registry roles too — so the prefix cannot be the gate. The
// page itself is a client component, so the check lives here.
//
// Nothing leaks without it: the data comes from /api/admin/permits, which the
// proxy still restricts to managers. This stops a marketing user or an agent
// landing on a screen that would only ever show them an error.
export default async function GeneralPermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  if (!roles.includes("manager")) {
    // Back to whichever half of the section they do belong in.
    redirect(canReachRegistry(roles) ? "/permits" : "/");
  }

  return <>{children}</>;
}
