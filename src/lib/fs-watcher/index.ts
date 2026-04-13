import path from "path";
import { EventEmitter } from "events";
import chokidar, { type FSWatcher } from "chokidar";

export type WatchKind = "rules" | "agents" | "hooks" | "settings";

export interface WatchEvent {
  kind: WatchKind;
  relativePath: string;
  op: "add" | "change" | "unlink";
}

interface WatcherRecord {
  watcher: FSWatcher;
  projectPath: string;
}

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
}

const registry: Map<string, WatcherRecord> =
  globalThis.__fsWatcherRegistry__ ??
  (globalThis.__fsWatcherRegistry__ = new Map());

const bus: EventEmitter =
  globalThis.__fsWatcherBus__ ??
  (globalThis.__fsWatcherBus__ = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(200);
    return e;
  })());

const debounceMap: Map<string, NodeJS.Timeout> =
  globalThis.__fsWatcherDebounce__ ??
  (globalThis.__fsWatcherDebounce__ = new Map());

// ── Path → kind classifier ──────────────────────────────────────────────
function classifyPath(projectPath: string, filePath: string): WatchKind | null {
  const rel = path.relative(projectPath, filePath);
  if (!rel || rel.startsWith("..")) return null;

  // Root-level memory files → show on Rules tab (pinned)
  if (rel === "CLAUDE.md" || rel === "CLAUDE.local.md") return "rules";

  const parts = rel.split(path.sep);
  if (parts[0] !== ".claude") return null;

  if (parts[1] === "CLAUDE.md") return "rules";
  if (parts[1] === "rules" && parts[2]?.endsWith(".md")) return "rules";
  if (parts[1] === "agents" && parts[2]?.endsWith(".md")) return "agents";
  if (parts[1] === "hooks" && parts[2]?.endsWith(".sh")) return "hooks";
  if (parts.length === 2 && parts[1]?.startsWith("settings") && parts[1].endsWith(".json")) {
    return "settings";
  }

  return null;
}

// ── Debounced emit per (projectId, kind) ────────────────────────────────
function emit(projectId: string, event: WatchEvent) {
  const key = `${projectId}:${event.kind}`;
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    debounceMap.delete(key);
    bus.emit(projectId, event);
  }, 200);
  debounceMap.set(key, t);
}

// ── Register / unregister ───────────────────────────────────────────────
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
    const kind = classifyPath(projectPath, filePath);
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

// ── Subscribe (used by SSE endpoint) ────────────────────────────────────
export function subscribeToProject(
  projectId: string,
  handler: (event: WatchEvent) => void,
): () => void {
  bus.on(projectId, handler);
  return () => {
    bus.off(projectId, handler);
  };
}

// ── Lazy init: register all DB-known projects once ──────────────────────
export async function ensureAllWatchersStarted(): Promise<void> {
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
