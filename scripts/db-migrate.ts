import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { db, pool } from "../app/db/client.server.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Error: DATABASE_URL is not set.");
  process.exit(1);
}

let host = "";
try {
  const parsed = new URL(databaseUrl);
  host = parsed.hostname;
} catch {
  console.error("Error: Invalid DATABASE_URL format.");
  process.exit(1);
}

const isLocal = host === "127.0.0.1" || host === "localhost";
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm-host="));
const confirmedHost = confirmArg ? confirmArg.split("=")[1] : null;

if (!isLocal && confirmedHost !== host) {
  console.error(
    `Error: Refusing to run migrations on non-local host '${host}'.\n` + `To proceed, pass --confirm-host=${host}`,
  );
  process.exit(1);
}

async function run() {
  try {
    console.log(`Running migrations on ${host}...`);
    await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
