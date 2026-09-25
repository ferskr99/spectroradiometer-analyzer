import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { Calendar, Activity, Zap } from 'lucide-react';
import { apiClient } from '../../infrastructure/api/api_client';

export const TimeSeriesView: React.FC = () => {
  // Default to today
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  const [startDate, setStartDate] = useState(startOfDay.substring(0, 10)); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(endOfDay.substring(0, 10)); // YYYY-MM-DD

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', 'timeseries', startDate, endDate],
    queryFn: () => {
      const isoStart = new Date(`${startDate}T00:00:00`).toISOString();
      const isoEnd = new Date(`${endDate}T23:59:59`).toISOString();
      return apiClient.getHistoryTimeSeries(isoStart, isoEnd);
    },
  });

  const chartData = data?.points?.map(p => ({
    ...p,
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })) || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Evolución Temporal</h1>
          <p style={styles.subtitle}>Análisis de series de tiempo e irradiación acumulada diaria</p>
        </div>

        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <Calendar size={16} color="#888" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />
            <span style={{color: '#666'}}>hasta</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <Zap size={18} color="#eab308" />
            <span style={styles.metricTitle}>Irradiación Total Acumulada</span>
          </div>
          <div style={styles.metricValueContainer}>
            <span style={styles.metricValue}>
              {data?.total_irradiation_mj ? data.total_irradiation_mj.toFixed(2) : "0.00"}
            </span>
            <span style={styles.metricUnit}>MJ/m²</span>
          </div>
          <p style={styles.metricDesc}>Energía solar total recibida en el periodo seleccionado calculada mediante la integral matemática (Regla del Trapecio).</p>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <Activity size={18} color="#3b82f6" />
            <span style={styles.metricTitle}>Puntos de Datos</span>
          </div>
          <div style={styles.metricValueContainer}>
            <span style={styles.metricValue}>
              {chartData.length}
            </span>
            <span style={styles.metricUnit}>muestras</span>
          </div>
          <p style={styles.metricDesc}>Total de mediciones espectrales adquiridas y procesadas en el periodo seleccionado.</p>
        </div>
      </div>

      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Curva de Irradiancia y PAR (Evolución Diaria)</h3>
        
        {isLoading ? (
          <div style={styles.emptyState}>Cargando evolución temporal...</div>
        ) : isError ? (
          <div style={styles.emptyState}>Error al cargar los datos. Verifique las fechas.</div>
        ) : chartData.length === 0 ? (
          <div style={styles.emptyState}>No hay mediciones registradas en este rango de fechas.</div>
        ) : (
          <div style={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  label={{ value: "Irradiancia (W/m²)", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12, dy: 60 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#666" 
                  tick={{ fill: "#666", fontSize: 11 }}
                  label={{ value: "PAR (W/m²)", angle: 90, position: "insideRight", fill: "#888", fontSize: 12, dy: -40 }}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: "#111", borderColor: "#333", borderRadius: 8 }}
                  itemStyle={{ fontSize: 12 }}
                  labelStyle={{ color: "#aaa", fontWeight: "bold", marginBottom: 8 }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
                
                <Line 
                  yAxisId="left"
                  type="linear" 
                  dataKey="total_irradiance" 
                  name="Irradiancia Total" 
                  stroke="#eab308" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  yAxisId="right"
                  type="linear" 
                  dataKey="par" 
                  name="Radiación PAR" 
                  stroke="#22c55e" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    height: "100%",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid #222",
    paddingBottom: 20,
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: 24,
    fontWeight: 700,
    color: "#f8f9fa",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#888",
  },
  filters: {
    display: "flex",
    gap: 16,
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161616",
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #333",
  },
  dateInput: {
    backgroundColor: "transparent",
    border: "none",
    color: "#e0e0e0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  metricCard: {
    backgroundColor: "#161616",
    borderRadius: 12,
    border: "1px solid #333",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e0e0e0",
  },
  metricValueContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  metricValue: {
    fontSize: 36,
    fontWeight: 800,
    color: "#ffffff",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "-0.02em",
  },
  metricUnit: {
    fontSize: 16,
    color: "#888",
    fontWeight: 500,
  },
  metricDesc: {
    margin: 0,
    fontSize: 12,
    color: "#666",
    lineHeight: 1.5,
  },
  chartCard: {
    backgroundColor: "#161616",
    borderRadius: 12,
    border: "1px solid #333",
    padding: 24,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 400,
  },
  chartTitle: {
    margin: "0 0 20px 0",
    fontSize: 16,
    fontWeight: 600,
    color: "#e0e0e0",
  },
  chartWrapper: {
    flex: 1,
    minHeight: 0,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    fontSize: 14,
    border: "1px dashed #333",
    borderRadius: 8,
  }
};
