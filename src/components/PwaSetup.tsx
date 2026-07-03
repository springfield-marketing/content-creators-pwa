"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable (Add to Home
// Screen / desktop install) and cached pages work offline.
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (e.g. unsupported browser) never blocks the app.
      });
    }
  }, []);
  return null;
}
