import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runMigrations(db: BetterSQLite3Database<any>) {
  migrate(db, { migrationsFolder: "./drizzle" });
}
