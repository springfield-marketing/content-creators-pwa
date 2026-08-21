/**
 * Which sidebar link should read as active for the current path.
 *
 * The most specific match wins. A plain prefix test lit "All permits"
 * (/admin/permits) at the same time as "Requests" (/admin/permits/requests),
 * because the child path does start with the parent's — so two links looked
 * current and neither told you where you were.
 *
 * Matching still has to be prefix-based rather than exact: a screen with its
 * own sub-paths should keep its nav entry lit while you are inside it.
 *
 * The trailing slash matters. Without it "/admin/review" would match
 * "/admin/review-log", which is a different screen.
 */
export function activeNavHref(
  pathname: string,
  hrefs: string[],
): string | undefined {
  let best: string | undefined;
  for (const href of hrefs) {
    if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
    if (best === undefined || href.length > best.length) best = href;
  }
  return best;
}
