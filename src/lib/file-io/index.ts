import fs from "fs";
import path from "path";
import os from "os";

export interface DetectedFile {
  type: "claude-md" | "settings";
  scope: "user" | "project" | "local";
  path: string;
  content: string;
}

const HOME = os.homedir();

export function detectClaudeFiles(projectPath: string): DetectedFile[] {
  const found: DetectedFile[] = [];

  const checks: { type: DetectedFile["type"]; scope: DetectedFile["scope"]; filePath: string }[] = [
    // User scope
    { type: "claude-md", scope: "user", filePath: path.join(HOME, ".claude", "CLAUDE.md") },
    { type: "settings", scope: "user", filePath: path.join(HOME, ".claude", "settings.json") },
    // Project scope
    { type: "claude-md", scope: "project", filePath: path.join(projectPath, "CLAUDE.md") },
    { type: "claude-md", scope: "project", filePath: path.join(projectPath, ".claude", "CLAUDE.md") },
    { type: "settings", scope: "project", filePath: path.join(projectPath, ".claude", "settings.json") },
    // Local scope
    { type: "claude-md", scope: "local", filePath: path.join(projectPath, "CLAUDE.local.md") },
    { type: "settings", scope: "local", filePath: path.join(projectPath, ".claude", "settings.local.json") },
  ];

  for (const check of checks) {
    const content = readFileContent(check.filePath);
    if (content !== null) {
      found.push({
        type: check.type,
        scope: check.scope,
        path: check.filePath,
        content,
      });
    }
  }

  return found;
}

export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function writeFileContent(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the disk path for a given file type + scope + project path */
export function resolveFilePath(
  projectPath: string,
  type: "claude-md" | "settings",
  scope: "user" | "project" | "local"
): string {
  if (scope === "user") {
    return type === "claude-md"
      ? path.join(HOME, ".claude", "CLAUDE.md")
      : path.join(HOME, ".claude", "settings.json");
  }
  if (scope === "local") {
    return type === "claude-md"
      ? path.join(projectPath, "CLAUDE.local.md")
      : path.join(projectPath, ".claude", "settings.local.json");
  }
  // project scope
  return type === "claude-md"
    ? path.join(projectPath, "CLAUDE.md")
    : path.join(projectPath, ".claude", "settings.json");
}
