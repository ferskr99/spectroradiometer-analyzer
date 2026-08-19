/**
 * MetricsSummary.tsx
 *
 * Panel de métricas científicas (KPI Cards) para los resultados
 * del análisis espectral. Muestra PAR, PPFD, Iluminancia e
 * Irradiancia Total con estados de esqueleto durante la carga.
 */

import React, { useMemo } from "react";
import type { AnalysisResult, SpectralData } from "../../infrastructure/api";

// ─────────────────────────────────────────────────────────────────────
// Helpers de cálculo client-side
// ─────────────────────────────────────────────────────────────────────

/**
 * Integración trapezoidal sobre un rango de longitud de onda.
 * Los datos deben estar a intervalos de 1nm para máxima precisión.
 */
function integrateRange(
  spectrum: SpectralData,
  startNm: number,
  endNm: number,
): number {
  const { wavelengths, irradiance } = spectrum;
  let sum = 0;
  for (let i = 0; i < wavelengths.length - 1; i++) {
    const wl = wavelengths[i];
    const wlNext = wavelengths[i + 1];
    if (wl >= startNm && wlNext <= endNm) {
      // Regla del trapecio: (f(a) + f(b)) / 2 × Δx
      // Con Δx = 1nm y E(λ) en W/m²/µm → resultado en W/m²/µm·nm
      // Factor ×1e-3 convierte nm → µm para obtener W/m²
      sum += (irradiance[i] + irradiance[i + 1]) * 0.5 * (wlNext - wl);
    }
  }
  // Convertir de W/m²/µm · nm a W/m²  (1nm = 1e-3 µm)
  return sum * 1e-3;
}

// ─────────────────────────────────────────────────────────────────────
// Definición de métricas
// ─────────────────────────────────────────────────────────────────────

interface MetricDefinition {
  id: string;
  label: string;
  unit: string;
  icon: string;
  color: string;
  glowColor: string;
  getValue: (result: AnalysisResult) => number;
  format: (value: number) => string;
  description: string;
}

const METRICS: MetricDefinition[] = [
  {
    id: "par",
    label: "PAR",
    unit: "W/m²",
    icon: "☀️",
    color: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.15)",
    getValue: (r) =>
      r.merged_spectrum ? integrateRange(r.merged_spectrum, 400, 700) : 0,
    format: (v) => v.toFixed(2),
    description: "Radiación Fotosintéticamente Activa (400–700 nm)",
  },
  {
    id: "ppfd",
    label: "PPFD",
    unit: "µmol/m²/s",
    icon: "🌱",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.15)",
    getValue: (r) => r.ppfd,
    format: (v) => v.toFixed(4),
    description: "Densidad de Flujo de Fotones Fotosintéticos",
  },
  {
    id: "illuminance",
    label: "Iluminancia",
    unit: "lx",
    icon: "💡",
    color: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.15)",
    getValue: (r) => r.illuminance,
    format: (v) =>
      v >= 1000 ? `${(v / 1000).toFixed(2)}k` : v.toFixed(2),
    description: "Ponderación fotópica CIE 1931 (380–780 nm)",
  },
  {
    id: "total-irradiance",
    label: "Irradiancia Total",
    unit: "W/m²",
    icon: "⚡",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.15)",
    getValue: (r) =>
      r.merged_spectrum
        ? integrateRange(
            r.merged_spectrum,
            r.merged_spectrum.wavelengths[0],
            r.merged_spectrum.wavelengths[r.merged_spectrum.wavelengths.length - 1],
          )
        : 0,
    format: (v) => v.toFixed(2),
    description: "Integral sobre el rango completo fusionado",
  },
];

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface MetricsSummaryProps {
  /** Resultado del análisis espectral. `null` si no hay datos aún. */
  data: AnalysisResult | null;
  /** `true` mientras el hardware está procesando (muestra skeletons). */
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({
  data,
  isLoading,
}) => {
  // Pre-calcular valores para evitar re-computar en cada render
  const computedValues = useMemo(() => {
    if (!data) return null;
    return METRICS.map((m) => ({
      id: m.id,
      value: m.getValue(data),
    }));
  }, [data]);

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>Métricas Radiométricas</h3>
      <div style={styles.grid}>
        {METRICS.map((metric, idx) => {
          const computed = computedValues?.find((c) => c.id === metric.id);

          return (
            <div
              key={metric.id}
              style={{
                ...styles.card,
                borderColor: isLoading ? "#1e293b" : `${metric.color}33`,
                backgroundColor: isLoading ? "#0f172a" : metric.glowColor,
              }}
            >
              {/* Indicador de color superior */}
              <div
                style={{
                  ...styles.cardAccent,
                  backgroundColor: isLoading ? "#1e293b" : metric.color,
                }}
              />

              <div style={styles.cardContent}>
                {/* Icono y label */}
                <div style={styles.cardHeader}>
                  <span style={styles.cardIcon}>{metric.icon}</span>
                  <span style={styles.cardLabel}>{metric.label}</span>
                </div>

                {/* Valor principal */}
                {isLoading ? (
                  <div style={styles.skeletonContainer}>
                    <div
                      style={{
                        ...styles.skeletonValue,
                        animationDelay: `${idx * 150}ms`,
                      }}
                    />
                    <div
                      style={{
                        ...styles.skeletonUnit,
                        animationDelay: `${idx * 150 + 100}ms`,
                      }}
                    />
                  </div>
                ) : (
                  <div style={styles.valueContainer}>
                    <span
                      style={{
                        ...styles.cardValue,
                        color: computed && computed.value > 0
                          ? metric.color
                          : "#475569",
                      }}
                    >
                      {computed ? metric.format(computed.value) : "—"}
                    </span>
                    <span style={styles.cardUnit}>{metric.unit}</span>
                  </div>
                )}

                {/* Descripción */}
                <p style={styles.cardDescription}>{metric.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  sectionTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 12px 4px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  card: {
    position: "relative",
    borderRadius: 10,
    border: "1px solid",
    overflow: "hidden",
    transition: "all 0.3s ease",
  },
  cardAccent: {
    height: 3,
    width: "100%",
    transition: "background-color 0.3s ease",
  },
  cardContent: {
    padding: "12px 14px 14px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  // Valor
  valueContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: 1,
    transition: "color 0.3s ease",
  },
  cardUnit: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 400,
  },
  cardDescription: {
    color: "#475569",
    fontSize: 11,
    margin: 0,
    lineHeight: 1.3,
  },

  // Skeletons
  skeletonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 6,
  },
  skeletonValue: {
    width: "70%",
    height: 28,
    borderRadius: 6,
    background:
      "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  },
  skeletonUnit: {
    width: "40%",
    height: 14,
    borderRadius: 4,
    background:
      "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  },
};

export default MetricsSummary;
