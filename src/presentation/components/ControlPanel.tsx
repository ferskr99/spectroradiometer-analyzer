import React, { useState, useCallback, useMemo } from "react";
import type { AnalysisRequest } from "../../infrastructure/api";
import { SlidersHorizontal, Combine, Play, Loader2, Maximize, Minimize } from "lucide-react";

const EXPOSURE_MIN = 10;
const EXPOSURE_MAX = 5000;
const EXPOSURE_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000] as const;

type SensorMode = "Global" | "Direct" | "All";

interface SensorOption {
  id: SensorMode;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const SENSOR_OPTIONS: SensorOption[] = [
  {
    id: "Global",
    label: "Global",
    sublabel: "GHI (2 sens.)",
    icon: <Minimize size={16} />,
  },
  {
    id: "Direct",
    label: "Directo",
    sublabel: "DNI (2 sens.)",
    icon: <Maximize size={16} />,
  },
  {
    id: "All",
    label: "Total",
    sublabel: "4 sensores",
    icon: <Combine size={16} />,
  },
];

export interface ControlPanelProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isPending: boolean;
  isSuccess?: boolean;
  errorMessage?: string | null;
  sensorTarget: "Global" | "Direct" | "All";
  onSensorTargetChange: (sensor: "Global" | "Direct" | "All") => void;
  appliedExposureMs?: number | null;
  appliedExposurePerSensor?: Record<string, number> | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAnalyze,
  isPending,
  isSuccess,
  errorMessage,
  sensorTarget,
  onSensorTargetChange,
  appliedExposurePerSensor,
}) => {
  const handleAnalyze = useCallback(() => {
    onAnalyze({
      sensor_target: sensorTarget,
      exposure_time_ms: 100, // No usado porque auto_exposure es true
      auto_exposure: true,
    });
  }, [sensorTarget, onAnalyze]);

  // Formato limpio filtrando por lo realmente medido
  const formattedExposures = useMemo(() => {
    if (!appliedExposurePerSensor) return null;
    const entries = Object.entries(appliedExposurePerSensor);
    let filtered = entries;
    if (sensorTarget === "Global") {
      filtered = entries.filter(([k]) => k.includes("GLOBAL"));
    } else if (sensorTarget === "Direct") {
      filtered = entries.filter(([k]) => k.includes("DIRECT"));
    }
    return filtered
      .map(([k, v]) => {
        const label = k
          .replace("MS-711_GLOBAL", "711 Global")
          .replace("MS-713_GLOBAL", "713 Global")
          .replace("MS-711_DIRECT", "711 Directo")
          .replace("MS-713_DIRECT", "713 Directo")
          .replace("711_GLOBAL", "711 Global")
          .replace("713_GLOBAL", "713 Global")
          .replace("711_DIRECT", "711 Directo")
          .replace("713_DIRECT", "713 Directo");
        return label + ': ' + v + 'ms';
      })
      .join(" | ");
  }, [appliedExposurePerSensor, sensorTarget]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleBox}>
          <SlidersHorizontal size={15} color="#0078d4" />
          <h3 style={styles.title}>Control Manual</h3>
        </div>
        <div
          style={{
            ...styles.statusDot,
            backgroundColor: isPending ? "#eab308" : isSuccess ? "#10b981" : "#555555",
          }}
          title={isPending ? "Adquiriendo..." : isSuccess ? "Listo" : "En espera"}
        />
      </div>

      <div style={styles.body}>
        {/* Selección de Sensor */}
        <div style={styles.section}>
          <label style={styles.label}>Sensor Objetivo</label>
          <div style={styles.sensorGrid}>
            {SENSOR_OPTIONS.map((opt) => {
              const active = sensorTarget === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSensorTargetChange(opt.id)}
                  disabled={isPending}
                  style={{
                    ...styles.sensorButton,
                    ...(active ? styles.sensorButtonActive : {}),
                    ...(isPending ? styles.disabled : {}),
                  }}
                >
                  <span style={{ color: active ? "#ffffff" : "#888888" }}>{opt.icon}</span>
                  <span style={styles.sensorLabel}>{opt.label}</span>
                  <span style={{ ...styles.sensorSublabel, color: active ? "rgba(255,255,255,0.85)" : "#777777" }}>
                    {opt.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tiempo de Exposición */}
        <div style={styles.section}>
          <div style={styles.exposureHeader}>
            <label style={styles.label}>Tiempo de Exposición</label>
            <span style={{ color: "#eab308", fontSize: 12, fontWeight: 600 }}>
              Auto-Exposición
            </span>
          </div>
          <p style={{ margin: 0, marginTop: 8, fontSize: 11, color: "#888", lineHeight: 1.4 }}>
            El sistema calcula automáticamente el tiempo óptimo de integración (de 10ms a 5000ms) para cada espectrorradiómetro, evitando la saturación y maximizando la relación señal-ruido en los cálculos científicos.
          </p>
        </div>

        {/* Botón de Adquisición */}
        <div style={styles.actionSection}>
          <button
            onClick={handleAnalyze}
            disabled={isPending}
            style={{
              ...styles.measureButton,
              ...(isPending ? styles.measureButtonPending : {}),
            }}
          >
            {isPending ? (
              <span style={styles.measureContent}>
                <Loader2 size={15} className="spin-icon" />
                ADQUIRIENDO DATOS...
              </span>
            ) : (
              <span style={styles.measureContent}>
                <Play size={15} />
                INICIAR MEDICIÓN
              </span>
            )}
          </button>

          {errorMessage ? (
            <div style={styles.errorBanner}>{errorMessage}</div>
          ) : formattedExposures ? (
            <div style={styles.infoBar}>
              <span style={styles.infoText}>
                Exposición aplicada: {formattedExposures}
              </span>
            </div>
          ) : (
            <div style={styles.infoBar}>
              <span style={styles.infoText}>
                Modo: {sensorTarget === "All" ? "Adquisición Total (4 sensores)" : sensorTarget === "Global" ? "Espectro Global (GHI)" : "Espectro Directo (DNI)"}
              </span>
            </div>
          )}
        </div>
      </div>
      <style>{`.spin-icon { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #333333",
    backgroundColor: "#111111",
  },
  titleBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: 0,
    letterSpacing: "0.03em",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  body: {
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 16,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  sensorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  sensorButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "10px 4px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    cursor: "pointer",
    outline: "none",
    transition: "all 0.15s ease",
  },
  sensorButtonActive: {
    backgroundColor: "#0078d4",
    borderColor: "#0078d4",
  },
  sensorLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
  },
  sensorSublabel: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 1.1,
  },
  exposureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  autoToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "6px 8px",
    width: 80,
  },
  inputNum: {
    width: "100%",
    backgroundColor: "transparent",
    border: "none",
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: "right",
    outline: "none",
    fontWeight: 700,
  },
  inputUnit: {
    color: "#888888",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  slider: {
    flex: 1,
    accentColor: "#0078d4",
    height: 6,
  },
  presets: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
  },
  presetBtn: {
    padding: "5px 8px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    color: "#aaaaaa",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
    fontWeight: 600,
  },
  presetBtnActive: {
    backgroundColor: "#333333",
    borderColor: "#555555",
    color: "#ffffff",
    fontWeight: 700,
  },
  actionSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  measureButton: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 24px",
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    outline: "none",
    height: 38,
    width: "auto",
    minWidth: 200,
    boxShadow: "0 2px 6px rgba(0, 120, 212, 0.3)",
  },
  measureButtonPending: {
    backgroundColor: "#333333",
    color: "#888888",
    border: "1px solid #444444",
    cursor: "not-allowed",
    boxShadow: "none",
  },
  measureContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  errorBanner: {
    padding: "6px 12px",
    backgroundColor: "#451a1a",
    border: "1px solid #7f1d1d",
    borderRadius: 4,
    color: "#fca5a5",
    fontSize: 11,
    textAlign: "center",
    width: "100%",
  },
  infoBar: {
    padding: "6px 12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    width: "100%",
    boxSizing: "border-box",
  },
  infoText: {
    color: "#888888",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    display: "block",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

export default ControlPanel;
