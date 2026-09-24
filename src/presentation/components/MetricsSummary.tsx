import React, { useMemo } from "react";
import type { AnalysisResult } from "../../infrastructure/api";
import {
  Sun,
  Leaf,
  Lightbulb,
  Zap,
  Droplets,
  Wind,
  Compass,
  Mountain,
  ArrowDown,
  Cloud,
  Eye,
  Gauge,
} from "lucide-react";

export interface MetricDefinition {
  id: string;
  sigla: string;
  fullName: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  getValue: (result: AnalysisResult) => number | null;
  format: (value: number) => string;
}

const ALL_METRICS: MetricDefinition[] = [
  {
    id: "par",
    sigla: "RFA",
    fullName: "Radiación Fotosintéticamente Activa",
    unit: "W/m²",
    icon: <Sun size={15} />,
    color: "#eab308",
    getValue: (r) => r.par,
    format: (v) => v.toFixed(4),
  },
  {
    id: "ppfd",
    sigla: "DFFF",
    fullName: "Flujo Fotónico Fotosintético",
    unit: "µmol/m²/s",
    icon: <Leaf size={15} />,
    color: "#10b981",
    getValue: (r) => r.ppfd,
    format: (v) => v.toFixed(4),
  },
  {
    id: "illuminance",
    sigla: "ILUM",
    fullName: "Iluminancia Fotópica",
    unit: "lux",
    icon: <Lightbulb size={15} />,
    color: "#3b82f6",
    getValue: (r) => r.illuminance,
    format: (v) => (v >= 10000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(1)),
  },
  {
    id: "total-irradiance",
    sigla: "GHI",
    fullName: "Irradiancia Global Horizontal",
    unit: "W/m²",
    icon: <Zap size={15} />,
    color: "#00d2ff",
    getValue: (r) => r.total_irradiance,
    format: (v) => v.toFixed(4),
  },
  {
    id: "dni",
    sigla: "DNI",
    fullName: "Irradiancia Normal Directa",
    unit: "W/m²",
    icon: <ArrowDown size={15} />,
    color: "#f97316",
    getValue: (r) => (r as any).dni ?? null,
    format: (v) => v.toFixed(4),
  },
  {
    id: "dhi",
    sigla: "DHI",
    fullName: "Irradiancia Difusa Horizontal",
    unit: "W/m²",
    icon: <Cloud size={15} />,
    color: "#a855f7",
    getValue: (r) => (r as any).dhi ?? null,
    format: (v) => v.toFixed(4),
  },
  {
    id: "clearness-index",
    sigla: "IC (k_t)",
    fullName: "Índice de Claridad Espectral",
    unit: "k_t",
    icon: <Eye size={15} />,
    color: "#34d399",
    getValue: (r) => (r as any).clearness_index ?? null,
    format: (v) => v.toFixed(4),
  },
  {
    id: "diffuse-fraction",
    sigla: "FD (k_d)",
    fullName: "Fracción Difusa Espectral",
    unit: "k_d",
    icon: <Gauge size={15} />,
    color: "#c084fc",
    getValue: (r) => (r as any).diffuse_fraction ?? null,
    format: (v) => v.toFixed(4),
  },
  {
    id: "pwv",
    sigla: "AP (PWV)",
    fullName: "Agua Precipitable (Atmósfera)",
    unit: "cm",
    icon: <Droplets size={15} />,
    color: "#06b6d4",
    getValue: (r) => r.pwv_cm ?? null,
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "aod-500",
    sigla: "EOA (AOD)",
    fullName: "Espesor Óptico Aerosoles 500nm",
    unit: "τ",
    icon: <Wind size={15} />,
    color: "#f97316",
    getValue: (r) => (r.aod_bands ? (r.aod_bands["500"] ?? null) : null),
    format: (v) => (v >= 0 ? v.toFixed(3) : "N/D"),
  },
  {
    id: "sza",
    sigla: "ACS (SZA)",
    fullName: "Ángulo Cenital Solar",
    unit: "°",
    icon: <Compass size={15} />,
    color: "#ec4899",
    getValue: (r) => r.solar_geometry?.sza ?? null,
    format: (v) => v.toFixed(2),
  },
  {
    id: "air-mass",
    sigla: "MA (AM)",
    fullName: "Masa de Aire Óptica Relativa",
    unit: "AM",
    icon: <Mountain size={15} />,
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
  <div style={styles.card} title={metric.fullName + ' (' + metric.unit + ')'}>
    <div style={styles.cardHeader}>
      <span style={{ ...styles.cardIcon, color: metric.color }}>{metric.icon}</span>
      <span style={styles.cardSigla}>{metric.sigla}</span>
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
            color: value !== null && value >= 0 ? "#ffffff" : "#555555",
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
      <div style={styles.grid}>
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
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    gap: 8,
    height: "100%",
    width: "100%",
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  cardIcon: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  cardSigla: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardFullName: {
    color: "#888888",
    fontSize: 10,
    fontWeight: 400,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: 2,
  },
  valueContainer: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 4,
    marginTop: "auto",
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardUnit: {
    color: "#888888",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 500,
    flexShrink: 0,
  },
  skeletonContainer: {
    display: "flex",
    alignItems: "center",
    height: 20,
    marginTop: "auto",
  },
  skeletonValue: {
    width: "60%",
    height: 14,
    backgroundColor: "#333333",
    borderRadius: 2,
  },
};

export default MetricsSummary;
