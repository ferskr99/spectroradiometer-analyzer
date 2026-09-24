import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAnalyzeSpectrum } from "../../application/hooks/useSpectrometer";
import { ControlPanel } from "../components/ControlPanel";
import { RawSensorsGraph } from "../components/RawSensorsGraph";
import type { AnalysisResult } from "../../infrastructure/api/api_client";

export const RawSensorsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [sensorTarget, setSensorTarget] = useState<"Global" | "Direct" | "All">("All");
  
  const {
    analyze,
    data: mutationData,
    isPending,
    isError,
    error,
    isSuccess,
  } = useAnalyzeSpectrum();

  const [lastData, setLastData] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (mutationData) {
      setLastData(mutationData);
    } else {
      const cached = queryClient.getQueryData<AnalysisResult>(["lastAnalysis"]);
      if (cached) setLastData(cached);
    }
  }, [mutationData, queryClient]);

  useEffect(() => {
    const handleUpdate = () => {
      const cached = queryClient.getQueryData<AnalysisResult>(["lastAnalysis"]);
      if (cached) setLastData(cached);
    };
    window.addEventListener("spectrometer:measurement_complete", handleUpdate);
    return () => window.removeEventListener("spectrometer:measurement_complete", handleUpdate);
  }, [queryClient]);

  return (
    <main style={styles.main}>
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
            onSensorTargetChange={setSensorTarget}
            appliedExposurePerSensor={isSuccess ? mutationData?.applied_exposure_per_sensor : null}
          />
        </div>
        
        <div style={styles.infoBox}>
          <h4 style={styles.infoTitle}>Diagnóstico de Hardware</h4>
          <p style={styles.infoText}>
            Esta vista muestra las firmas espectrales crudas directas de los sensores MS-711 y MS-713,
            antes de que el algoritmo combine y suavice las curvas. Utilice esta herramienta para
            verificar anomalías de calibración o superposición óptica entre ambos equipos.
          </p>
        </div>
      </div>

      <div style={styles.rightColumn}>
        <RawSensorsGraph data={lastData} isLoading={isPending} height={300} />
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: { display: "flex", flex: 1, padding: 24, gap: 24, height: "calc(100vh - 48px)", overflow: "hidden" },
  leftColumn: { width: 320, minWidth: 320, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" },
  rightColumn: { flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", paddingRight: 8 },
  logoContainer: { display: "flex", justifyContent: "center", paddingBottom: 16, borderBottom: "1px solid #2a2a2a" },
  logo: { width: 140, opacity: 0.9, filter: "grayscale(20%) contrast(1.2)" },
  panelContainer: { display: "flex", flexDirection: "column" },
  infoBox: { marginTop: 16, padding: 16, backgroundColor: "rgba(0, 120, 212, 0.05)", border: "1px solid rgba(0, 120, 212, 0.2)", borderRadius: 8 },
  infoTitle: { margin: "0 0 8px 0", color: "#60a5fa", fontSize: 13, fontWeight: 600 },
  infoText: { margin: 0, color: "#aaaaaa", fontSize: 12, lineHeight: 1.5 },
};
