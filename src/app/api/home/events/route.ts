import { NextRequest } from "next/server";
import {
  subscribeToHome,
  ensureAllWatchersStarted,
  type WatchEvent,
} from "@/lib/fs-watcher";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureAllWatchersStarted();

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

      safeEnqueue(`data: ${JSON.stringify({ kind: "ready" })}\n\n`);

      unsubscribe = subscribeToHome((event: WatchEvent) => {
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
