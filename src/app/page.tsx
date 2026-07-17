import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor } from "@/lib/roles";

// Staff entry point: route each role to its home. Agents use /book directly.
export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  redirect(homeFor(session.user.roles));
}
