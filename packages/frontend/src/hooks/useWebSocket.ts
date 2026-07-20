import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app";
import type { WSProgressEvent } from "@/lib/types";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { addProgress, setWsConnected } = useAppStore();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(() => {
        // reconnect after 3s
      }, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSProgressEvent;
        addProgress(data);
      } catch {}
    };

    return () => ws.close();
  }, []);

  return wsRef;
}
