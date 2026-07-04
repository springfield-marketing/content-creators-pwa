// Email delivery. STUB until the Resend API key arrives — messages are
// logged, not sent. The Google Calendar invite (attendee + sendUpdates=all)
// is the agent's real notification channel in the meantime, so bookings
// still reach agents; only the manage-link email is deferred.
//
// To activate: npm i resend, set RESEND_API_KEY, replace deliver().

type Email = { to: string; subject: string; text: string };

async function deliver(email: Email) {
  console.log(
    `[email stub] to=${email.to} subject="${email.subject}"\n${email.text}`
  );
}

export async function sendBookingConfirmation(params: {
  to: string;
  agentName: string;
  creatorName: string;
  projectName: string;
  whenText: string;
  locationText: string;
  manageUrl: string;
}) {
  await deliver({
    to: params.to,
    subject: `Shoot confirmed: ${params.projectName} — ${params.whenText}`,
    text: [
      `Hi ${params.agentName},`,
      ``,
      `Your shoot with ${params.creatorName} is confirmed.`,
      ``,
      `Project: ${params.projectName}`,
      `When: ${params.whenText}`,
      `Where: ${params.locationText}`,
      ``,
      `A calendar invite is attached to this booking. Need to change or cancel?`,
      `Manage your booking here: ${params.manageUrl}`,
    ].join("\n"),
  });
}
