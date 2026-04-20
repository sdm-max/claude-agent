/**
 * @vitest-environment node
 *
 * Q-3 Integration — parse-error 409 regression lock
 *
 * Regression-locks T-F2.2 (workflow activate) + T-F2.3 (templates apply / batch-apply)
 * hard-stop behavior on corrupt settings.json. All three endpoints MUST:
 *   1. Return HTTP 409 with body.error === "settings_parse_failed".
 *   2. Leave the target settings file byte-for-byte unchanged (sha256 invariant).
 *
 * Dev-server-dependency skip policy per approved-Q-scope §Q2:
 *   - Condition-based skip via beforeAll probe (AbortSignal timeout 1500ms).
 *   - SKIP_INTEGRATION=1 env override.
 *   - No hardcoded xtest / test.skip.
 *
 * Environment: node (not jsdom — jsdom blocks localhost fetch due to CORS
 * simulation). Set via `@vitest-environment node` docblock pragma.
 *
 * Target: Test project /tmp/test-claude-project (registered per e2e-scenarios.sh).
 * Scope: "local" → .claude/settings.local.json (safe sandbox, not user settings).
 * Cleanup: afterAll restores settings file from backup unconditionally (try/finally).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const API = "http://localhost:3000";
const TEST_PROJ_PATH = "/tmp/test-claude-project";
const SETTINGS_PATH = path.join(TEST_PROJ_PATH, ".claude", "settings.local.json");
const TEMPLATE_ID_A = "security-basic";
const TEMPLATE_ID_B = "security-hardened";

let serverUp = false;
let projectRegistered = false;
let originalBackup: string | null = null; // contents of settings.local.json at start of suite
let originalExists = false;

function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readSha(): string {
  const buf = fs.readFileSync(SETTINGS_PATH);
  return sha256(buf);
}

function restoreSettings(): void {
  // Ensure parent dir exists.
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (originalExists && originalBackup !== null) {
    fs.writeFileSync(SETTINGS_PATH, originalBackup);
  } else {
    // Backup didn't exist — write minimal valid empty object.
    fs.writeFileSync(SETTINGS_PATH, "{}");
  }
}

function corruptSettings(): string {
  fs.writeFileSync(SETTINGS_PATH, "{,}");
  return readSha();
}

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION === "1") {
    console.warn("[SKIP_INTEGRATION=1] Q-3 integration tests skipped");
    return;
  }
  try {
    const r = await fetch(`${API}/api/projects`, {
      signal: AbortSignal.timeout(1500),
    });
    serverUp = r.ok;
    if (serverUp) {
      const projects = (await r.json()) as Array<{ id: string; path: string }>;
      projectRegistered = projects.some((p) => p.path === TEST_PROJ_PATH);
      if (!projectRegistered) {
        console.warn(
          `[SKIP] Test project not registered at ${TEST_PROJ_PATH} — Q-3 skipped`,
        );
      }
    }
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(
      `[SKIP] dev server not running on :3000 — Q-3 integration tests skipped`,
    );
    return;
  }
  if (!projectRegistered) return;

  // Capture backup.
  originalExists = fs.existsSync(SETTINGS_PATH);
  if (originalExists) {
    originalBackup = fs.readFileSync(SETTINGS_PATH, "utf-8");
  } else {
    // Create parent dir + minimal file so tests have a consistent baseline.
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, "{}");
    originalExists = true;
    originalBackup = "{}";
  }
});

afterEach(() => {
  // Always restore between tests — safety net for the next case.
  if (serverUp && projectRegistered) {
    try {
      restoreSettings();
    } catch (e) {
      console.error("[Q-3 afterEach] restore failed:", e);
    }
  }
});

afterAll(() => {
  if (serverUp && projectRegistered) {
    try {
      restoreSettings();
    } catch (e) {
      console.error("[Q-3 afterAll] restore failed:", e);
    }
  }
});

// Note: we cannot use `it.skipIf(!shouldRun())` because that predicate is
// evaluated at collection time (before beforeAll runs). Instead, each test
// calls `ctx.skip()` at the top when serverUp/projectRegistered are false.
// This keeps the skip condition dynamic and condition-based per §Q2.

describe("Q-3 parse-error 409 hard-stop", () => {
  it(
    "POST /api/templates/:id/apply returns 409 + no file mutation on corrupt settings",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      // Baseline: valid settings → corrupt it → verify endpoint refuses + sha256 unchanged.
      try {
        const shaCorrupt = corruptSettings();

        const r = await fetch(`${API}/api/templates/${TEMPLATE_ID_A}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "local",
            projectPath: TEST_PROJ_PATH,
            mode: "merge",
          }),
          signal: AbortSignal.timeout(5000),
        });

        expect(r.status).toBe(409);
        const body = (await r.json()) as { error?: string };
        expect(body.error).toBe("settings_parse_failed");

        // File must be byte-unchanged (no partial write).
        expect(readSha()).toBe(shaCorrupt);
      } finally {
        restoreSettings();
      }
    },
  );

  it(
    "POST /api/templates/batch-apply returns 409 + no file mutation on corrupt settings",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      try {
        const shaCorrupt = corruptSettings();

        const r = await fetch(`${API}/api/templates/batch-apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateIds: [TEMPLATE_ID_A, TEMPLATE_ID_B],
            scope: "local",
            projectPath: TEST_PROJ_PATH,
            mode: "merge",
          }),
          signal: AbortSignal.timeout(5000),
        });

        expect(r.status).toBe(409);
        const body = (await r.json()) as { error?: string };
        expect(body.error).toBe("settings_parse_failed");
        expect(readSha()).toBe(shaCorrupt);
      } finally {
        restoreSettings();
      }
    },
  );

  it(
    "POST /api/workflows/:id/activate returns 409 + no file mutation on corrupt settings",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      // Look up project id for local-scope workflow.
      const projectsResp = await fetch(`${API}/api/projects`, {
        signal: AbortSignal.timeout(5000),
      });
      const projects = (await projectsResp.json()) as Array<{
        id: string;
        path: string;
      }>;
      const proj = projects.find((p) => p.path === TEST_PROJ_PATH);
      expect(proj).toBeDefined();
      const projectId = proj!.id;

      // Create workflow.
      const createResp = await fetch(`${API}/api/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `q3-probe-${Date.now()}`,
          scope: "local",
          projectId,
          items: [{ templateId: TEMPLATE_ID_A, name: "probe-item" }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      expect(createResp.status).toBe(201);
      const { id: workflowId } = (await createResp.json()) as { id: string };
      expect(workflowId).toBeTruthy();

      try {
        const shaCorrupt = corruptSettings();

        const activateResp = await fetch(
          `${API}/api/workflows/${workflowId}/activate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000),
          },
        );

        expect(activateResp.status).toBe(409);
        const body = (await activateResp.json()) as { error?: string };
        expect(body.error).toBe("settings_parse_failed");
        expect(readSha()).toBe(shaCorrupt);
      } finally {
        restoreSettings();
        // Cleanup: delete probe workflow. Tolerate failure (logged, not fatal).
        try {
          await fetch(`${API}/api/workflows/${workflowId}`, {
            method: "DELETE",
            signal: AbortSignal.timeout(5000),
          });
        } catch (e) {
          console.warn("[Q-3] workflow cleanup failed:", e);
        }
      }
    },
  );
});
