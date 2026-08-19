/**
 * SpectralGraph.tsx
 *
 * Componente de visualización del espectro electromagnético fusionado.
 * Renderiza la irradiancia espectral (W/m²/µm) vs. longitud de onda (nm)
 * para el rango combinado de los sensores MS-711 (300nm) y MS-712 (1700nm).
 *
 * Diseñado para recibir datos interpolados a intervalos exactos de 1nm
 * provenientes de SpectralProcessorUseCase.merge_and_interpolate().
 */

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SpectralData } from "../../infrastructure/api";

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface SpectralGraphProps {
  /** Datos espectrales interpolados a 1nm (wavelengths + irradiance). */
  data: SpectralData | null;
  /**
   * `true` mientras el espectrorradiómetro está procesando la medición.
   * Muestra un estado de carga animado sobre el gráfico.
   */
  isLoading: boolean;
  /** Altura del contenedor en píxeles (por defecto 420). */
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio — regiones espectrales de referencia
// ─────────────────────────────────────────────────────────────────────

/** Límites del rango PAR (Photosynthetically Active Radiation). */
const PAR_START = 400;
const PAR_END = 700;

/** Límites del rango fotópico (visibilidad humana, CIE 1931). */
const PHOTOPIC_START = 380;
const PHOTOPIC_END = 780;

/** Colores del gradiente espectral (UV → VIS → NIR). */
const GRADIENT_STOPS = [
  { offset: "0%", color: "#7c3aed" },     // UV  (300nm)  — violeta
  { offset: "15%", color: "#3b82f6" },    // Azul (400nm)
  { offset: "30%", color: "#10b981" },    // Verde (500nm)
  { offset: "40%", color: "#f59e0b" },    // Amarillo (580nm)
  { offset: "50%", color: "#ef4444" },    // Rojo (650nm)
  { offset: "65%", color: "#991b1b" },    // NIR cercano (800nm)
  { offset: "100%", color: "#451a03" },   // NIR lejano (1700nm)
] as const;

// ─────────────────────────────────────────────────────────────────────
// Subcomponentes internos
// ─────────────────────────────────────────────────────────────────────

/** Spinner de carga con animación de pulso. */
const LoadingOverlay: React.FC = () => (
  <div style={styles.loadingOverlay}>
    <div style={styles.spinnerContainer}>
      <div style={styles.spinner} />
      <p style={styles.loadingText}>
        Adquiriendo espectro...
      </p>
      <p style={styles.loadingSubtext}>
        Esperando respuesta del obturador (hasta 5s)
      </p>
    </div>
  </div>
);

/** Estado vacío cuando no hay datos. */
const EmptyState: React.FC<{ height: number }> = ({ height }) => (
  <div style={{ ...styles.emptyState, height }}>
    <div style={styles.emptyIcon}>📡</div>
    <p style={styles.emptyTitle}>Sin datos espectrales</p>
    <p style={styles.emptySubtitle}>
      Inicia un análisis para visualizar el espectro fusionado
    </p>
  </div>
);

/** Tooltip personalizado con unidades físicas. */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string | number;
}> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const wavelength = Number(label);
  const irradiance = payload[0].value as number;

  // Determinar la región espectral
  let region = "NIR";
  if (wavelength < 400) region = "UV";
  else if (wavelength < 700) region = "VIS";
  else if (wavelength < 780) region = "VIS/NIR";

  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipTitle}>
        λ = {wavelength.toFixed(0)} nm
        <span style={styles.tooltipRegion}>{region}</span>
      </p>
      <p style={styles.tooltipValue}>
        E(λ) = {irradiance.toFixed(3)} W/m²/µm
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

/**
 * Gráfico de irradiancia espectral.
 *
 * Renderiza un AreaChart con:
 * - Eje X: Longitud de onda (nm), rango 300–1700nm
 * - Eje Y: Irradiancia espectral (W/m²/µm)
 * - Gradiente UV→VIS→NIR para representación visual del espectro
 * - Líneas de referencia en los límites PAR (400, 700nm)
 * - Overlay de carga animado para la latencia del hardware
 *
 * @example
 * ```tsx
 * <SpectralGraph
 *   data={analysisResult.merged_spectrum}
 *   isLoading={isPending}
 *   height={500}
 * />
 * ```
 */
export const SpectralGraph: React.FC<SpectralGraphProps> = ({
  data,
  isLoading,
  height = 420,
}) => {
  // Transformar arrays paralelos a formato de Recharts [{wl, ir}, ...]
  // Aplicar downsampling a cada 2nm para rendimiento (de ~1400 a ~700 puntos)
  const chartData = useMemo(() => {
    if (!data) return [];

    const points: Array<{ wavelength: number; irradiance: number }> = [];
    for (let i = 0; i < data.wavelengths.length; i += 2) {
      points.push({
        wavelength: data.wavelengths[i],
        irradiance: data.irradiance[i],
      });
    }
    return points;
  }, [data]);

  // Sin datos y sin carga → estado vacío
  if (!data && !isLoading) {
    return <EmptyState height={height} />;
  }

  return (
    <div style={{ ...styles.container, height }}>
      {/* Header con metadatos */}
      <div style={styles.header}>
        <h3 style={styles.title}>Espectro de Irradiancia</h3>
        {data && (
          <span style={styles.meta}>
            {data.wavelengths.length} puntos · {data.wavelengths[0]}–
            {data.wavelengths[data.wavelengths.length - 1]} nm · Δλ = 1 nm
          </span>
        )}
      </div>

      {/* Gráfico */}
      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={height - 60}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            {/* Definición del gradiente espectral */}
            <defs>
              <linearGradient id="spectralGradient" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map((stop) => (
                  <stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={0.8}
                  />
                ))}
              </linearGradient>
              <linearGradient id="spectralFill" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map((stop) => (
                  <stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={0.15}
                  />
                ))}
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.15)"
            />

            {/* Eje X — Longitud de onda (nm) */}
            <XAxis
              dataKey="wavelength"
              type="number"
              domain={[300, 1700]}
              tickCount={15}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              label={{
                value: "Wavelength (nm)",
                position: "insideBottom",
                offset: -10,
                style: { fill: "#cbd5e1", fontSize: 13, fontWeight: 500 },
              }}
            />

            {/* Eje Y — Irradiancia espectral */}
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
              label={{
                value: "Irradiance (W/m²/µm)",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                style: { fill: "#cbd5e1", fontSize: 13, fontWeight: 500 },
              }}
            />

            {/* Tooltip personalizado */}
            <Tooltip content={<CustomTooltip />} />

            {/* Líneas de referencia PAR */}
            <ReferenceLine
              x={PAR_START}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "PAR 400nm",
                position: "top",
                fill: "#60a5fa",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              x={PAR_END}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "PAR 700nm",
                position: "top",
                fill: "#f87171",
                fontSize: 10,
              }}
            />

            {/* Área del espectro con gradiente */}
            <Area
              type="monotone"
              dataKey="irradiance"
              stroke="url(#spectralGradient)"
              fill="url(#spectralFill)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 4,
                fill: "#f8fafc",
                stroke: "#3b82f6",
                strokeWidth: 2,
              }}
              isAnimationActive={!isLoading}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Overlay de carga sobre el gráfico */}
        {isLoading && <LoadingOverlay />}
      </div>

      {/* Leyenda de regiones */}
      <div style={styles.legend}>
        <LegendItem color="#7c3aed" label="UV (300–400nm)" />
        <LegendItem color="#10b981" label="VIS / PAR (400–700nm)" />
        <LegendItem color="#991b1b" label="NIR (700–1700nm)" />
      </div>
    </div>
  );
};

/** Item de leyenda individual. */
const LegendItem: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => (
  <div style={styles.legendItem}>
    <div style={{ ...styles.legendDot, backgroundColor: color }} />
    <span style={styles.legendLabel}>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// Estilos (CSS-in-JS para portabilidad del componente)
// ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    border: "1px solid rgba(51, 65, 85, 0.5)",
    padding: "16px 16px 8px",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
    paddingLeft: 4,
  },
  title: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  meta: {
    color: "#64748b",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  chartWrapper: {
    position: "relative",
  },

  // Loading overlay
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(4px)",
    borderRadius: 8,
    zIndex: 10,
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(59, 130, 246, 0.2)",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 500,
    margin: 0,
  },
  loadingSubtext: {
    color: "#64748b",
    fontSize: 12,
    margin: 0,
  },

  // Empty state
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    border: "1px dashed rgba(51, 65, 85, 0.6)",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.6,
  },
  emptyTitle: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: 500,
    margin: 0,
  },
  emptySubtitle: {
    color: "#475569",
    fontSize: 13,
    margin: 0,
  },

  // Tooltip
  tooltip: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 14px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
  },
  tooltipTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 600,
    margin: "0 0 4px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tooltipRegion: {
    fontSize: 10,
    color: "#94a3b8",
    backgroundColor: "#334155",
    padding: "1px 6px",
    borderRadius: 4,
    fontWeight: 400,
  },
  tooltipValue: {
    color: "#38bdf8",
    fontSize: 13,
    margin: 0,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },

  // Legend
  legend: {
    display: "flex",
    justifyContent: "center",
    gap: 20,
    paddingTop: 4,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  legendLabel: {
    color: "#94a3b8",
    fontSize: 11,
  },
};

export default SpectralGraph;
