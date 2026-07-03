"use client";

import { Card, NavLink, Paper, createTheme } from "@mantine/core";

// Placeholder brand palette (deep indigo) — swap the 10 shades for the
// company palette when branding is provided.
const brand: [string, string, string, string, string, string, string, string, string, string] = [
  "#eef0ff",
  "#dee1f6",
  "#bac0e6",
  "#949dd6",
  "#7480c9",
  "#5f6dc1",
  "#5463be",
  "#4453a8",
  "#3c4997",
  "#313f87",
];

export const theme = createTheme({
  colors: { brand },
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: "md",
  cursorType: "pointer",
  fontFamily:
    "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
  headings: {
    fontFamily:
      "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "700",
  },
  components: {
    // Surfaces sit on an off-white canvas (see globals.css), so they are
    // white, softly bordered, and rounded by default.
    Card: Card.extend({
      defaultProps: { radius: "lg", withBorder: true, padding: "lg" },
    }),
    Paper: Paper.extend({
      defaultProps: { radius: "lg" },
    }),
    NavLink: NavLink.extend({
      styles: { root: { borderRadius: "var(--mantine-radius-md)" } },
    }),
  },
});
