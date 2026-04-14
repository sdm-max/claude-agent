"use client";

import { useEffect, useRef } from "react";

export type HomeEventKind = "user-settings" | "user-claudemd" | "ready";

export interface HomeEvent {
  kind: HomeEventKind;
  relativePath?: string;
  op?: "add" | "change" | "unlink";
}

export function useHomeEvents(onEvent: (event: HomeEvent) => void): void {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const es = new EventSource(`/api/home/events`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as HomeEvent;
        handlerRef.current(parsed);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // auto-reconnect
    };
    return () => es.close();
  }, []);
}
