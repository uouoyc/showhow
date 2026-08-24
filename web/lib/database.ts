import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

const dataDir = resolve(
  /* turbopackIgnore: true */ process.env.DATA_DIR ?? "./data",
);
export const screenshotsDir = join(dataDir, "screenshots");
mkdirSync(screenshotsDir, { recursive: true });

const sqlite = new Database(join(dataDir, "showhow.db"));
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle({ client: sqlite, schema });
migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });

export function closeDatabase() {
  sqlite.close();
}
