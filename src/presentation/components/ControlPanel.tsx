import React, { useState, useCallback } from "react";
import type { AnalysisRequest } from "../../infrastructure/api";
import { SlidersHorizontal, Combine, Play, Loader2, Maximize, Minimize } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio
// ─────────────────────────────────────────────────────────────────────

const EXPOSURE_MIN = 10;
const EXPOSURE_MAX = 5000;
const EXPOSURE_DEFAULT = 100;

type SensorMode = "MS-711" | "MS-712" | "Merge";

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
    id: "MS-712",
    label: "MS-712",
    description: "NIR ext. (900–1700 nm)",
    icon: <Maximize size={18} />,
  },
  {
    id: "Merge",
    label: "Fusión",
    description: "Completo (300–1700 nm)",
    icon: <Combine size={18} />,
  },
];

const EXPOSURE_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000] as const;

export interface ControlPanelProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isPending: boolean;
  isSuccess?: boolean;
  errorMessage?: string | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAnalyze,
  isPending,
  isSuccess,
  errorMessage,
}) => {
  const [selectedSensor, setSelectedSensor] = useState<SensorMode>("Merge");
  const [exposureMs, setExposureMs] = useState(EXPOSURE_DEFAULT);

  const handleExposureInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      setExposureMs(Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, raw)));
    },
    [],
  );

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setExposureMs(parseInt(e.target.value, 10));
    },
    [],
  );

  const handleMeasure = useCallback(() => {
    onAnalyze({ sensor_target: selectedSensor, exposure_time_ms: exposureMs });
  }, [onAnalyze, selectedSensor, exposureMs]);

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
                onClick={() => setSelectedSensor(opt.id)}
                disabled={isPending}
                style={{
                  ...styles.sensorButton,
                  ...(selectedSensor === opt.id ? styles.sensorButtonActive : {}),
                  ...(isPending ? styles.disabled : {}),
                }}
              >
                <div style={styles.sensorIcon}>{opt.icon}</div>
                <span style={{...styles.sensorLabel, color: selectedSensor === opt.id ? "#e0e0e0" : "#888"}}>{opt.label}</span>
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
                value={exposureMs}
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
            value={exposureMs}
            onChange={handleSliderChange}
            disabled={isPending}
            style={styles.slider}
          />

          <div style={styles.presets}>
            {EXPOSURE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setExposureMs(preset)}
                disabled={isPending}
                style={{
                  ...styles.presetButton,
                  ...(exposureMs === preset ? styles.presetButtonActive : {}),
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
            onClick={handleMeasure}
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
                Modo: {selectedSensor === "Merge" ? "Sincronizado (MS-711 + MS-712)" : `Individual (${selectedSensor})`}
              </span>
              <span style={styles.infoText}>
                Timeout HW: ~{Math.ceil(exposureMs / 1000)}–{Math.ceil((exposureMs * 1.5) / 1000)}s
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
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid #2a2a2a",
  },
  title: {
    color: "#e0e0e0",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
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
    gridTemplateColumns: "minmax(300px, 1fr) minmax(300px, 1fr) minmax(250px, 1fr)",
    gap: 24,
    alignItems: "start",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  actionSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    justifyContent: "flex-end",
    height: "100%",
  },
  label: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
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
    gap: 6,
    padding: "12px 8px",
    backgroundColor: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.1s ease",
    outline: "none",
  },
  sensorButtonActive: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444444",
  },
  sensorIcon: {
    color: "#888888",
  },
  sensorLabel: {
    fontSize: 12,
    fontWeight: 600,
  },
  sensorDesc: {
    color: "#666666",
    fontSize: 9,
    textAlign: "center" as const,
  },
  exposureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exposureInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1c1c1c",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "4px 8px",
  },
  exposureInput: {
    width: 60,
    backgroundColor: "transparent",
    border: "none",
    color: "#e0e0e0",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: "right" as const,
    outline: "none",
  },
  exposureUnit: {
    color: "#888888",
    fontSize: 12,
  },
  slider: {
    width: "100%",
  },
  presets: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    marginTop: 4,
  },
  presetButton: {
    padding: "4px 10px",
    backgroundColor: "#1c1c1c",
    border: "1px solid #333333",
    borderRadius: 4,
    color: "#888888",
    fontSize: 11,
    cursor: "pointer",
    outline: "none",
  },
  presetButtonActive: {
    backgroundColor: "#e0e0e0",
    borderColor: "#e0e0e0",
    color: "#111111",
    fontWeight: 600,
  },
  measureButton: {
    display: "flex",
    justifyContent: "center",
    padding: "16px 20px",
    backgroundColor: "#e0e0e0",
    color: "#111111",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    outline: "none",
    height: 52,
  },
  measureButtonPending: {
    backgroundColor: "#333333",
    color: "#888888",
    cursor: "not-allowed",
  },
  measureContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  measureSpinner: {
    color: "#888888",
  },
  errorBanner: {
    padding: "10px",
    backgroundColor: "#451a1a",
    border: "1px solid #7f1d1d",
    borderRadius: 4,
    color: "#fca5a5",
    fontSize: 12,
    textAlign: "center" as const,
  },
  infoBar: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px",
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    justifyContent: "center",
  },
  infoText: {
    color: "#666666",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    pointerEvents: "none" as const,
  },
};

export default ControlPanel;
