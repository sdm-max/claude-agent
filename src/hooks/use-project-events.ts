"use client";

import { useEffect, useRef } from "react";

export type ProjectEventKind =
  | "rules"
  | "agents"
  | "hooks"
  | "settings"
  | "claudemd"
  | "ready";

export interface ProjectEvent {
  kind: ProjectEventKind;
  relativePath?: string;
  op?: "add" | "change" | "unlink";
}

export function useProjectEvents(
  projectId: string,
  onEvent: (event: ProjectEvent) => void,
): void {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`/api/projects/${projectId}/events`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as ProjectEvent;
        handlerRef.current(parsed);
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects when Chrome wakes the tab
    };
    return () => {
      es.close();
    };
  }, [projectId]);
}
