/**
 * Dashboard.tsx
 *
 * Vista principal de la cabina científica del espectrorradiómetro.
 * Ensambla ControlPanel, MetricsSummary y SpectralGraph.
 */

import React from "react";
import { useAnalyzeSpectrum } from "../../application/hooks/useSpectrometer";
import { ControlPanel } from "../components/ControlPanel";
import { MetricsSummary } from "../components/MetricsSummary";
import { SpectralGraph } from "../components/SpectralGraph";
import { Clock, FileText, AlertCircle } from "lucide-react";

export const Dashboard: React.FC = () => {
  const {
    analyze,
    data,
    isPending,
    isError,
    error,
    isSuccess,
  } = useAnalyzeSpectrum();

  return (
    <main style={styles.main}>
      {/* 1. Panel de Control (Horizontal) */}
      <ControlPanel
        onAnalyze={analyze}
        isPending={isPending}
        isSuccess={isSuccess}
        errorMessage={isError ? error?.message ?? "Error de medición" : null}
      />

      {/* 2. Tarjetas de Métricas (Fila Horizontal) */}
      <MetricsSummary
        data={data ?? null}
        isLoading={isPending}
      />

      {/* 3. Gráfico Espectral (Centro Principal) */}
      <div style={styles.graphWrapper}>
        <SpectralGraph
          data={data?.merged_spectrum ?? null}
          isLoading={isPending}
          height={420}
        />
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            {isPending ? (
              <span style={styles.statusTextActive}>
                <Clock size={14} />
                Adquiriendo datos (Obturador abierto)...
              </span>
            ) : isSuccess && data ? (
              <span style={styles.statusText}>
                <FileText size={14} />
                Última medición: {data.merged_spectrum?.wavelengths.length ?? 0} puntos
              </span>
            ) : isError ? (
              <span style={styles.statusTextError}>
                <AlertCircle size={14} />
                Error en la última medición
              </span>
            ) : (
              <span style={styles.statusText}>
                Listo
              </span>
            )}
          </div>
          <span style={styles.statusTimestamp}>
            {new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    padding: "24px", // Utilizar todo el ancho disponible
    flex: 1,
    minHeight: 0,
  },
  graphWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    backgroundColor: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
  },
  statusText: {
    color: "#888888",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTextActive: {
    color: "#e0e0e0",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTextError: {
    color: "#f87171",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTimestamp: {
    color: "#888888",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

export default Dashboard;
