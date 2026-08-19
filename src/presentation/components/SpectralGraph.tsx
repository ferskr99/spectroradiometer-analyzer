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
import { Loader2, Activity } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface SpectralGraphProps {
  data: SpectralData | null;
  isLoading: boolean;
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio
// ─────────────────────────────────────────────────────────────────────

const PAR_START = 400;
const PAR_END = 700;

const GRADIENT_STOPS = [
  { offset: "0%", color: "#7c3aed" },     // UV
  { offset: "15%", color: "#3b82f6" },    // Azul
  { offset: "30%", color: "#10b981" },    // Verde
  { offset: "40%", color: "#eab308" },    // Amarillo
  { offset: "50%", color: "#ef4444" },    // Rojo
  { offset: "65%", color: "#991b1b" },    // NIR cercano
  { offset: "100%", color: "#451a03" },   // NIR lejano
] as const;

// ─────────────────────────────────────────────────────────────────────
// Subcomponentes internos
// ─────────────────────────────────────────────────────────────────────

const LoadingOverlay: React.FC = () => (
  <div style={styles.loadingOverlay}>
    <div style={styles.spinnerContainer}>
      <Loader2 size={32} className="spin-icon" color="#888888" />
      <p style={styles.loadingText}>Adquiriendo Espectro</p>
    </div>
    <style>{`.spin-icon { animation: spin 1s linear infinite; }`}</style>
  </div>
);

const EmptyState: React.FC<{ height: number }> = ({ height }) => (
  <div style={{ ...styles.emptyState, height }}>
    <Activity size={32} color="#333333" />
    <p style={styles.emptyTitle}>Sin datos espectrales</p>
  </div>
);

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string | number;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const wavelength = Number(label);
  const irradiance = payload[0].value as number;

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

export const SpectralGraph: React.FC<SpectralGraphProps> = ({
  data,
  isLoading,
  height = 420,
}) => {
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

  if (!data && !isLoading) {
    return <EmptyState height={height} />;
  }

  return (
    <div style={{ ...styles.container, height }}>
      <div style={styles.header}>
        <h3 style={styles.title}>Distribución de Energía Espectral</h3>
        {data && (
          <span style={styles.meta}>
            Δλ = 1 nm
          </span>
        )}
      </div>

      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={height - 60}>
          <AreaChart
            data={chartData}
            margin={{ top: 25, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="spectralGradient" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map((stop) => (
                  <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={0.9} />
                ))}
              </linearGradient>
              <linearGradient id="spectralFill" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map((stop) => (
                  <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={0.1} />
                ))}
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#222222" />

            <XAxis
              dataKey="wavelength"
              type="number"
              domain={[300, 1700]}
              tickCount={15}
              tick={{ fill: "#666666", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "#333333" }}
              label={{
                value: "Longitud de onda (nm)",
                position: "insideBottom",
                offset: -10,
                style: { fill: "#888888", fontSize: 11, fontWeight: 500, textTransform: "uppercase" },
              }}
            />

            <YAxis
              tick={{ fill: "#666666", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "#333333" }}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
              label={{
                value: "Irradiancia (W/m²/µm)",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                style: { fill: "#888888", fontSize: 11, fontWeight: 500, textTransform: "uppercase" },
              }}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444', strokeWidth: 1, strokeDasharray: '4 4' }} />

            <ReferenceLine
              x={PAR_START}
              stroke="#666666"
              strokeDasharray="4 4"
              label={{ value: "PAR", position: "top", fill: "#888888", fontSize: 9 }}
            />
            <ReferenceLine
              x={PAR_END}
              stroke="#666666"
              strokeDasharray="4 4"
              label={{ value: "Fin PAR", position: "top", fill: "#888888", fontSize: 9 }}
            />

            <Area
              type="monotone"
              dataKey="irradiance"
              stroke="url(#spectralGradient)"
              fill="url(#spectralFill)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "#e0e0e0", stroke: "#111111", strokeWidth: 2 }}
              isAnimationActive={!isLoading}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>

        {isLoading && <LoadingOverlay />}
      </div>

      <div style={styles.legend}>
        <LegendItem color="#7c3aed" label="UV" />
        <LegendItem color="#10b981" label="VIS / PAR" />
        <LegendItem color="#991b1b" label="NIR" />
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={styles.legendItem}>
    <div style={{ ...styles.legendDot, backgroundColor: color }} />
    <span style={styles.legendLabel}>{label}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    backgroundColor: "#161616",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    padding: "16px 16px 8px",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
    paddingLeft: 4,
  },
  title: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: 0,
  },
  meta: {
    color: "#666666",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
  },
  chartWrapper: {
    position: "relative",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22, 22, 22, 0.7)",
    backdropFilter: "blur(2px)",
    zIndex: 10,
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161616",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    gap: 8,
  },
  emptyTitle: {
    color: "#666666",
    fontSize: 12,
    fontWeight: 500,
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tooltip: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "8px 12px",
  },
  tooltipTitle: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 500,
    margin: "0 0 4px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tooltipRegion: {
    fontSize: 9,
    color: "#888",
    backgroundColor: "#222",
    padding: "2px 4px",
    borderRadius: 2,
  },
  tooltipValue: {
    color: "#e0e0e0",
    fontSize: 12,
    margin: 0,
    fontFamily: "'JetBrains Mono', monospace",
  },
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
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  legendLabel: {
    color: "#666666",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};

export default SpectralGraph;
