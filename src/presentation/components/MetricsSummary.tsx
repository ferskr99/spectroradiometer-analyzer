import React, { useMemo } from "react";
import type { AnalysisResult } from "../../infrastructure/api";
import { Sun, Leaf, Lightbulb, Zap, Droplets, Wind, Compass, Mountain } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// Definición de métricas con nombres completos para usuarios generales
// ─────────────────────────────────────────────────────────────────────

interface MetricDefinition {
  id: string;
  label: string;
  fullName: string;
  unit: string;
  unitFull: string;
  icon: React.ReactNode;
  color: string;
  getValue: (result: AnalysisResult) => number | null;
  format: (value: number) => string;
}

const ALL_METRICS: MetricDefinition[] = [
  {
    id: "par",
    label: "RFA",
    fullName: "Radiación Fotosintéticamente Activa",
    unit: "W/m²",
    unitFull: "Watts por metro cuadrado",
    icon: <Sun size={14} />,
    color: "#eab308",
    getValue: (r) => r.par,
    format: (v) => v.toFixed(4),
  },
  {
    id: "ppfd",
    label: "DFFF",
    fullName: "Densidad de Flujo de Fotones Fotosintéticos",
    unit: "µmol/m²/s",
    unitFull: "Micromoles por metro cuadrado por segundo",
    icon: <Leaf size={14} />,
    color: "#10b981",
    getValue: (r) => r.ppfd,
    format: (v) => v.toFixed(4),
  },
  {
    id: "illuminance",
    label: "Iluminancia",
    fullName: "Iluminancia Fotópica",
    unit: "lux",
    unitFull: "Lúmenes por metro cuadrado",
    icon: <Lightbulb size={14} />,
    color: "#3b82f6",
    getValue: (r) => r.illuminance,
    format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)),
  },
  {
    id: "total-irradiance",
    label: "Irradiancia Total",
    fullName: "Irradiancia Espectral Integrada",
    unit: "W/m²",
    unitFull: "Watts por metro cuadrado",
    icon: <Zap size={14} />,
    color: "#a855f7",
    getValue: (r) => r.total_irradiance,
    format: (v) => v.toFixed(4),
  },
  {
    id: "pwv",
    label: "AP",
    fullName: "Agua Precipitable (Vapor de Agua)",
    unit: "cm",
    unitFull: "Centímetros de agua",
    icon: <Droplets size={14} />,
    color: "#06b6d4",
    getValue: (r) => r.pwv_cm ?? null,
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "aod-500",
    label: "EOA",
    fullName: "Espesor Óptico de Aerosoles (500 nm)",
    unit: "τ",
    unitFull: "Profundidad óptica (adimensional)",
    icon: <Wind size={14} />,
    color: "#f97316",
    getValue: (r) => (r.aod_bands ? (r.aod_bands["500"] ?? null) : null),
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "sza",
    label: "Ángulo Cenital Solar",
    fullName: "Ángulo Cenital Solar (SZA)",
    unit: "°",
    unitFull: "Grados sexagesimales",
    icon: <Compass size={14} />,
    color: "#ec4899",
    getValue: (r) => r.solar_geometry?.sza ?? null,
    format: (v) => v.toFixed(2),
  },
  {
    id: "air-mass",
    label: "Masa de Aire",
    fullName: "Masa de Aire Óptica Relativa",
    unit: "AM",
    unitFull: "Adimensional (relativa al cénit)",
    icon: <Mountain size={14} />,
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
    title={`${metric.fullName}\nUnidad: ${metric.unitFull}`}
  >
    <div style={styles.cardHeader}>
      <span style={{ ...styles.cardIcon, color: metric.color }}>{metric.icon}</span>
      <span style={styles.cardLabel}>{metric.label}</span>
    </div>

    <div style={styles.cardFullName}>{metric.fullName}</div>

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
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    transition: "border-color 0.15s ease",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  cardIcon: {
    display: "flex",
    alignItems: "center",
  },
  cardLabel: {
    color: "#cccccc",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  cardFullName: {
    color: "#666",
    fontSize: 10,
    fontWeight: 400,
    lineHeight: 1.3,
    marginBottom: 2,
  },
  valueContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: 5,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  cardUnit: {
    color: "#888888",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 500,
  },
  skeletonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    height: 18,
    justifyContent: "center",
  },
  skeletonValue: {
    width: "70%",
    height: 14,
    backgroundColor: "#333333",
    borderRadius: 3,
  },
};

export default MetricsSummary;
