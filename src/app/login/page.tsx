import { LoginForm } from "./login-form";

// Moved mode (BOOKING_MOVED=1): booking lives in the Calls app and the creators' screens in the dashboard, so the sign-in
// page says so up front, with a button to each; signing in stays for the permits registry. The addresses go through this
// app's own /book and /creator, which moved mode forwards (@/lib/moved).
export default function Page() {
  return <LoginForm moved={process.env.BOOKING_MOVED === "1"} />;
}
