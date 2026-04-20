import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import {
  classifyProjectPath,
  classifyHomePath,
  PROJECT_WATCH_DEPTH,
  HOME_WATCH_DEPTH,
} from "@/lib/fs-watcher";

describe("classifyProjectPath", () => {
  const P = "/p";

  it("flat rule -> 'rules'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/rules/foo.md")),
    ).toBe("rules");
  });

  it("nested rule (1 level) -> 'rules'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/rules/sub/foo.md")),
    ).toBe("rules");
  });

  it("nested rule at cap boundary (PROJECT_WATCH_DEPTH + 1 parts) -> 'rules'", () => {
    // parts: [".claude", "rules", ...middle..., "foo.md"]
    // Total parts must equal PROJECT_WATCH_DEPTH + 1.
    // Middle segments count = PROJECT_WATCH_DEPTH + 1 - 3 = PROJECT_WATCH_DEPTH - 2.
    const middle = Array.from(
      { length: PROJECT_WATCH_DEPTH - 2 },
      (_, i) => `d${i}`,
    );
    const rel = path.join(".claude", "rules", ...middle, "foo.md");
    const parts = rel.split(path.sep);
    expect(parts.length).toBe(PROJECT_WATCH_DEPTH + 1);
    expect(classifyProjectPath(P, path.join(P, rel))).toBe("rules");
  });

  it("nested rule beyond cap (PROJECT_WATCH_DEPTH + 2 parts) -> null", () => {
    const middle = Array.from(
      { length: PROJECT_WATCH_DEPTH - 1 },
      (_, i) => `d${i}`,
    );
    const rel = path.join(".claude", "rules", ...middle, "foo.md");
    const parts = rel.split(path.sep);
    expect(parts.length).toBe(PROJECT_WATCH_DEPTH + 2);
    expect(classifyProjectPath(P, path.join(P, rel))).toBeNull();
  });

  it("flat agent -> 'agents'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/agents/foo.md")),
    ).toBe("agents");
  });

  it("nested agent -> null (agents are flat-only)", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/agents/sub/foo.md")),
    ).toBeNull();
  });

  it("flat hook .sh -> 'hooks'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/hooks/foo.sh")),
    ).toBe("hooks");
  });

  it("skill SKILL.md under skill subdir -> 'skills'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/skills/foo/SKILL.md")),
    ).toBe("skills");
  });

  it("settings.json -> 'settings'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/settings.json")),
    ).toBe("settings");
  });

  it("settings.local.json -> 'settings'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/settings.local.json")),
    ).toBe("settings");
  });

  it("CLAUDE.md at project root -> 'claudemd'", () => {
    expect(classifyProjectPath(P, path.join(P, "CLAUDE.md"))).toBe("claudemd");
  });

  it("CLAUDE.local.md at project root -> 'claudemd'", () => {
    expect(classifyProjectPath(P, path.join(P, "CLAUDE.local.md"))).toBe(
      "claudemd",
    );
  });

  it(".claude/CLAUDE.md -> 'claudemd'", () => {
    expect(
      classifyProjectPath(P, path.join(P, ".claude/CLAUDE.md")),
    ).toBe("claudemd");
  });

  it("unrelated source file -> null", () => {
    expect(classifyProjectPath(P, path.join(P, "src/foo.ts"))).toBeNull();
  });

  it("path equal to projectPath -> null", () => {
    expect(classifyProjectPath(P, P)).toBeNull();
  });

  it("path outside projectPath -> null", () => {
    expect(classifyProjectPath(P, "/other/.claude/rules/foo.md")).toBeNull();
  });
});

describe("classifyHomePath", () => {
  const HOME = os.homedir();
  const CLAUDE = path.join(HOME, ".claude");

  it("flat user-rule -> 'user-rules'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "rules/foo.md"))).toBe(
      "user-rules",
    );
  });

  it("nested user-rule (1 level) -> 'user-rules'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "rules/sub/foo.md"))).toBe(
      "user-rules",
    );
  });

  it("nested user-rule at cap boundary (HOME_WATCH_DEPTH + 1 parts) -> 'user-rules'", () => {
    // parts: ["rules", ...middle..., "foo.md"]; total = HOME_WATCH_DEPTH + 1
    const middle = Array.from(
      { length: HOME_WATCH_DEPTH - 1 },
      (_, i) => `d${i}`,
    );
    const rel = path.join("rules", ...middle, "foo.md");
    const parts = rel.split(path.sep);
    expect(parts.length).toBe(HOME_WATCH_DEPTH + 1);
    expect(classifyHomePath(path.join(CLAUDE, rel))).toBe("user-rules");
  });

  it("nested user-rule beyond cap (HOME_WATCH_DEPTH + 2 parts) -> null", () => {
    const middle = Array.from(
      { length: HOME_WATCH_DEPTH },
      (_, i) => `d${i}`,
    );
    const rel = path.join("rules", ...middle, "foo.md");
    const parts = rel.split(path.sep);
    expect(parts.length).toBe(HOME_WATCH_DEPTH + 2);
    expect(classifyHomePath(path.join(CLAUDE, rel))).toBeNull();
  });

  it("flat user-agent -> 'user-agents'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "agents/foo.md"))).toBe(
      "user-agents",
    );
  });

  it("nested user-agent -> null (agents are flat-only)", () => {
    expect(
      classifyHomePath(path.join(CLAUDE, "agents/sub/foo.md")),
    ).toBeNull();
  });

  it("user-hooks .sh -> 'user-hooks'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "hooks/foo.sh"))).toBe(
      "user-hooks",
    );
  });

  it("user settings.json -> 'user-settings'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "settings.json"))).toBe(
      "user-settings",
    );
  });

  it("managed-settings.json -> 'user-settings'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "managed-settings.json"))).toBe(
      "user-settings",
    );
  });

  it("user CLAUDE.md -> 'user-claudemd'", () => {
    expect(classifyHomePath(path.join(CLAUDE, "CLAUDE.md"))).toBe(
      "user-claudemd",
    );
  });

  it("path equal to ~/.claude -> null", () => {
    expect(classifyHomePath(CLAUDE)).toBeNull();
  });

  it("path outside ~/.claude -> null", () => {
    expect(classifyHomePath(path.join(HOME, "other/file.md"))).toBeNull();
  });
});
