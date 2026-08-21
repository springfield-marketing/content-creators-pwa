/**
 * Applies pending migrations during a Vercel build.
 *
 * Wired up as the buildCommand in vercel.json, so a schema change ships with
 * the code that needs it instead of being a step someone has to remember.
 *
 * Skipped on preview builds: DATABASE_URL is shared across environments, so a
 * preview build would otherwise migrate the production database.
 *
 * Also the way to run a migration by hand against production:
 *
 *   DATABASE_URL="$(grep '^NEON_DATABASE_URL=' .env | cut -d= -f2-)" \
 *     npx tsx scripts/migrate-deploy.mts
 *
 * Use this rather than `drizzle-kit migrate` for anything on Neon: the CLI
 * exits 1 with no message when the connection fails, which is indistinguishable
 * from a broken migration. This reports the actual error.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Only when nothing was passed in — loadEnvFile overwrites, and .env holds the
// LOCAL database. Silently migrating localhost while believing it was
// production is the one mistake this file must not allow.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // On Vercel there is no .env; the platform supplies the environment.
  }
}

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`[migrate] skipped on ${env} build`);
  process.exit(0);
}

// Unpooled by preference. Neon's pooler returns connections without resetting
// search_path, which has already turned one healthy cutover into a fake
// failure; migrations have no business going through a transaction pooler.
// Vercel's Neon integration provides DATABASE_URL_UNPOOLED alongside the
// pooled one, and locally the -pooler host is rewritten by hand.
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!raw) {
  console.error("[migrate] neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set");
  process.exit(1);
}
const url = raw.replace("-pooler.", ".");

// Say which database, so a mistake is visible in the build log rather than
// discovered later.
console.log(`[migrate] target: ${url.replace(/:\/\/([^:]*):[^@]*@/, "://$1:***@")}`);

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrate] up to date");
} catch (e) {
  // Fail the build rather than deploy code against a schema that cannot
  // support it.
  console.error("[migrate] failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await pool.end();
}
