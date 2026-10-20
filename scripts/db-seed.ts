import { getDb, getPool } from "../app/db/client.server.js";
import { places } from "../app/db/schema.js";

const appEnv = process.env.APP_ENV;

if (appEnv !== "development" && appEnv !== "test") {
  console.error(`Error: Refusing to seed database because APP_ENV is '${appEnv}'. Expected 'development' or 'test'.`);
  process.exit(1);
}

const seedPlaces = [
  { id: "canteen", name: "Canteen", groupName: "Services" },
  { id: "library", name: "Library", groupName: "Services" },
  { id: "wifi", name: "Wi-Fi", groupName: "Services" },
  { id: "classroom", name: "Classroom", groupName: "Academics" },
  { id: "lab-1", name: "Lab 1", groupName: "Labs" },
  { id: "lab-2", name: "Lab 2", groupName: "Labs" },
  { id: "other", name: "Something else", groupName: "Other" },
];

async function run() {
  const pool = getPool();
  const db = getDb();

  try {
    console.log("Seeding places...");
    for (const place of seedPlaces) {
      await db
        .insert(places)
        .values({
          id: place.id,
          name: place.name,
          groupName: place.groupName,
          active: true,
        })
        .onConflictDoNothing();
    }
    console.log("Database seeded successfully.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
