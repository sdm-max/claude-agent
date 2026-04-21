import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import {
  resolveSafePath,
  undoExtraFiles,
  parseExtraFilesColumn,
  collectSharedResolvedPaths,
  type ExtraFile,
} from "@/lib/templates/undo-files";

// ---------------------------------------------------------------------------
// D-5.2 — regression tests for `src/lib/templates/undo-files.ts`
// SPEC: .claude/pipeline/outbox/approved-D-5-scope-20260420.md §D-5.2
// 6 cases: single, overlap, scope-isolation, path guard `..`, ENOENT, `~/` home.
// ---------------------------------------------------------------------------

let tmpBase: string;

// Each ~/ test uses a unique UUID-suffixed dir to avoid collisions.
const createdHomeDirs: string[] = [];

function makeExtraFile(relPath: string, content = "x"): ExtraFile {
  return { path: relPath, content, description: "test" };
}

function writeUnder(base: string, relPath: string, content: string): string {
  const abs = path.join(base, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return abs;
}

beforeEach(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "undo-test-"));
});

afterEach(() => {
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

afterAll(() => {
  // Safety net: remove any ~/.claude/skills/test-undo-* dirs that
  // individual tests may have leaked (e.g. on assertion failure).
  for (const dir of createdHomeDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

describe("undoExtraFiles — case 1: single apply, no shared paths", () => {
  it("unlinks all target files and reports them in removedFiles", () => {
    const a = writeUnder(tmpBase, ".claude/skills/a.md", "AAA");
    const b = writeUnder(tmpBase, ".claude/skills/sub/b.md", "BBB");

    const targets: ExtraFile[] = [
      makeExtraFile(".claude/skills/a.md", "AAA"),
      makeExtraFile(".claude/skills/sub/b.md", "BBB"),
    ];

    const result = undoExtraFiles(tmpBase, targets, new Set<string>());

    expect(result.removedFiles.sort()).toEqual(
      [".claude/skills/a.md", ".claude/skills/sub/b.md"].sort(),
    );
    expect(result.keptSharedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(fs.existsSync(a)).toBe(false);
    expect(fs.existsSync(b)).toBe(false);
  });
});

describe("undoExtraFiles — case 2: overlap preserved first, removed last", () => {
  it("first undo with other active row sharing path → file kept", () => {
    const sharedAbs = writeUnder(
      tmpBase,
      ".claude/skills/shared.md",
      "SHARED",
    );
    const targets: ExtraFile[] = [makeExtraFile(".claude/skills/shared.md")];

    // Other active row also references the same path → shared set.
    const sharedResolved = collectSharedResolvedPaths(tmpBase, [
      JSON.stringify([
        { path: ".claude/skills/shared.md", content: "x", description: "" },
      ]),
    ]);
    const result = undoExtraFiles(tmpBase, targets, sharedResolved);

    expect(result.keptSharedFiles).toEqual([".claude/skills/shared.md"]);
    expect(result.removedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(fs.existsSync(sharedAbs)).toBe(true);
  });

  it("second undo with no remaining shared → file removed", () => {
    const sharedAbs = writeUnder(
      tmpBase,
      ".claude/skills/shared.md",
      "SHARED",
    );
    const targets: ExtraFile[] = [makeExtraFile(".claude/skills/shared.md")];

    // No other active rows → empty set.
    const sharedResolved = collectSharedResolvedPaths(tmpBase, []);
    const result = undoExtraFiles(tmpBase, targets, sharedResolved);

    expect(result.removedFiles).toEqual([".claude/skills/shared.md"]);
    expect(result.keptSharedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(fs.existsSync(sharedAbs)).toBe(false);
  });
});

describe("undoExtraFiles — case 3: scope isolation via sharedResolved set", () => {
  it("path absent from sharedResolved is unlinked even if another scope has same relative path", () => {
    // Simulate two scopes by using two different basePaths. The library
    // resolves paths relative to ITS basePath only, so a 'same relative
    // path' in a different scope resolves to a different absolute path
    // and thus is NOT in sharedResolved for this scope.
    const otherScope = fs.mkdtempSync(
      path.join(os.tmpdir(), "undo-other-scope-"),
    );
    try {
      writeUnder(otherScope, ".claude/skills/iso.md", "OTHER");
      const targetAbs = writeUnder(
        tmpBase,
        ".claude/skills/iso.md",
        "THIS",
      );

      // Shared set built from OTHER scope's row — resolves under otherScope,
      // so the absolute path is different from targetAbs.
      const sharedResolved = collectSharedResolvedPaths(otherScope, [
        JSON.stringify([
          { path: ".claude/skills/iso.md", content: "x", description: "" },
        ]),
      ]);
      // Sanity: shared set does NOT contain our target abs.
      expect(sharedResolved.has(targetAbs)).toBe(false);

      const targets: ExtraFile[] = [makeExtraFile(".claude/skills/iso.md")];
      const result = undoExtraFiles(tmpBase, targets, sharedResolved);

      expect(result.removedFiles).toEqual([".claude/skills/iso.md"]);
      expect(result.keptSharedFiles).toEqual([]);
      expect(fs.existsSync(targetAbs)).toBe(false);
    } finally {
      fs.rmSync(otherScope, { recursive: true, force: true });
    }
  });
});

describe("undoExtraFiles — case 4: path guard `..` → silent skip", () => {
  it("does not attempt unlink; not reported as error", () => {
    const evilRel = "../etc/evil.md";
    // Sanity: guard returns null so nothing is resolvable.
    expect(resolveSafePath(tmpBase, evilRel)).toBeNull();

    const targets: ExtraFile[] = [makeExtraFile(evilRel)];
    const result = undoExtraFiles(tmpBase, targets, new Set<string>());

    // Silent skip: neither in removedFiles, nor keptSharedFiles, nor errors.
    expect(result.removedFiles).toEqual([]);
    expect(result.keptSharedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("absolute path also silently skipped", () => {
    const absRel = "/tmp/absolute-evil.md";
    expect(resolveSafePath(tmpBase, absRel)).toBeNull();

    const targets: ExtraFile[] = [makeExtraFile(absRel)];
    const result = undoExtraFiles(tmpBase, targets, new Set<string>());

    expect(result.removedFiles).toEqual([]);
    expect(result.keptSharedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe("undoExtraFiles — case 5: ENOENT (file manually deleted before undo)", () => {
  it("records ENOENT in errors[] but continues with other targets; no throw", () => {
    const gone = path.join(tmpBase, ".claude/skills/ghost.md");
    const present = writeUnder(
      tmpBase,
      ".claude/skills/present.md",
      "HERE",
    );
    // Do NOT create the ghost file.

    const targets: ExtraFile[] = [
      makeExtraFile(".claude/skills/ghost.md"),
      makeExtraFile(".claude/skills/present.md"),
    ];
    const result = undoExtraFiles(tmpBase, targets, new Set<string>());

    // Present file got removed.
    expect(result.removedFiles).toContain(".claude/skills/present.md");
    expect(fs.existsSync(present)).toBe(false);

    // Ghost file got logged in errors (ENOENT from fs.unlinkSync).
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].path).toBe(".claude/skills/ghost.md");
    expect(result.errors[0].error).toMatch(/ENOENT|no such file/i);
    expect(fs.existsSync(gone)).toBe(false);
  });
});

describe("undoExtraFiles — case 6: ~/-prefixed home path", () => {
  it("unlinks under os.homedir() when path starts with ~/", () => {
    const uid = randomUUID();
    const rel = `.claude/skills/test-undo-${uid}/SKILL.md`;
    const tildeRel = `~/${rel}`;
    const homeAbs = path.join(os.homedir(), rel);
    const homeDir = path.dirname(homeAbs);
    createdHomeDirs.push(
      path.join(os.homedir(), `.claude/skills/test-undo-${uid}`),
    );

    try {
      fs.mkdirSync(homeDir, { recursive: true });
      fs.writeFileSync(homeAbs, "HOME-CONTENT", "utf-8");
      expect(fs.existsSync(homeAbs)).toBe(true);

      // Sanity: resolveSafePath expands ~/ regardless of basePath.
      const resolved = resolveSafePath(tmpBase, tildeRel);
      expect(resolved).toBe(homeAbs);

      const targets: ExtraFile[] = [makeExtraFile(tildeRel)];
      const result = undoExtraFiles(tmpBase, targets, new Set<string>());

      expect(result.removedFiles).toEqual([tildeRel]);
      expect(result.keptSharedFiles).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(fs.existsSync(homeAbs)).toBe(false);
    } finally {
      // Always clean: remove the test-skill dir from real home.
      try {
        fs.rmSync(
          path.join(os.homedir(), `.claude/skills/test-undo-${uid}`),
          { recursive: true, force: true },
        );
      } catch {
        // best effort
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Sanity tests for helper exports used above (keeps branch coverage honest).
// ---------------------------------------------------------------------------

describe("parseExtraFilesColumn", () => {
  it("returns [] for null/undefined/empty/malformed/non-array", () => {
    expect(parseExtraFilesColumn(null)).toEqual([]);
    expect(parseExtraFilesColumn(undefined)).toEqual([]);
    expect(parseExtraFilesColumn("")).toEqual([]);
    expect(parseExtraFilesColumn("not json{")).toEqual([]);
    expect(parseExtraFilesColumn("{\"x\":1}")).toEqual([]);
  });
});
