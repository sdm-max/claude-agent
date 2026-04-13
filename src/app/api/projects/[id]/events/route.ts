import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  subscribeToProject,
  ensureAllWatchersStarted,
  registerWatcher,
  type WatchEvent,
} from "@/lib/fs-watcher";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  // Lazy-init all watchers once + ensure this project is registered
  await ensureAllWatchersStarted();
  registerWatcher(id, project.path);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: NodeJS.Timeout | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Initial hello
      safeEnqueue(`data: ${JSON.stringify({ kind: "ready" })}\n\n`);

      unsubscribe = subscribeToProject(id, (event: WatchEvent) => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      });

      keepalive = setInterval(() => {
        safeEnqueue(`: keepalive\n\n`);
      }, 30000);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
      if (keepalive) {
        clearInterval(keepalive);
        keepalive = null;
      }
    },
  });

  req.signal.addEventListener("abort", () => {
    closed = true;
    unsubscribe?.();
    unsubscribe = null;
    if (keepalive) {
      clearInterval(keepalive);
      keepalive = null;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
