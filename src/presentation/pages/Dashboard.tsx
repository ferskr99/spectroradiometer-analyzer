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
  const [sensorTarget, setSensorTarget] = useState<"MS-711" | "MS-713" | "Merge">("Merge");
  const [exposureTime, setExposureTime] = useState(100);
  const [autoExposure, setAutoExposure] = useState(false);
  const {
    analyze,
    data,
    isPending,
    isError,
    error,
    isSuccess,
  } = useAnalyzeSpectrum();

  return (
    <main style={styles.main} className="main-dashboard">
      {/* 1. Fila Superior (Control + Scheduler) */}
      <div style={styles.topRow} className="top-row">
        <ControlPanel
          onAnalyze={analyze}
          isPending={isPending}
          isSuccess={isSuccess}
          errorMessage={isError ? error?.message ?? "Error de medición" : null}
          sensorTarget={sensorTarget}
          onSensorTargetChange={setSensorTarget}
          exposureTime={exposureTime}
          onExposureTimeChange={setExposureTime}
          autoExposure={autoExposure}
          onAutoExposureChange={setAutoExposure}
          appliedExposureMs={isSuccess ? data?.applied_exposure_ms : null}
        />
        <ContinuousSchedulerPanel />
      </div>

      {/* 2. Fila Inferior (Métricas Izquierda, Gráfico Derecha) */}
      <div style={styles.bottomRow}>
        <div style={styles.metricsColumn}>
          <MetricsSummary
            data={data ?? null}
            isLoading={isPending}
          />
        </div>

        <div style={styles.graphColumn}>
          <div style={styles.graphWrapper}>
            <SpectralGraph
              data={data?.merged_spectrum ?? null}
              isLoading={isPending}
              height="100%"
            />
          </div>
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
                  {data.applied_exposure_ms ? ` (Exp: ${data.applied_exposure_ms}ms)` : ""}
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
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "16px 20px",
    height: "calc(100vh - 48px)",
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
    backgroundColor: "#111111",
  },
  topRow: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
  },
  bottomRow: {
    display: "flex",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  metricsColumn: {
    width: "480px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
  },
  graphColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  graphWrapper: {
    flex: 1,
    minHeight: 0,
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    flexShrink: 0,
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
