import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { AnalysisResult } from "../../infrastructure/api/api_client";
import { Loader2, Activity } from "lucide-react";

export interface SuperimposedGraphProps {
  dataDict: Record<string, AnalysisResult>;
  isLoading: boolean;
  height?: number;
}

const PAR_START = 400;
const PAR_END = 700;

// Paleta de 10 colores estándar para superposición (según manual EKO)
const COLOR_TABLE = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#84cc16", // Yellow Green
  "#22c55e", // Green
  "#10b981", // Light Green
  "#06b6d4", // Light Blue
  "#3b82f6", // Blue
  "#312e81", // Navy
  "#8b5cf6", // Purple
];

const LoadingOverlay: React.FC = () => (
  <div style={styles.loadingOverlay}>
    <div style={styles.spinnerContainer}>
      <Loader2 size={32} className="spin-icon" color="#888888" />
      <p style={styles.loadingText}>Adquiriendo Espectros...</p>
    </div>
    <style>{`.spin-icon { animation: spin 1s linear infinite; }`}</style>
  </div>
);

const EmptyState: React.FC<{ height: number }> = ({ height }) => (
  <div style={{ ...styles.emptyState, height }}>
    <Activity size={32} color="#333333" />
    <p style={styles.emptyTitle}>Selecciona mediciones para comparar</p>
  </div>
);

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value?: number; name: string; color: string }>;
  label?: string | number;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const wavelength = Number(label);
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
      {payload.map((entry) => (
        <p key={entry.name} style={{ ...styles.tooltipValue, color: entry.color }}>
          ID #{entry.name}: {Number(entry.value).toFixed(3)} W/m²/µm
        </p>
      ))}
    </div>
  );
};

export const SuperimposedGraph: React.FC<SuperimposedGraphProps> = ({
  dataDict,
  isLoading,
  height = 420,
}) => {
  const { chartData, dataKeys } = useMemo(() => {
    const keys = Object.keys(dataDict);
    if (keys.length === 0) return { chartData: [], dataKeys: [] };

    const firstItem = dataDict[keys[0]];
    if (!firstItem || !firstItem.merged_spectrum) return { chartData: [], dataKeys: [] };

    // Asumimos que todos los espectros tienen las mismas longitudes de onda base 
    // (están interpolados a 1nm por defecto o usan el mismo grid del sensor)
    const baseWavelengths = firstItem.merged_spectrum.wavelengths;
    const points: any[] = [];

    // Para optimizar en Recharts, iteramos saltando de 2 en 2 si hay demasiados puntos
    for (let i = 0; i < baseWavelengths.length; i += 2) {
      const point: any = { wavelength: baseWavelengths[i] };
      keys.forEach((key) => {
        const item = dataDict[key];
        if (item && item.merged_spectrum) {
          point[key] = item.merged_spectrum.irradiance[i];
        }
      });
      points.push(point);
    }
    
    return { chartData: points, dataKeys: keys };
  }, [dataDict]);

  if (dataKeys.length === 0 && !isLoading) {
    return <EmptyState height={height} />;
  }

  return (
    <div style={{ ...styles.container, height }}>
      <div style={styles.header}>
        <h3 style={styles.title}>Superposición Espectral Múltiple</h3>
        {dataKeys.length > 0 && (
          <span style={styles.meta}>
            {dataKeys.length} mediciones seleccionadas
          </span>
        )}
      </div>

      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={height - 60}>
          <LineChart
            data={chartData}
            margin={{ top: 25, right: 30, left: 20, bottom: 20 }}
          >
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

            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={COLOR_TABLE[index % COLOR_TABLE.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={!isLoading}
                animationDuration={300}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {isLoading && <LoadingOverlay />}
      </div>

      <div style={styles.legend}>
        {dataKeys.map((key, index) => (
          <LegendItem key={key} color={COLOR_TABLE[index % COLOR_TABLE.length]} label={`#${key}`} />
        ))}
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
    textTransform: "uppercase",
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
    fontSize: 12,
    margin: 0,
    fontFamily: "'JetBrains Mono', monospace",
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
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
    color: "#e0e0e0",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

export default SuperimposedGraph;
