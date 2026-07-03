import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Staff entry point: route each role to its home. Agents use /book directly.
export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  redirect(
    role === "manager"
      ? "/admin/review"
      : role === "executive"
        ? "/reports"
        : "/creator"
  );
}
