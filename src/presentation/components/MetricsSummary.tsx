import React, { useMemo } from "react";
import type { AnalysisRequest } from "../../infrastructure/api";
import { Sun, Leaf, Lightbulb, Zap } from "lucide-react";
import type { AnalysisResult } from "../../infrastructure/api";

// ─────────────────────────────────────────────────────────────────────
// Definición de métricas
// ─────────────────────────────────────────────────────────────────────

interface MetricDefinition {
  id: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  getValue: (result: AnalysisResult) => number;
  format: (value: number) => string;
  description: string;
}

const METRICS: MetricDefinition[] = [
  {
    id: "par",
    label: "PAR",
    unit: "W/m²",
    icon: <Sun size={14} />,
    color: "#eab308",
    getValue: (r) => r.par,
    format: (v) => v.toFixed(4),
    description: "Radiación Fotosintéticamente Activa (400–700 nm)",
  },
  {
    id: "ppfd",
    label: "PPFD",
    unit: "µmol/m²/s",
    icon: <Leaf size={14} />,
    color: "#10b981",
    getValue: (r) => r.ppfd,
    format: (v) => v.toFixed(4),
    description: "Densidad de Flujo de Fotones",
  },
  {
    id: "illuminance",
    label: "Iluminancia",
    unit: "lx",
    icon: <Lightbulb size={14} />,
    color: "#3b82f6",
    getValue: (r) => r.illuminance,
    format: (v) =>
      v >= 1000 ? `${(v / 1000).toFixed(2)}k` : v.toFixed(2),
    description: "Ponderación fotópica CIE 1931",
  },
  {
    id: "total-irradiance",
    label: "Irradiancia Total",
    unit: "W/m²",
    icon: <Zap size={14} />,
    color: "#a855f7",
    getValue: (r) => r.total_irradiance,
    format: (v) => v.toFixed(4),
    description: "Integral rango completo",
  },
];

export interface MetricsSummaryProps {
  data: AnalysisResult | null;
  isLoading: boolean;
}

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({
  data,
  isLoading,
}) => {
  const computedValues = useMemo(() => {
    if (!data) return null;
    return METRICS.map((m) => ({
      id: m.id,
      value: m.getValue(data),
    }));
  }, [data]);

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>Lecturas Radiométricas</h3>
      <div style={styles.grid}>
        {METRICS.map((metric) => {
          const computed = computedValues?.find((c) => c.id === metric.id);

          return (
            <div
              key={metric.id}
              style={{
                ...styles.card,
                borderColor: isLoading ? "#2a2a2a" : "#333333",
              }}
            >
              <div style={styles.cardHeader}>
                <span style={{...styles.cardIcon, color: metric.color}}>{metric.icon}</span>
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
                      color: computed && computed.value > 0 ? "#e0e0e0" : "#555555",
                    }}
                  >
                    {computed ? metric.format(computed.value) : "—"}
                  </span>
                  <span style={styles.cardUnit}>{metric.unit}</span>
                </div>
              )}

              <p style={styles.cardDescription}>{metric.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  sectionTitle: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 12px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 24,
  },
  card: {
    backgroundColor: "#161616",
    borderRadius: 4,
    border: "1px solid",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  cardIcon: {
    display: "flex",
    alignItems: "center",
  },
  cardLabel: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  valueContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 500,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1,
  },
  cardUnit: {
    color: "#666666",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  cardDescription: {
    color: "#666666",
    fontSize: 10,
    margin: 0,
    lineHeight: 1.3,
  },
  skeletonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 6,
    height: 22,
    justifyContent: "center",
  },
  skeletonValue: {
    width: "60%",
    height: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 2,
  },
};

export default MetricsSummary;
