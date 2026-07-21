import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app";
import type { WSProgressEvent } from "@/lib/types";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const { addProgress, setWsConnected } = useAppStore();

  useEffect(() => {
    let unmounted = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (!unmounted) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSProgressEvent;
          addProgress(data);
        } catch {}
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return wsRef;
}
