import path from "path";
import os from "os";
import fs from "fs";
import { EventEmitter } from "events";
import chokidar, { type FSWatcher } from "chokidar";

// ── Kinds ───────────────────────────────────────────────────────────────
// Project-scoped kinds (emitted on project bus via projectId).
export type ProjectWatchKind = "rules" | "agents" | "hooks" | "settings" | "claudemd";
// Home-scoped kinds (emitted on HOME_BUS_KEY bus, shared across all clients).
export type HomeWatchKind = "user-settings" | "user-claudemd" | "user-hooks" | "user-rules" | "user-agents";
export type WatchKind = ProjectWatchKind | HomeWatchKind;

export interface WatchEvent {
  kind: WatchKind;
  relativePath: string;
  op: "add" | "change" | "unlink";
}

interface WatcherRecord {
  watcher: FSWatcher;
  projectPath: string;
}

// Synthetic bus key for home (~/.claude) watcher — not a real projectId.
export const HOME_BUS_KEY = "__home__";

// ── HMR-safe singletons via globalThis ──────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __fsWatcherRegistry__: Map<string, WatcherRecord> | undefined;
  // eslint-disable-next-line no-var
  var __fsWatcherBus__: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __fsWatcherDebounce__: Map<string, NodeJS.Timeout> | undefined;
  // eslint-disable-next-line no-var
  var __fsWatcherInitDone__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __fsWatcherHomeStarted__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __fsWatcherHome__: FSWatcher | undefined;
}

const registry: Map<string, WatcherRecord> =
  globalThis.__fsWatcherRegistry__ ??
  (globalThis.__fsWatcherRegistry__ = new Map());

const bus: EventEmitter =
  globalThis.__fsWatcherBus__ ??
  (globalThis.__fsWatcherBus__ = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(500);
    return e;
  })());

const debounceMap: Map<string, NodeJS.Timeout> =
  globalThis.__fsWatcherDebounce__ ??
  (globalThis.__fsWatcherDebounce__ = new Map());

// ── Path → kind classifier (project scope) ──────────────────────────────
// Case-insensitive relative calculation so we survive case-insensitive
// macOS filesystems where the DB-stored path and chokidar's canonical
// event path may differ only in case.
function relativeInsensitive(from: string, to: string): string | null {
  const fromNorm = from.toLowerCase().replace(/\/+$/, "");
  const toNorm = to.toLowerCase();
  if (toNorm === fromNorm) return "";
  if (toNorm.startsWith(fromNorm + path.sep)) {
    return to.slice(fromNorm.length + 1);
  }
  return null;
}

function classifyProjectPath(projectPath: string, filePath: string): ProjectWatchKind | null {
  const rel = relativeInsensitive(projectPath, filePath);
  if (rel === null || rel === "") return null;

  // Filename casing is also canonicalized by macOS FSEvents, so we match
  // case-insensitively throughout.
  const relLower = rel.toLowerCase();

  if (relLower === "claude.md" || relLower === "claude.local.md") return "claudemd";

  const parts = relLower.split(path.sep);
  if (parts[0] !== ".claude") return null;

  if (parts[1] === "claude.md") return "claudemd";
  if (parts[1] === "rules" && parts[2]?.endsWith(".md")) return "rules";
  if (parts[1] === "agents" && parts[2]?.endsWith(".md")) return "agents";
  if (parts[1] === "hooks" && parts[2]?.endsWith(".sh")) return "hooks";
  if (parts.length === 2 && parts[1]?.startsWith("settings") && parts[1].endsWith(".json")) {
    return "settings";
  }

  return null;
}

// ── Path → kind classifier (home ~/.claude scope) ───────────────────────
function classifyHomePath(filePath: string): HomeWatchKind | null {
  const home = os.homedir();
  const claudeDir = path.join(home, ".claude");
  const rel = relativeInsensitive(claudeDir, filePath);
  if (rel === null || rel === "") return null;

  const relLower = rel.toLowerCase();
  if (relLower === "claude.md") return "user-claudemd";
  if (relLower === "settings.json" || relLower === "managed-settings.json") return "user-settings";

  const parts = relLower.split(path.sep);
  if (parts[0] === "hooks" && parts[1]?.endsWith(".sh")) return "user-hooks";
  if (parts[0] === "rules" && parts[1]?.endsWith(".md")) return "user-rules";
  if (parts[0] === "agents" && parts[1]?.endsWith(".md")) return "user-agents";

  return null;
}

// ── Debounced emit ──────────────────────────────────────────────────────
function emit(busKey: string, event: WatchEvent) {
  const key = `${busKey}:${event.kind}`;
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    debounceMap.delete(key);
    bus.emit(busKey, event);
  }, 200);
  debounceMap.set(key, t);
}

// ── Register / unregister project watcher ──────────────────────────────
export function registerWatcher(projectId: string, projectPathInput: string) {
  // Canonicalize case so chokidar's canonical event paths line up with
  // path.relative() comparisons. The DB may hold a differently-cased
  // path on case-insensitive filesystems (macOS HFS+/APFS).
  let projectPath = projectPathInput;
  try {
    projectPath = fs.realpathSync(projectPathInput);
  } catch {
    // Path may not exist yet — fall back to the raw input.
  }

  const existing = registry.get(projectId);
  if (existing) {
    if (existing.projectPath === projectPath) return;
    void existing.watcher.close().catch(() => {});
    registry.delete(projectId);
  }

  // Watch the project root directory (not individual files) so chokidar
  // keeps firing events across unlink/recreate cycles that `>` truncates
  // produce. Depth 4 covers everything we care about (including rules subdirectories):
  //   <root>/CLAUDE.md                         (depth 1)
  //   <root>/.claude/CLAUDE.md                 (depth 2)
  //   <root>/.claude/settings.json             (depth 2)
  //   <root>/.claude/rules/foo.md              (depth 3)
  //   <root>/.claude/rules/frontend/foo.md     (depth 4)
  //   <root>/.claude/agents/bar.md             (depth 3)
  //   <root>/.claude/hooks/baz.sh              (depth 3)
  const watcher = chokidar.watch(projectPath, {
    ignoreInitial: true,
    persistent: true,
    depth: 4,
    ignored: (p: string) =>
      p.includes(`${path.sep}node_modules`) ||
      p.includes(`${path.sep}.git${path.sep}`) ||
      p.endsWith(`${path.sep}.git`) ||
      p.includes(`${path.sep}.next${path.sep}`) ||
      p.includes(`${path.sep}dist${path.sep}`) ||
      p.includes(`${path.sep}build${path.sep}`),
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  const handle = (op: WatchEvent["op"]) => (filePath: string) => {
    const kind = classifyProjectPath(projectPath, filePath);
    if (!kind) return;
    const rel = relativeInsensitive(projectPath, filePath) ?? filePath;
    emit(projectId, {
      kind,
      relativePath: rel,
      op,
    });
  };

  watcher.on("add", handle("add"));
  watcher.on("change", handle("change"));
  watcher.on("unlink", handle("unlink"));
  watcher.on("error", (err) => {
    console.warn(`[fs-watcher] ${projectId} error:`, err);
  });

  registry.set(projectId, { watcher, projectPath });
  console.log(`[fs-watcher] registered ${projectId} → ${projectPath}`);
}

export function unregisterWatcher(projectId: string) {
  const existing = registry.get(projectId);
  if (!existing) return;
  void existing.watcher.close().catch(() => {});
  registry.delete(projectId);
  console.log(`[fs-watcher] unregistered ${projectId}`);
}

// ── Home watcher (~/.claude) ────────────────────────────────────────────
function ensureHomeWatcherStarted() {
  if (globalThis.__fsWatcherHomeStarted__) return;
  globalThis.__fsWatcherHomeStarted__ = true;

  const home = os.homedir();
  const claudeDir = path.join(home, ".claude");

  try {
    const watcher = chokidar.watch(claudeDir, {
      ignoreInitial: true,
      persistent: true,
      depth: 3,
      ignored: (p: string) =>
        p.includes(`${path.sep}node_modules`) ||
        p.includes(`${path.sep}.git${path.sep}`),
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const handle = (op: WatchEvent["op"]) => (filePath: string) => {
      const kind = classifyHomePath(filePath);
      if (!kind) return;
      const claudeDir = path.join(home, ".claude");
      emit(HOME_BUS_KEY, {
        kind,
        relativePath: path.relative(claudeDir, filePath),
        op,
      });
    };

    watcher.on("add", handle("add"));
    watcher.on("change", handle("change"));
    watcher.on("unlink", handle("unlink"));
    watcher.on("error", (err) => {
      console.warn(`[fs-watcher] home error:`, err);
    });

    globalThis.__fsWatcherHome__ = watcher;
    console.log(`[fs-watcher] home watcher started`);
  } catch (e) {
    globalThis.__fsWatcherHomeStarted__ = false;
    console.warn("[fs-watcher] home watcher failed:", e);
  }
}

// ── Subscribe ───────────────────────────────────────────────────────────
export function subscribeToProject(
  projectId: string,
  handler: (event: WatchEvent) => void,
): () => void {
  bus.on(projectId, handler);
  return () => {
    bus.off(projectId, handler);
  };
}

export function subscribeToHome(
  handler: (event: WatchEvent) => void,
): () => void {
  bus.on(HOME_BUS_KEY, handler);
  return () => {
    bus.off(HOME_BUS_KEY, handler);
  };
}

// ── Lazy init: register all DB-known projects + home watcher ────────────
export async function ensureAllWatchersStarted(): Promise<void> {
  ensureHomeWatcherStarted();

  if (globalThis.__fsWatcherInitDone__) return;
  globalThis.__fsWatcherInitDone__ = true;
  try {
    const { getDb } = await import("@/lib/db");
    const { projects } = await import("@/lib/db/schema");
    const db = getDb();
    const all = db.select().from(projects).all();
    for (const p of all) {
      try {
        registerWatcher(p.id, p.path);
      } catch (e) {
        console.warn(`[fs-watcher] failed to register ${p.id}:`, e);
      }
    }
    console.log(`[fs-watcher] init done — ${all.length} projects`);
  } catch (e) {
    globalThis.__fsWatcherInitDone__ = false;
    console.warn("[fs-watcher] init failed:", e);
  }
}

export function _internalRegistrySize(): number {
  return registry.size;
}
