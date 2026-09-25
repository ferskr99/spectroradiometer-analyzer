import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const WS_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WS_BASE_URL) ||
  (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.REACT_APP_WS_BASE_URL) ||
  "ws://localhost:8000/api/v1/sensors/ws";

export const useAppWebSocket = () => {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log("Conectado al servidor WebSocket de telemetría.");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === "NEW_MEASUREMENT") {
            console.log("Nueva medición detectada, invalidando caché de historial:", message.data);
            // Invalida la query para que React Query refetch el historial
            queryClient.invalidateQueries({ queryKey: ["history", "list"] });
            // Guardar el análisis completo en la caché para el Dashboard
            queryClient.setQueryData(["lastAnalysis"], message.data);
            // Notifica a los componentes que usan estado local (ej. DataLog.tsx)
            window.dispatchEvent(new Event("spectrometer:measurement_complete"));
          }
        } catch (e) {
          console.error("Error parseando mensaje WebSocket:", e);
        }
      };

      wsRef.current.onclose = () => {
        console.warn("Conexión WebSocket cerrada. Reintentando en 3s...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      wsRef.current.onerror = (err) => {
        console.error("Error en WebSocket:", err);
        wsRef.current?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Evitar reconexión al desmontar
        wsRef.current.close();
      }
    };
  }, [queryClient]);
};
