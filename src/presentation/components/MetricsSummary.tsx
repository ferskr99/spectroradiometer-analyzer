import React, { useMemo } from "react";
import type { AnalysisResult } from "../../infrastructure/api";
import { Sun, Leaf, Lightbulb, Zap, Droplets, Wind, Compass, Mountain } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// Definición de métricas consolidadas (8 métricas en línea SCADA)
// ─────────────────────────────────────────────────────────────────────

interface MetricDefinition {
  id: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  getValue: (result: AnalysisResult) => number | null;
  format: (value: number) => string;
}

const ALL_METRICS: MetricDefinition[] = [
  {
    id: "par",
    label: "PAR",
    unit: "W/m²",
    icon: <Sun size={12} />,
    color: "#eab308",
    getValue: (r) => r.par,
    format: (v) => v.toFixed(4),
  },
  {
    id: "ppfd",
    label: "PPFD",
    unit: "µmol",
    icon: <Leaf size={12} />,
    color: "#10b981",
    getValue: (r) => r.ppfd,
    format: (v) => v.toFixed(4),
  },
  {
    id: "illuminance",
    label: "LUX",
    unit: "lx",
    icon: <Lightbulb size={12} />,
    color: "#3b82f6",
    getValue: (r) => r.illuminance,
    format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)),
  },
  {
    id: "total-irradiance",
    label: "TOTAL",
    unit: "W/m²",
    icon: <Zap size={12} />,
    color: "#a855f7",
    getValue: (r) => r.total_irradiance,
    format: (v) => v.toFixed(4),
  },
  {
    id: "pwv",
    label: "PWV",
    unit: "cm",
    icon: <Droplets size={12} />,
    color: "#06b6d4",
    getValue: (r) => r.pwv_cm ?? null,
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "aod-500",
    label: "AOD₅₀₀",
    unit: "τ",
    icon: <Wind size={12} />,
    color: "#f97316",
    getValue: (r) => (r.aod_bands ? (r.aod_bands["500"] ?? null) : null),
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "sza",
    label: "SZA",
    unit: "°",
    icon: <Compass size={12} />,
    color: "#ec4899",
    getValue: (r) => r.solar_geometry?.sza ?? null,
    format: (v) => v.toFixed(2),
  },
  {
    id: "air-mass",
    label: "AM",
    unit: "AM",
    icon: <Mountain size={12} />,
    color: "#8b5cf6",
    getValue: (r) => r.solar_geometry?.air_mass ?? null,
    format: (v) => v.toFixed(3),
  },
];

export interface MetricsSummaryProps {
  data: AnalysisResult | null;
  isLoading: boolean;
}

const MetricCard: React.FC<{
  metric: MetricDefinition;
  value: number | null;
  isLoading: boolean;
}> = ({ metric, value, isLoading }) => (
  <div
    style={{
      ...styles.card,
      borderColor: isLoading ? "#2a2a2a" : "#333333",
    }}
  >
    <div style={styles.cardHeader}>
      <span style={{ ...styles.cardIcon, color: metric.color }}>{metric.icon}</span>
      <span style={styles.cardLabel}>{metric.label}</span>
    </div>

    {isLoading ? (
      <div style={styles.skeletonContainer}>
        <div style={styles.skeletonValue} />
      </div>
    ) : (
      <div style={styles.valueContainer}>
        <span
          style={{
            ...styles.cardValue,
            color: value !== null && value >= 0 ? "#e0e0e0" : "#555555",
          }}
        >
          {value !== null ? metric.format(value) : "—"}
        </span>
        <span style={styles.cardUnit}>{metric.unit}</span>
      </div>
    )}
  </div>
);

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({
  data,
  isLoading,
}) => {
  const computedValues = useMemo(() => {
    if (!data) return null;
    return ALL_METRICS.map((m) => ({
      id: m.id,
      value: m.getValue(data),
    }));
  }, [data]);

  return (
    <div style={styles.container}>
      <div style={styles.grid} className="metrics-grid">
        {ALL_METRICS.map((metric) => {
          const computed = computedValues?.find((c) => c.id === metric.id);
          return (
            <MetricCard
              key={metric.id}
              metric={metric}
              value={computed?.value ?? null}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Inter', system-ui, sans-serif",
    width: "100%",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gap: 8,
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardIcon: {
    display: "flex",
    alignItems: "center",
  },
  cardLabel: {
    color: "#cccccc",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  valueContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  cardUnit: {
    color: "#888888",
    fontSize: 9,
    fontFamily: "'JetBrains Mono', monospace",
  },
  skeletonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    height: 16,
    justifyContent: "center",
  },
  skeletonValue: {
    width: "70%",
    height: 12,
    backgroundColor: "#333333",
    borderRadius: 2,
  },
};

export default MetricsSummary;
