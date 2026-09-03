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
import { ContinuousSchedulerPanel } from "../components/ContinuousSchedulerPanel";
import { Clock, FileText, AlertCircle } from "lucide-react";
import { useState } from "react";

export const Dashboard: React.FC = () => {
  const [sensorTarget, setSensorTarget] = useState<"MS-711" | "MS-712" | "Merge">("Merge");
  const [exposureTime, setExposureTime] = useState(100);
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
      {/* 1. Fila Superior (Control + Scheduler) */}
      <div style={styles.topRow}>
        <ControlPanel
          onAnalyze={analyze}
          isPending={isPending}
          isSuccess={isSuccess}
          errorMessage={isError ? error?.message ?? "Error de medición" : null}
          sensorTarget={sensorTarget}
          onSensorTargetChange={setSensorTarget}
          exposureTime={exposureTime}
          onExposureTimeChange={setExposureTime}
        />
        <ContinuousSchedulerPanel />
      </div>


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
    gap: 16,
    padding: "20px 32px",
    flex: 1,
    minHeight: 0,
    backgroundColor: "#111111",
  },
  topRow: {
    display: "flex",
    gap: 16,
    alignItems: "stretch",
  },
  graphWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
    minHeight: 0,
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
  },
  statusText: {
    color: "#cccccc",
    fontSize: 12,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusTextError: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusTimestamp: {
    color: "#888888",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

export default Dashboard;
