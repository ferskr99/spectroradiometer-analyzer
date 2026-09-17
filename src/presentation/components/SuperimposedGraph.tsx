import React, { useMemo, useState } from "react";
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
import { Activity, Maximize2, Loader2 } from "lucide-react";
import { ExpandedGraphModal } from "./ExpandedGraphModal";

export interface SuperimposedGraphProps {
  dataDict: Record<string, AnalysisResult>;
  isLoading: boolean;
  height?: number;
}

const PAR_START = 400;
const PAR_END = 700;

const COLOR_TABLE = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#d946ef", "#f43f5e", "#fbbf24", "#a3e635", "#34d399",
  "#2dd4bf", "#38bdf8", "#818cf8", "#a78bfa", "#e879f9",
  "#fb7185", "#fca5a5", "#fdba74", "#bef264", "#6ee7b7",
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
  let region = "IOC (Infrarrojo de Onda Corta)";
  if (wavelength < 400) region = "UV (Ultravioleta)";
  else if (wavelength <= 700) region = "Visible / RFA";
  else if (wavelength <= 1100) region = "IRC (Infrarrojo Cercano)";

  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipTitle}>
        λ = {wavelength.toFixed(0)} nm
        <span style={styles.tooltipRegion}>{region}</span>
      </p>
      <div style={{ maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
        {payload.map((entry) => (
          <p key={entry.name} style={{ ...styles.tooltipValue, color: entry.color }}>
            ID #{entry.name}: {Number(entry.value).toFixed(3)} W/m²/µm
          </p>
        ))}
      </div>
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

    const baseWavelengths = firstItem.merged_spectrum.wavelengths;
    const points: any[] = [];

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

  const [isModalOpen, setIsModalOpen] = useState(false);

  const dynamicYMax = useMemo(() => {
    if (chartData.length === 0) return 10;
    
    let globalMax = 0;
    chartData.forEach(point => {
      dataKeys.forEach(key => {
        if (point[key] && point[key] > globalMax) {
          globalMax = point[key];
        }
      });
    });
    
    return globalMax === 0 ? 10 : Math.ceil(globalMax * 1.05);
  }, [chartData, dataKeys]);

  if (dataKeys.length === 0 && !isLoading) {
    return <EmptyState height={height} />;
  }

  return (
    <>
      <div style={{ ...styles.container, height }}>
        <div style={styles.header}>
          <h3 style={styles.title}>Superposición Histórica</h3>
          <div style={styles.actions}>
            <button 
              style={styles.actionBtn} 
              onClick={() => setIsModalOpen(true)}
              title="Expandir gráfico"
            >
              <Maximize2 size={16} color="#888888" />
            </button>
          </div>
        </div>

        <div style={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={height - 110}>
            <LineChart
              data={chartData}
              margin={{ top: 25, right: 30, left: 20, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />

              <XAxis
                dataKey="wavelength"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDataOverflow={true}
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
                domain={[0, dynamicYMax]}
                allowDataOverflow={true}
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
                label={{ value: "Inicio RFA", position: "top", fill: "#888888", fontSize: 9 }}
              />
              <ReferenceLine
                x={PAR_END}
                stroke="#666666"
                strokeDasharray="4 4"
                label={{ value: "Fin RFA", position: "top", fill: "#888888", fontSize: 9 }}
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

        <div style={{ ...styles.legend, overflowY: dataKeys.length > 20 ? "auto" : "visible", maxHeight: 80 }}>
          {dataKeys.map((key, index) => (
            <LegendItem key={key} color={COLOR_TABLE[index % COLOR_TABLE.length]} label={`#${key}`} />
          ))}
        </div>
      </div>

      <ExpandedGraphModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={chartData}
        lines={dataKeys.map((key, index) => ({
          key: key,
          name: `#${key}`,
          color: COLOR_TABLE[index % COLOR_TABLE.length]
        }))}
        title="Superposición Histórica"
      />
    </>
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
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    padding: "16px 16px 8px",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
    paddingBottom: 16,
    borderBottom: "1px solid #333333",
  },
  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  chartWrapper: {
    position: "relative",
    width: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    zIndex: 10,
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#cccccc",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    margin: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    gap: 8,
  },
  emptyTitle: {
    color: "#888888",
    fontSize: 12,
    fontWeight: 500,
    margin: 0,
    textTransform: "uppercase",
  },
  tooltip: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "8px 12px",
  },
  tooltipTitle: {
    color: "#cccccc",
    fontSize: 11,
    fontWeight: 600,
    margin: "0 0 4px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tooltipRegion: {
    fontSize: 9,
    color: "#ffffff",
    backgroundColor: "#333333",
    padding: "2px 4px",
    borderRadius: 2,
  },
  tooltipValue: {
    fontSize: 12,
    margin: "2px 0",
    fontFamily: "'JetBrains Mono', monospace",
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
    paddingTop: 8,
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
    color: "#888888",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

export default SuperimposedGraph;
