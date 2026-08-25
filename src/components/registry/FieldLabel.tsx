"use client";

import { Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

/**
 * A field label with its guidance behind an info icon rather than under it.
 *
 * Mantine's `description` puts a line of text beneath every label, which on a
 * form this long added more height than the inputs themselves. The wording is
 * worth keeping — several of these explain something that is not guessable, like
 * which authority an emirate implies — so it moves into a tooltip instead of
 * being deleted.
 *
 * The icon is wrapped in a focusable span rather than tooltipped directly: it
 * gives Tooltip a ref target it can rely on, and it puts the hint on the
 * keyboard path instead of hover alone. Touch is enabled for the same reason —
 * on a phone there is no hover, and this form is used on one.
 *
 * The click is swallowed because all of this renders inside a <label>, and a
 * click anywhere in a label activates its control. Without it, reaching for the
 * hint on the "Company content" checkbox would toggle the checkbox — the icon
 * would flip the very setting it exists to explain.
 */
export function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
      <Tooltip
        label={hint}
        multiline
        w={250}
        withArrow
        events={{ hover: true, focus: true, touch: true }}
      >
        <span
          tabIndex={0}
          role="note"
          aria-label={hint}
          onClick={(e) => e.preventDefault()}
          style={{ display: "inline-flex", cursor: "help", opacity: 0.55 }}
        >
          <IconInfoCircle size={14} />
        </span>
      </Tooltip>
    </span>
  );
}
