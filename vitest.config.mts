import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig; without it any test that reaches a
    // module importing "@/…" fails to load as a whole suite.
    //
    // A regex on "@/" rather than a bare "@" key: the bare form left "@/db"
    // unresolved as a bare package specifier, so it only ever worked for tests
    // whose imports were types and therefore erased before runtime.
    alias: [{ find: /^@\//, replacement: `${src}/` }],
  },
});
