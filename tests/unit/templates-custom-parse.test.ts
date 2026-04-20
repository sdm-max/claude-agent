import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as schema from "@/lib/db/schema";

// Hoisted holder so the vi.mock factory and beforeEach share the same db ref.
// vi.mock is hoisted to top-of-file by vitest — the factory must not close over
// any non-hoisted value. We use vi.hoisted() so mutations to holder.db are
// visible inside the mocked getDb() at import time.
const holder = vi.hoisted(() => ({
  db: null as ReturnType<typeof drizzle> | null,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

// Import AFTER vi.mock so getAllTemplates picks up the mocked getDb.
import { getAllTemplates } from "@/lib/templates";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  // Manual schema — mirrors src/lib/db/schema.ts customTemplates definition.
  // drizzle migrate intentionally not used (depends on filesystem `data/` dir).
  sqlite.exec(`
    CREATE TABLE custom_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT,
      description TEXT DEFAULT '',
      description_ko TEXT DEFAULT '',
      category TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'project',
      tags TEXT,
      settings TEXT NOT NULL,
      extra_files TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

let sqliteHandle: Database.Database | null = null;

beforeEach(() => {
  if (sqliteHandle) {
    try {
      sqliteHandle.close();
    } catch {
      /* ignore */
    }
  }
  const { sqlite, db } = createTestDb();
  sqliteHandle = sqlite;
  holder.db = db;
});

function insertCustom(params: {
  id: string;
  name: string;
  category: string;
  settings: string;
  tags?: string | null;
}) {
  if (!sqliteHandle) throw new Error("test db not initialized");
  const now = Date.now();
  const stmt = sqliteHandle.prepare(
    `INSERT INTO custom_templates
      (id, name, name_ko, description, description_ko, category, difficulty, scope, tags, settings, extra_files, created_at, updated_at)
      VALUES (@id, @name, @name_ko, @description, @description_ko, @category, @difficulty, @scope, @tags, @settings, @extra_files, @created_at, @updated_at)`,
  );
  stmt.run({
    id: params.id,
    name: params.name,
    name_ko: params.name,
    description: "",
    description_ko: "",
    category: params.category,
    difficulty: 1,
    scope: "project",
    tags: params.tags ?? null,
    settings: params.settings,
    extra_files: null,
    created_at: now,
    updated_at: now,
  });
}

describe("getAllTemplates — custom row resilience (T-F2.1)", () => {
  it("returns built-in templates when DB is empty (no custom rows)", () => {
    const result = getAllTemplates();
    expect(result.length).toBeGreaterThan(0);
    // Empty DB => no custom rows included
    expect(result.every((t) => t.isCustom === false)).toBe(true);
  });

  it("includes a valid custom row in the result", () => {
    insertCustom({
      id: "custom-valid",
      name: "Valid Custom",
      category: "security",
      settings: JSON.stringify({ x: 1 }),
      tags: JSON.stringify(["y"]),
    });
    const result = getAllTemplates();
    const custom = result.find((t) => t.id === "custom-valid");
    expect(custom).toBeDefined();
    expect(custom?.isCustom).toBe(true);
    expect(custom?.settings).toEqual({ x: 1 });
    expect(custom?.tags).toEqual(["y"]);
  });

  it("skips corrupt custom row (invalid settings JSON) without throwing", () => {
    insertCustom({
      id: "custom-broken",
      name: "Broken",
      category: "security",
      settings: "{broken",
    });
    expect(() => getAllTemplates()).not.toThrow();
    const result = getAllTemplates();
    expect(result.find((t) => t.id === "custom-broken")).toBeUndefined();
    // Built-ins still present.
    expect(result.length).toBeGreaterThan(0);
  });

  it("mixed rows: returns 2 valid customs, skips 1 corrupt, no throw (T-F2.1 P0 resilience)", () => {
    insertCustom({
      id: "custom-a",
      name: "Alpha",
      category: "security",
      settings: JSON.stringify({ a: 1 }),
    });
    insertCustom({
      id: "custom-broken",
      name: "Broken",
      category: "security",
      settings: "not-json-at-all{",
    });
    insertCustom({
      id: "custom-b",
      name: "Beta",
      category: "hooks",
      settings: JSON.stringify({ b: 2 }),
    });

    let result: ReturnType<typeof getAllTemplates> = [];
    expect(() => {
      result = getAllTemplates();
    }).not.toThrow();

    const customIds = result.filter((t) => t.isCustom).map((t) => t.id).sort();
    expect(customIds).toEqual(["custom-a", "custom-b"]);
    expect(result.find((t) => t.id === "custom-broken")).toBeUndefined();
  });
});
