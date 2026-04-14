import path from "path";
import os from "os";
import { EventEmitter } from "events";
import chokidar, { type FSWatcher } from "chokidar";

// ── Kinds ───────────────────────────────────────────────────────────────
// Project-scoped kinds (emitted on project bus via projectId).
export type ProjectWatchKind = "rules" | "agents" | "hooks" | "settings" | "claudemd";
// Home-scoped kinds (emitted on HOME_BUS_KEY bus, shared across all clients).
export type HomeWatchKind = "user-settings" | "user-claudemd";
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
function classifyProjectPath(projectPath: string, filePath: string): ProjectWatchKind | null {
  const rel = path.relative(projectPath, filePath);
  if (!rel || rel.startsWith("..")) return null;

  // Root-level memory files → show on Rules tab (pinned) AND CLAUDE.md tab
  if (rel === "CLAUDE.md" || rel === "CLAUDE.local.md") return "claudemd";

  const parts = rel.split(path.sep);
  if (parts[0] !== ".claude") return null;

  if (parts[1] === "CLAUDE.md") return "claudemd";
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
  const rel = path.relative(claudeDir, filePath);
  if (!rel || rel.startsWith("..")) return null;

  if (rel === "CLAUDE.md") return "user-claudemd";
  if (rel === "settings.json" || rel === "managed-settings.json") return "user-settings";
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
export function registerWatcher(projectId: string, projectPath: string) {
  const existing = registry.get(projectId);
  if (existing) {
    if (existing.projectPath === projectPath) return;
    void existing.watcher.close().catch(() => {});
    registry.delete(projectId);
  }

  const targets = [
    path.join(projectPath, "CLAUDE.md"),
    path.join(projectPath, "CLAUDE.local.md"),
    path.join(projectPath, ".claude"),
  ];

  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    persistent: true,
    ignored: (p: string) =>
      p.includes(`${path.sep}node_modules${path.sep}`) ||
      p.includes(`${path.sep}.git${path.sep}`),
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  const handle = (op: WatchEvent["op"]) => (filePath: string) => {
    const kind = classifyProjectPath(projectPath, filePath);
    if (!kind) return;
    emit(projectId, {
      kind,
      relativePath: path.relative(projectPath, filePath),
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
  const targets = [
    path.join(home, ".claude", "CLAUDE.md"),
    path.join(home, ".claude", "settings.json"),
    path.join(home, ".claude", "managed-settings.json"),
  ];

  try {
    const watcher = chokidar.watch(targets, {
      ignoreInitial: true,
      persistent: true,
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
