/**
 * @vitest-environment node
 *
 * Q-4 Integration — agent-header apply 2-pass + EACCES rollback regression lock
 *
 * Regression-locks:
 *   - T-F2.4b 2-pass dry-run: any transform/read failure in pass 1 → zero writes.
 *   - D-1 best-effort reverse-order rollback: write failure in pass 2 → rollback
 *     already-written files in reverse order; response includes `rolledBack` +
 *     `rollbackFailed` arrays; `applied` is cleared to empty when rollback path
 *     is taken.
 *
 * Dev-server-dependency skip policy per approved-Q-scope §Q2 (mirrors Q-3):
 *   - Condition-based skip via beforeAll probe (AbortSignal timeout 1500ms).
 *   - SKIP_INTEGRATION=1 env override.
 *   - In-body `ctx.skip()` — no hardcoded xtest / test.skip.
 *
 * Environment: node (not jsdom) — set via `@vitest-environment node` docblock.
 *
 * Target: Test project /tmp/test-claude-project (registered per e2e-scenarios.sh).
 * Fixture scope: `.claude/agents/*.md` + `.claude/_agent-header.md` under the
 * test project. All fixtures are created per-test and removed in afterEach /
 * afterAll under try/finally so a mid-run failure cannot leak chmod 0444 files.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const API = "http://localhost:3000";
const TEST_PROJ_PATH = "/tmp/test-claude-project";
const AGENTS_DIR = path.join(TEST_PROJ_PATH, ".claude", "agents");
const HEADER_PATH = path.join(TEST_PROJ_PATH, ".claude", "_agent-header.md");
const HEADER_BODY = "Q4-HEADER";

let serverUp = false;
let projectRegistered = false;
let projectId: string | null = null;

function md5(buf: Buffer | string): string {
  return crypto.createHash("md5").update(buf).digest("hex");
}

function md5File(p: string): string {
  return md5(fs.readFileSync(p));
}

function writeAgent(name: string, body?: string): void {
  const content =
    body ?? `---\nname: ${path.basename(name, ".md")}\n---\nBody ${name}\n`;
  fs.writeFileSync(path.join(AGENTS_DIR, name), content, "utf8");
}

function writeHeader(): void {
  fs.writeFileSync(HEADER_PATH, HEADER_BODY, "utf8");
}

function ensureAgentsDir(): void {
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }
}

/**
 * Unconditional cleanup. Safe to call multiple times. Restores permissions
 * on any fixture before unlinking so a 0444 chmod cannot wedge future runs.
 */
function cleanupFixtures(): void {
  // Restore perms + unlink all .md under AGENTS_DIR, then try to remove dir.
  if (fs.existsSync(AGENTS_DIR)) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(AGENTS_DIR);
    } catch {
      entries = [];
    }
    for (const name of entries) {
      const full = path.join(AGENTS_DIR, name);
      try {
        fs.chmodSync(full, 0o644);
      } catch {
        // ignore
      }
      try {
        fs.unlinkSync(full);
      } catch {
        // ignore
      }
    }
    try {
      fs.rmdirSync(AGENTS_DIR);
    } catch {
      // non-empty or missing — tolerate
    }
  }
  if (fs.existsSync(HEADER_PATH)) {
    try {
      fs.chmodSync(HEADER_PATH, 0o644);
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(HEADER_PATH);
    } catch {
      // ignore
    }
  }
}

async function postApply(
  mode: "inject" | "strip",
): Promise<{ status: number; body: ApplyResponse }> {
  const r = await fetch(
    `${API}/api/projects/${projectId}/agent-header/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(5000),
    },
  );
  const body = (await r.json()) as ApplyResponse;
  return { status: r.status, body };
}

type ApplyResponse = {
  updated?: number;
  total?: number;
  files?: string[];
  applied?: string[];
  skipped?: { path: string; reason: string }[];
  mode?: string;
  rolledBack?: string[];
  rollbackFailed?: { path: string; reason: string }[];
  error?: string;
};

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION === "1") {
    console.warn("[SKIP_INTEGRATION=1] Q-4 integration tests skipped");
    return;
  }
  try {
    const r = await fetch(`${API}/api/projects`, {
      signal: AbortSignal.timeout(1500),
    });
    serverUp = r.ok;
    if (serverUp) {
      const projects = (await r.json()) as Array<{ id: string; path: string }>;
      const proj = projects.find((p) => p.path === TEST_PROJ_PATH);
      projectRegistered = !!proj;
      projectId = proj?.id ?? null;
      if (!projectRegistered) {
        console.warn(
          `[SKIP] Test project not registered at ${TEST_PROJ_PATH} — Q-4 skipped`,
        );
      }
    }
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(
      `[SKIP] dev server not running on :3000 — Q-4 integration tests skipped`,
    );
    return;
  }
  // Preemptive cleanup in case a prior aborted run left residue.
  try {
    cleanupFixtures();
  } catch (e) {
    console.error("[Q-4 beforeAll] preemptive cleanup failed:", e);
  }
});

afterEach(() => {
  try {
    cleanupFixtures();
  } catch (e) {
    console.error("[Q-4 afterEach] cleanup failed:", e);
  }
});

afterAll(() => {
  try {
    cleanupFixtures();
  } catch (e) {
    console.error("[Q-4 afterAll] cleanup failed:", e);
  }
});

describe("Q-4 agent-header apply — 2-pass + rollback", () => {
  it(
    "inject happy path: 2 agents updated, no rollback, frontmatter preserved",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      try {
        ensureAgentsDir();
        writeAgent("a.md");
        writeAgent("b.md");
        writeHeader();

        const mdBeforeA = md5File(path.join(AGENTS_DIR, "a.md"));
        const mdBeforeB = md5File(path.join(AGENTS_DIR, "b.md"));

        const { status, body } = await postApply("inject");

        expect(status).toBe(200);
        expect(body.updated).toBe(2);
        const applied = body.applied ?? [];
        expect(applied.sort()).toEqual(["a.md", "b.md"]);
        expect(body.skipped ?? []).toEqual([]);
        expect(body.rolledBack ?? []).toEqual([]);
        expect(body.rollbackFailed ?? []).toEqual([]);

        // Content changed (header injected).
        const mdAfterA = md5File(path.join(AGENTS_DIR, "a.md"));
        const mdAfterB = md5File(path.join(AGENTS_DIR, "b.md"));
        expect(mdAfterA).not.toBe(mdBeforeA);
        expect(mdAfterB).not.toBe(mdBeforeB);

        // Frontmatter preserved: file must still start with `---`.
        const headA = fs
          .readFileSync(path.join(AGENTS_DIR, "a.md"), "utf8")
          .split("\n", 1)[0];
        const headB = fs
          .readFileSync(path.join(AGENTS_DIR, "b.md"), "utf8")
          .split("\n", 1)[0];
        expect(headA).toBe("---");
        expect(headB).toBe("---");

        // Header content present in both files.
        const contentA = fs.readFileSync(
          path.join(AGENTS_DIR, "a.md"),
          "utf8",
        );
        const contentB = fs.readFileSync(
          path.join(AGENTS_DIR, "b.md"),
          "utf8",
        );
        expect(contentA).toContain("COMMON-HEADER:START");
        expect(contentA).toContain(HEADER_BODY);
        expect(contentB).toContain("COMMON-HEADER:START");
        expect(contentB).toContain(HEADER_BODY);
      } finally {
        cleanupFixtures();
      }
    },
  );

  it(
    "EACCES rollback: 1 unwritable file triggers reverse-order restore of the other 2",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      // On systems where the test runs as root, chmod 0444 does not block
      // writes and rollback will not trigger. Skip with warning.
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        console.warn(
          "[SKIP] Q-4 EACCES case: running as root — chmod 0444 is not enforced",
        );
        ctx.skip();
        return;
      }
      try {
        ensureAgentsDir();
        writeAgent("a.md");
        writeAgent("b.md");
        writeAgent("c.md");
        writeHeader();

        const pathA = path.join(AGENTS_DIR, "a.md");
        const pathB = path.join(AGENTS_DIR, "b.md");
        const pathC = path.join(AGENTS_DIR, "c.md");

        const mdBeforeA = md5File(pathA);
        const mdBeforeB = md5File(pathB);
        const mdBeforeC = md5File(pathC);

        // Make c.md unwritable. Read must still succeed (so pass-1 plan
        // succeeds), only the pass-2 write fails → triggers rollback.
        fs.chmodSync(pathC, 0o444);

        const { status, body } = await postApply("inject");

        expect(status).toBe(200);

        // applied must be cleared once rollback is attempted.
        expect(body.applied ?? []).toEqual([]);
        expect(body.updated).toBe(0);

        // skipped must contain c.md with write_failed reason.
        const skipped = body.skipped ?? [];
        const skippedC = skipped.find((s) => s.path === "c.md");
        expect(skippedC).toBeDefined();
        expect(skippedC!.reason.startsWith("write_failed")).toBe(true);

        // rolledBack must include a.md and b.md (reverse order — either
        // ["b.md","a.md"] depending on which got written before c.md failed).
        const rolledBack = body.rolledBack ?? [];
        expect(rolledBack).toContain("a.md");
        expect(rolledBack).toContain("b.md");
        expect(body.rollbackFailed ?? []).toEqual([]);

        // All three files must match their pre-state (a/b rolled back, c
        // never written).
        expect(md5File(pathA)).toBe(mdBeforeA);
        expect(md5File(pathB)).toBe(mdBeforeB);
        expect(md5File(pathC)).toBe(mdBeforeC);
      } finally {
        // Restore perms before cleanup so unlink can succeed.
        try {
          fs.chmodSync(path.join(AGENTS_DIR, "c.md"), 0o644);
        } catch {
          // ignore — cleanupFixtures will chmod again
        }
        cleanupFixtures();
      }
    },
  );

  it(
    "strip mode round-trip: inject then strip removes header block",
    async (ctx) => {
      if (!serverUp || !projectRegistered) {
        ctx.skip();
        return;
      }
      try {
        ensureAgentsDir();
        writeAgent("a.md");
        writeHeader();

        // First inject the header.
        const injectResp = await postApply("inject");
        expect(injectResp.status).toBe(200);
        expect(injectResp.body.updated).toBe(1);

        const injected = fs.readFileSync(path.join(AGENTS_DIR, "a.md"), "utf8");
        expect(injected).toContain("COMMON-HEADER:START");

        // Now strip.
        const stripResp = await postApply("strip");
        expect(stripResp.status).toBe(200);
        expect(stripResp.body.updated).toBe(1);
        expect(stripResp.body.skipped ?? []).toEqual([]);
        expect(stripResp.body.rolledBack ?? []).toEqual([]);
        expect(stripResp.body.rollbackFailed ?? []).toEqual([]);

        const stripped = fs.readFileSync(path.join(AGENTS_DIR, "a.md"), "utf8");
        expect(stripped).not.toContain("COMMON-HEADER:START");
        expect(stripped).not.toContain("COMMON-HEADER:END");
        // Frontmatter preserved.
        expect(stripped.split("\n", 1)[0]).toBe("---");
      } finally {
        cleanupFixtures();
      }
    },
  );
});
