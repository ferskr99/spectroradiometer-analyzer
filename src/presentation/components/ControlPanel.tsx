import React, { useState, useCallback } from "react";
import type { AnalysisRequest } from "../../infrastructure/api";
import { SlidersHorizontal, Combine, Play, Loader2, Maximize, Minimize } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio
// ─────────────────────────────────────────────────────────────────────

const EXPOSURE_MIN = 10;
const EXPOSURE_MAX = 5000;
const EXPOSURE_DEFAULT = 100;

type SensorMode = "MS-711" | "MS-713" | "Merge";

interface SensorOption {
  id: SensorMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SENSOR_OPTIONS: SensorOption[] = [
  {
    id: "MS-711",
    label: "MS-711",
    description: "UV-VIS-NIR (300–1100 nm)",
    icon: <Minimize size={18} />,
  },
  {
    id: "MS-713",
    label: "MS-713",
    description: "NIR ext. (900–2500 nm)",
    icon: <Maximize size={18} />,
  },
  {
    id: "Merge",
    label: "Fusión",
    description: "Completo (300–2500 nm)",
    icon: <Combine size={18} />,
  },
];

const EXPOSURE_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000] as const;

export interface ControlPanelProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isPending: boolean;
  isSuccess?: boolean;
  errorMessage?: string | null;
  sensorTarget: "MS-711" | "MS-713" | "Merge";
  onSensorTargetChange: (sensor: "MS-711" | "MS-713" | "Merge") => void;
  exposureTime: number;
  onExposureTimeChange: (time: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAnalyze,
  isPending,
  isSuccess,
  errorMessage,
  sensorTarget,
  onSensorTargetChange,
  exposureTime,
  onExposureTimeChange,
}) => {

  const handleExposureInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      onExposureTimeChange(Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, raw)));
    },
    [onExposureTimeChange],
  );

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      onExposureTimeChange(Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, raw)));
    },
    [onExposureTimeChange],
  );

  const handleAnalyze = useCallback(() => {
    onAnalyze({
      sensor_target: sensorTarget,
      exposure_time_ms: exposureTime,
    });
  }, [sensorTarget, exposureTime, onAnalyze]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <SlidersHorizontal size={14} style={{ marginRight: 6 }} />
          Control del Instrumento
        </h3>
        <div
          style={{
            ...styles.statusDot,
            backgroundColor: isPending ? "#eab308" : isSuccess ? "#10b981" : "#555",
          }}
        />
      </div>

      <div style={styles.horizontalBody}>
        {/* Columna 1: Sensor */}
        <div style={styles.section}>
          <label style={styles.label}>Sensor Objetivo</label>
          <div style={styles.sensorGrid}>
            {SENSOR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSensorTargetChange(opt.id)}
                disabled={isPending}
                style={{
                  ...styles.sensorButton,
                  ...(sensorTarget === opt.id ? styles.sensorButtonActive : {}),
                  ...(isPending ? styles.disabled : {}),
                }}
              >
                <div style={styles.sensorIcon}>{opt.icon}</div>
                <span style={{...styles.sensorLabel, color: sensorTarget === opt.id ? "#e0e0e0" : "#888"}}>{opt.label}</span>
                <span style={styles.sensorDesc}>{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Columna 2: Exposición */}
        <div style={styles.section}>
          <div style={styles.exposureHeader}>
            <label style={styles.label}>Tiempo de Exposición</label>
            <div style={styles.exposureInputWrapper}>
              <input
                type="number"
                value={exposureTime}
                onChange={handleExposureInput}
                min={EXPOSURE_MIN}
                max={EXPOSURE_MAX}
                disabled={isPending}
                style={{
                  ...styles.exposureInput,
                  ...(isPending ? styles.disabled : {}),
                }}
              />
              <span style={styles.exposureUnit}>ms</span>
            </div>
          </div>

          <input
            type="range"
            min={EXPOSURE_MIN}
            max={EXPOSURE_MAX}
            step={10}
            value={exposureTime}
            onChange={(e) => onExposureTimeChange(Number(e.target.value))}
            disabled={isPending}
            style={{
              ...styles.slider,
              background: `linear-gradient(to right, #0078d4 ${
                ((exposureTime - EXPOSURE_MIN) / (EXPOSURE_MAX - EXPOSURE_MIN)) * 100
              }%, #333333 ${
                ((exposureTime - EXPOSURE_MIN) / (EXPOSURE_MAX - EXPOSURE_MIN)) * 100
              }%)`,
            }}
          />

          <div style={styles.presets}>
            {EXPOSURE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => onExposureTimeChange(preset)}
                disabled={isPending}
                style={{
                  ...styles.presetButton,
                  ...(exposureTime === preset ? styles.presetButtonActive : {}),
                  ...(isPending ? styles.disabled : {}),
                }}
              >
                {preset >= 1000 ? `${preset / 1000}s` : `${preset}ms`}
              </button>
            ))}
          </div>
        </div>

        {/* Columna 3: Acción */}
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
                <Loader2 size={16} className="spin-icon" style={styles.measureSpinner} />
                ADQUIRIENDO DATOS...
              </span>
            ) : (
              <span style={styles.measureContent}>
                <Play size={16} />
                INICIAR MEDICIÓN
              </span>
            )}
          </button>

          {errorMessage ? (
            <div style={styles.errorBanner}>
              {errorMessage}
            </div>
          ) : (
            <div style={styles.infoBar}>
              <span style={styles.infoText}>
                Modo: {sensorTarget === "Merge" ? "Sincronizado (MS-711 + MS-713)" : `Individual (${sensorTarget})`}
              </span>
              <span style={styles.infoText}>
                Timeout HW: ~{Math.ceil(exposureTime / 1000)}–{Math.ceil((exposureTime * 1.5) / 1000)}s
              </span>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 24,
    flex: 2,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottom: "1px solid #333333",
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    margin: 0,
    display: "flex",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  horizontalBody: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 1fr) minmax(320px, 1fr) minmax(260px, 1fr)",
    gap: 28,
    alignItems: "start",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  actionSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    justifyContent: "flex-end",
    height: "100%",
  },
  label: {
    color: "#cccccc",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  sensorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  sensorButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "16px 8px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    cursor: "pointer",
    transition: "background-color 0.1s ease",
    outline: "none",
  },
  sensorButtonActive: {
    backgroundColor: "#0078d4",
    borderColor: "#0078d4",
  },
  sensorIcon: {
    color: "inherit",
  },
  sensorLabel: {
    fontSize: 13,
    fontWeight: 600,
  },
  sensorDesc: {
    color: "inherit",
    opacity: 0.8,
    fontSize: 10,
    textAlign: "center" as const,
    marginTop: 2,
  },
  exposureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exposureInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "6px 12px",
  },
  exposureInput: {
    width: 65,
    backgroundColor: "transparent",
    border: "none",
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: "right" as const,
    outline: "none",
    fontWeight: 500,
  },
  exposureUnit: {
    color: "#888888",
    fontSize: 13,
  },
  slider: {
    width: "100%",
    accentColor: "#0078d4",
  },
  presets: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    marginTop: 6,
  },
  presetButton: {
    padding: "6px 12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    color: "#cccccc",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    transition: "background-color 0.1s ease",
  },
  presetButtonActive: {
    backgroundColor: "#333333",
    borderColor: "#555555",
    color: "#ffffff",
    fontWeight: 600,
  },
  measureButton: {
    display: "flex",
    justifyContent: "center",
    padding: "16px 20px",
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    outline: "none",
    height: 56,
    transition: "background-color 0.1s ease",
  },
  measureButtonPending: {
    backgroundColor: "#333333",
    color: "#888888",
    border: "1px solid #444444",
    cursor: "not-allowed",
  },
  measureContent: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 600,
  },
  measureSpinner: {
    color: "#888888",
  },
  errorBanner: {
    padding: "12px",
    backgroundColor: "#451a1a",
    border: "1px solid #7f1d1d",
    borderRadius: 4,
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center" as const,
    fontWeight: 500,
  },
  infoBar: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    justifyContent: "center",
  },
  infoText: {
    color: "#888888",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    pointerEvents: "none" as const,
  },
};

export default ControlPanel;
