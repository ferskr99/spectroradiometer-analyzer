/**
 * Dashboard.tsx
 *
 * Vista principal de la cabina científica del espectrorradiómetro.
 * Izquierda: Control Manual y Control Programado.
 * Derecha: Gráficas Crudas (MS-711 y MS-713).
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAnalyzeSpectrum } from "../../application/hooks/useSpectrometer";
import { ControlPanel } from "../components/ControlPanel";

import { RawSensorsGraph } from "../components/RawSensorsGraph";
import { SpectralGraph } from "../components/SpectralGraph";
import { ContinuousSchedulerPanel } from "../components/ContinuousSchedulerPanel";
import { Clock, FileText, AlertCircle, Activity, Zap } from "lucide-react";

export const Dashboard: React.FC = () => {
  const [sensorTarget, setSensorTarget] = useState<"Global" | "Direct" | "All">("All");
  const [activeTab, setActiveTab] = useState<"consolidated" | "raw">("consolidated");
  const {
    analyze,
    data: mutationData,
    isPending,
    isError,
    error,
    isSuccess,
    reset,
  } = useAnalyzeSpectrum();

  const { data: cachedData } = useQuery<any>({
    queryKey: ["lastAnalysis"],
    staleTime: Infinity,
  });

  const activeData = cachedData ?? mutationData;
  const isDataAvailable = !!activeData;

  return (
    <main style={styles.main}>
      {/* Columna Izquierda: Controles ajustados a su altura natural */}
      <div style={styles.leftColumn}>
        <div style={styles.logoContainer}>
          <img src="/unsa_logo.png" alt="UNSA Logo" style={styles.logo} />
        </div>
        <div style={styles.panelContainer}>
          <ControlPanel
            onAnalyze={analyze}
            isPending={isPending}
            isSuccess={isSuccess}
            errorMessage={isError ? error?.message ?? "Error de medición" : null}
            sensorTarget={sensorTarget as any}
            onSensorTargetChange={(target) => {
              setSensorTarget(target);
              reset();
            }}
            appliedExposurePerSensor={isDataAvailable ? activeData?.applied_exposure_per_sensor : null}
          />
        </div>

        <div style={styles.panelContainer}>
          <ContinuousSchedulerPanel />
        </div>
      </div>

      {/* Columna Derecha: Gráficas Crudas de los Espectrorradiómetros */}
      <div style={styles.rightColumn}>
        <div style={styles.tabsContainer}>
          <button 
            style={activeTab === "consolidated" ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab("consolidated")}
          >
            <Activity size={14} /> Espectro Consolidado
          </button>
          <button 
            style={activeTab === "raw" ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab("raw")}
          >
            <Zap size={14} /> Diagnóstico de Hardware
          </button>
        </div>

        <div style={styles.graphContainer}>
          {activeTab === "consolidated" ? (
            <SpectralGraph
              data={isDataAvailable ? activeData?.merged_spectrum ?? null : null}
              globalData={isDataAvailable ? activeData?.global_spectrum ?? null : null}
              directData={isDataAvailable ? activeData?.direct_spectrum ?? null : null}
              diffuseData={isDataAvailable ? activeData?.diffuse_spectrum ?? null : null}
              rawSpectra={null}
              sensorTarget={sensorTarget}
              isLoading={isPending}
              height="100%"
            />
          ) : (
            <RawSensorsGraph 
              data={isDataAvailable ? (activeData ?? null) : null} 
              isLoading={isPending} 
              height="100%" 
            />
          )}
        </div>

        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            {isPending ? (
              <span style={styles.statusTextActive}><Clock size={13} /> Adquiriendo datos espectrales...</span>
            ) : isDataAvailable ? (
              <span style={styles.statusText}><FileText size={13} /> Última medición completada con éxito</span>
            ) : isError ? (
              <span style={styles.statusTextError}><AlertCircle size={13} /> Error en la última medición</span>
            ) : (
              <span style={styles.statusText}>Sistema listo para adquisición</span>
            )}
          </div>
          <span style={styles.statusTimestamp}>
            {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "grid",
    gridTemplateColumns: "33% 67%",
    gap: 14,
    padding: "14px 16px",
    height: "calc(100vh - 48px)",
    boxSizing: "border-box",
    backgroundColor: "#111111",
    overflow: "hidden",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    height: "100%",
    minWidth: 0,
    overflowY: "auto",
  },
  logoContainer: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    minHeight: 80,
  },
  logo: {
    width: "85%",
    maxWidth: 360,
    objectFit: "contain",
  },
  panelContainer: {
    display: "flex",
    flexDirection: "column",
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    minWidth: 0,
  },
  graphContainer: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    overflow: "hidden", // Changed from overflowY: auto so 100% height works correctly
  },
  tabsContainer: {
    display: "flex",
    gap: 8,
    borderBottom: "1px solid #333333",
    paddingBottom: 8,
    flexShrink: 0,
  },
  tabActive: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  tabInactive: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
    color: "#888888",
    border: "1px solid #333333",
    padding: "8px 16px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 14px",
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
    fontSize: 11,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTextActive: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTextError: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusTimestamp: {
    color: "#888888",
    fontSize: 11,
    fontFamily: '"JetBrains Mono", monospace',
  },
};

export default Dashboard;
