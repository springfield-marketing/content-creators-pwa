import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig; without it any test that reaches a
    // module importing "@/…" fails to load as a whole suite.
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
