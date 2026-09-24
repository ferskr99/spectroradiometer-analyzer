import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalysisResult } from "../../infrastructure/api/api_client";
import { Activity } from "lucide-react";

export interface RawSensorsGraphProps {
  data: AnalysisResult | null;
  isLoading: boolean;
  height?: number | string;
}

const EmptyState: React.FC<{ height: number | string; title: string }> = ({ height, title }) => (
  <div style={{ ...styles.emptyState, height }}>
    <Activity size={32} color="#333333" />
    <p style={styles.emptyTitle}>{title}</p>
  </div>
);

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipTitle}>λ = {Number(label).toFixed(0)} nm</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ ...styles.tooltipValue, color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(3)} W/m²/µm
        </p>
      ))}
    </div>
  );
};

export const RawSensorsGraph: React.FC<RawSensorsGraphProps> = ({
  data,
  isLoading,
  height = 300,
}) => {
  const chartData711 = useMemo(() => {
    const g711 = data?.raw_spectra?.["MS-711_GLOBAL"];
    const d711 = data?.raw_spectra?.["MS-711_DIRECT"];
    if (!g711 && !d711) return [];
    const base = g711 || d711;
    if (!base) return [];
    const points: any[] = [];
    for (let i = 0; i < base.wavelengths.length; i += 2) {
      points.push({
        wavelength: base.wavelengths[i],
        global: g711 ? g711.irradiance[i] : null,
        direct: d711 ? d711.irradiance[i] : null,
      });
    }
    return points;
  }, [data]);

  const chartData713 = useMemo(() => {
    const g713 = data?.raw_spectra?.["MS-713_GLOBAL"];
    const d713 = data?.raw_spectra?.["MS-713_DIRECT"];
    if (!g713 && !d713) return [];
    const base = g713 || d713;
    if (!base) return [];
    const points: any[] = [];
    for (let i = 0; i < base.wavelengths.length; i += 2) {
      points.push({
        wavelength: base.wavelengths[i],
        global: g713 ? g713.irradiance[i] : null,
        direct: d713 ? d713.irradiance[i] : null,
      });
    }
    return points;
  }, [data]);

  if (isLoading) {
    return <EmptyState height="100%" title="Cargando datos crudos..." />;
  }

  if (!data?.raw_spectra) {
    return <EmptyState height="100%" title="No hay datos crudos disponibles" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      {/* Gráfica 711 */}
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>MS-711 (VIS-NIR) | Señales Crudas</h3>
        </div>
        <div style={styles.chartContainer}>
          {chartData711.length === 0 ? (
            <EmptyState height={height} title="Sin datos para MS-711" />
          ) : (
            <ResponsiveContainer width="100%" height={height as any}>
              <LineChart data={chartData711} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="wavelength" 
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  type="number"
                  domain={[300, 1100]}
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line type="linear" dataKey="global" name="711 Global" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                {chartData711[0]?.direct !== null && (
                  <Line type="linear" dataKey="direct" name="711 Directo" stroke="#fb923c" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfica 713 */}
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>MS-713 (SWIR) | Señales Crudas</h3>
        </div>
        <div style={styles.chartContainer}>
          {chartData713.length === 0 ? (
            <EmptyState height={height} title="Sin datos para MS-713" />
          ) : (
            <ResponsiveContainer width="100%" height={height as any}>
              <LineChart data={chartData713} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="wavelength" 
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  type="number"
                  domain={[900, 2500]}
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line type="linear" dataKey="global" name="713 Global" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                {chartData713[0]?.direct !== null && (
                  <Line type="linear" dataKey="direct" name="713 Directo" stroke="#ea580c" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: "#161616",
    borderRadius: 8,
    border: "1px solid #333333",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  header: {
    padding: "16px 20px 0 20px",
  },
  title: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "#e0e0e0",
    letterSpacing: "0.02em",
  },
  chartContainer: {
    padding: "0 20px 20px 0",
    flex: 1,
    minHeight: 0,
  },
  tooltip: {
    backgroundColor: "rgba(17, 17, 17, 0.95)",
    border: "1px solid #333333",
    padding: "12px 16px",
    borderRadius: 6,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(8px)",
  },
  tooltipTitle: {
    margin: "0 0 8px 0",
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: 600,
    borderBottom: "1px solid #333",
    paddingBottom: 6,
  },
  tooltipValue: {
    margin: "4px 0",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161616",
    borderRadius: 8,
    border: "1px dashed #333",
    width: "100%",
  },
  emptyTitle: {
    marginTop: 16,
    color: "#666666",
    fontSize: 13,
    fontWeight: 500,
  },
};
