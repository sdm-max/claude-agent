import fs from "fs";
import path from "path";
import os from "os";

export interface DetectedFile {
  type: "claude-md" | "settings" | "agents" | "rules" | "hooks";
  scope: "global" | "user" | "project" | "local";
  path: string;
  content: string;
}

const HOME = os.homedir();

export function detectClaudeFiles(projectPath: string): DetectedFile[] {
  const found: DetectedFile[] = [];

  const checks: { type: DetectedFile["type"]; scope: DetectedFile["scope"]; filePath: string }[] = [
    // Global scope
    { type: "claude-md", scope: "global", filePath: path.join(HOME, ".claude", "CLAUDE.md") },
    { type: "settings", scope: "global", filePath: path.join(HOME, ".claude", "settings.json") },
    // User scope
    { type: "claude-md", scope: "user", filePath: path.join(HOME, ".claude", "CLAUDE.local.md") },
    { type: "settings", scope: "user", filePath: path.join(HOME, ".claude", "settings.local.json") },
    // Project scope
    { type: "claude-md", scope: "project", filePath: path.join(projectPath, "CLAUDE.md") },
    { type: "claude-md", scope: "project", filePath: path.join(projectPath, ".claude", "CLAUDE.md") },
    { type: "settings", scope: "project", filePath: path.join(projectPath, ".claude", "settings.json") },
    // Local scope
    { type: "claude-md", scope: "local", filePath: path.join(projectPath, "CLAUDE.local.md") },
    { type: "settings", scope: "local", filePath: path.join(projectPath, ".claude", "settings.local.json") },
  ];

  // Directory-based detections for agents, rules, hooks
  const dirChecks: { type: "agents" | "rules" | "hooks"; scope: DetectedFile["scope"]; dirPath: string }[] = [
    { type: "agents", scope: "project", dirPath: path.join(projectPath, ".claude", "agents") },
    { type: "rules", scope: "project", dirPath: path.join(projectPath, ".claude", "rules") },
    { type: "hooks", scope: "project", dirPath: path.join(projectPath, ".claude", "hooks") },
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

  for (const dirCheck of dirChecks) {
    if (fs.existsSync(dirCheck.dirPath) && fs.statSync(dirCheck.dirPath).isDirectory()) {
      found.push({
        type: dirCheck.type,
        scope: dirCheck.scope,
        path: dirCheck.dirPath,
        content: "",
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

export function listDirectoryFiles(
  dirPath: string,
  extension?: string,
  options?: { recursive?: boolean; maxDepth?: number },
): { name: string; content: string }[] {
  if (!fs.existsSync(dirPath)) return [];
  const results: { name: string; content: string }[] = [];
  const maxDepth = options?.maxDepth ?? (options?.recursive ? 3 : 0);
  const walk = (currentPath: string, relativePath: string, depth: number) => {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const entryAbs = path.join(currentPath, entry.name);
        if (entry.isFile()) {
          if (!extension || entry.name.endsWith(extension)) {
            results.push({
              name: entryRel,
              content: readFileContent(entryAbs) ?? "",
            });
          }
        } else if (entry.isDirectory() && options?.recursive && depth < maxDepth) {
          walk(entryAbs, entryRel, depth + 1);
        }
      }
    } catch { /* ignore */ }
  };
  walk(dirPath, "", 0);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve the disk path for a given file type + scope + project path */
export function resolveFilePath(
  projectPath: string,
  type: "claude-md" | "settings",
  scope: "global" | "user" | "project" | "local"
): string {
  if (scope === "global") {
    // Global: ~/.claude/settings.json (shared across all users/projects)
    return type === "claude-md"
      ? path.join(HOME, ".claude", "CLAUDE.md")
      : path.join(HOME, ".claude", "settings.json");
  }
  if (scope === "user") {
    // User: ~/.claude/settings.local.json (personal overrides, not shared)
    return type === "claude-md"
      ? path.join(HOME, ".claude", "CLAUDE.local.md")
      : path.join(HOME, ".claude", "settings.local.json");
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
