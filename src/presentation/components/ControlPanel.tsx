/**
 * ControlPanel.tsx
 *
 * Panel de control del hardware para el espectrorradiómetro.
 * Permite seleccionar el sensor, ajustar el tiempo de exposición
 * y disparar la medición. Se deshabilita durante la captura para
 * evitar colisiones en la comunicación serial RS-232C.
 */

import React, { useState, useCallback } from "react";
import type { AnalysisRequest } from "../../infrastructure/api";

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio
// ─────────────────────────────────────────────────────────────────────

/** Límites del tiempo de exposición del obturador (ms). */
const EXPOSURE_MIN = 10;
const EXPOSURE_MAX = 5000;
const EXPOSURE_DEFAULT = 100;

/** Modos de operación del sensor. */
type SensorMode = "MS-711" | "MS-712" | "Merge";

interface SensorOption {
  id: SensorMode;
  label: string;
  description: string;
  icon: string;
}

const SENSOR_OPTIONS: SensorOption[] = [
  {
    id: "MS-711",
    label: "MS-711",
    description: "UV-VIS-NIR (300–1100 nm)",
    icon: "🔬",
  },
  {
    id: "MS-712",
    label: "MS-712",
    description: "NIR extendido (900–1700 nm)",
    icon: "🔭",
  },
  {
    id: "Merge",
    label: "Fusión",
    description: "Espectro combinado (300–1700 nm)",
    icon: "🔗",
  },
];

// Presets de tiempos de exposición comunes
const EXPOSURE_PRESETS = [10, 50, 100, 500, 1000, 2500, 5000] as const;

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface ControlPanelProps {
  /** Callback para iniciar la medición/análisis. */
  onAnalyze: (request: AnalysisRequest) => void;
  /** `true` mientras el hardware está capturando (deshabilita controles). */
  isPending: boolean;
  /** `true` si la última medición fue exitosa. */
  isSuccess?: boolean;
  /** Mensaje de error de la última medición. */
  errorMessage?: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAnalyze,
  isPending,
  isSuccess,
  errorMessage,
}) => {
  const [selectedSensor, setSelectedSensor] = useState<SensorMode>("Merge");
  const [exposureMs, setExposureMs] = useState(EXPOSURE_DEFAULT);

  // Clamp del valor de exposición al rango válido
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
      {/* ─── Header ─────────────────────────────────────────── */}
      <div style={styles.header}>
        <h3 style={styles.title}>Control del Espectrorradiómetro</h3>
        <div
          style={{
            ...styles.statusDot,
            backgroundColor: isPending
              ? "#f59e0b"
              : isSuccess
                ? "#10b981"
                : "#334155",
            boxShadow: isPending
              ? "0 0 8px rgba(245, 158, 11, 0.5)"
              : isSuccess
                ? "0 0 8px rgba(16, 185, 129, 0.4)"
                : "none",
          }}
        />
      </div>

      {/* ─── Selector de sensor ─────────────────────────────── */}
      <div style={styles.section}>
        <label style={styles.label}>Sensor objetivo</label>
        <div style={styles.sensorGrid}>
          {SENSOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedSensor(opt.id)}
              disabled={isPending}
              style={{
                ...styles.sensorButton,
                ...(selectedSensor === opt.id
                  ? styles.sensorButtonActive
                  : {}),
                ...(isPending ? styles.disabled : {}),
              }}
            >
              <span style={styles.sensorIcon}>{opt.icon}</span>
              <span style={styles.sensorLabel}>{opt.label}</span>
              <span style={styles.sensorDesc}>{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tiempo de exposición ───────────────────────────── */}
      <div style={styles.section}>
        <div style={styles.exposureHeader}>
          <label style={styles.label}>Tiempo de exposición</label>
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

        {/* Slider */}
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

        {/* Marcas de rango */}
        <div style={styles.sliderMarks}>
          <span style={styles.sliderMark}>{EXPOSURE_MIN} ms</span>
          <span style={styles.sliderMark}>{EXPOSURE_MAX} ms</span>
        </div>

        {/* Presets rápidos */}
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

      {/* ─── Botón de medición ──────────────────────────────── */}
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
            <span style={styles.measureSpinner} />
            Adquiriendo espectro...
          </span>
        ) : (
          <span style={styles.measureContent}>
            <span style={styles.measureIcon}>▶</span>
            Iniciar Medición
          </span>
        )}
      </button>

      {/* ─── Mensaje de estado ──────────────────────────────── */}
      {errorMessage && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          {errorMessage}
        </div>
      )}

      {/* ─── Info del modo seleccionado ─────────────────────── */}
      <div style={styles.infoBar}>
        <span style={styles.infoText}>
          {selectedSensor === "Merge"
            ? "Se adquirirán ambos sensores (MS-711 + MS-712) y se fusionarán a 1nm"
            : `Lectura individual del sensor ${selectedSensor}`}
        </span>
        <span style={styles.infoText}>
          Latencia estimada: ~{Math.ceil(exposureMs / 1000)}–
          {Math.ceil((exposureMs * 1.5) / 1000)}s
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    border: "1px solid rgba(51, 65, 85, 0.5)",
    padding: 20,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    transition: "all 0.3s ease",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  // Sensor selector
  sensorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  sensorButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 8px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
  },
  sensorButtonActive: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "#3b82f6",
    boxShadow: "0 0 12px rgba(59, 130, 246, 0.15)",
  },
  sensorIcon: {
    fontSize: 20,
  },
  sensorLabel: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 600,
  },
  sensorDesc: {
    color: "#64748b",
    fontSize: 10,
    textAlign: "center" as const,
  },

  // Exposure
  exposureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exposureInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "4px 8px",
  },
  exposureInput: {
    width: 60,
    backgroundColor: "transparent",
    border: "none",
    color: "#f1f5f9",
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontWeight: 600,
    textAlign: "right" as const,
    outline: "none",
  },
  exposureUnit: {
    color: "#64748b",
    fontSize: 12,
  },
  slider: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    appearance: "auto" as const,
    cursor: "pointer",
    accentColor: "#3b82f6",
  },
  sliderMarks: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderMark: {
    color: "#475569",
    fontSize: 10,
  },
  presets: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    marginTop: 4,
  },
  presetButton: {
    padding: "4px 10px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 14,
    color: "#94a3b8",
    fontSize: 11,
    cursor: "pointer",
    transition: "all 0.15s ease",
    outline: "none",
  },
  presetButtonActive: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "#3b82f6",
    color: "#60a5fa",
  },

  // Measure button
  measureButton: {
    display: "flex",
    justifyContent: "center",
    padding: "14px 20px",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
    boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
  },
  measureButtonPending: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  measureContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 600,
  },
  measureIcon: {
    fontSize: 12,
  },
  measureSpinner: {
    width: 16,
    height: 16,
    border: "2px solid rgba(148, 163, 184, 0.3)",
    borderTopColor: "#94a3b8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    display: "inline-block",
  },

  // Error
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    color: "#fca5a5",
    fontSize: 12,
  },
  errorIcon: {
    fontSize: 14,
  },

  // Info bar
  infoBar: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 12px",
    backgroundColor: "#1e293b",
    borderRadius: 8,
  },
  infoText: {
    color: "#475569",
    fontSize: 11,
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    pointerEvents: "none" as const,
  },
};

export default ControlPanel;
