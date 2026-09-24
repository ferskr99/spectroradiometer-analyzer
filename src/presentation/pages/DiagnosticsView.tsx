import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import { Activity, Thermometer, Zap, CheckCircle2, AlertCircle, Terminal, Info, Cpu, Radio, Shield } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from "recharts";

interface HealthData {
  time: string;
  ms711_temp: number;
  ms711_volt: number;
  ms713_temp: number;
  ms713_16v: number;
  ms713_5v: number;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: "info" | "warning" | "error";
}

export const DiagnosticsView: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<HealthData[]>([]);
  const initialTime = new Date().toLocaleTimeString("es-MX", { hour12: false });
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, time: initialTime, message: "Inicializando sistema de diagnóstico avanzado...", type: "info" },
    { id: 2, time: initialTime, message: "Conectando con el backend (simulado)...", type: "info" }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: "info" | "warning" | "error" = "info") => {
    const time = new Date().toLocaleTimeString("es-MX", { hour12: false });
    setLogs(prev => {
      const newLogs = [...prev, { id: Date.now() + Math.random(), time, message, type }];
      if (newLogs.length > 80) return newLogs.slice(newLogs.length - 80);
      return newLogs;
    });
  };

  useEffect(() => {
    const uptimeInterval = setInterval(() => setUptime(prev => prev + 1), 1000);
    return () => clearInterval(uptimeInterval);
  }, []);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiClient.getHealth();
        setHealth(data);
        setError(null);
        setSampleCount(prev => prev + 1);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString("es-MX", { hour12: false });

        setHistory(prev => {
          const newHistory = [...prev, {
            time: timeStr,
            ms711_temp: data.ms711?.sensor_temp_c ?? 0,
            ms711_volt: data.ms711?.supply_voltage_v ?? 0,
            ms713_temp: data.ms713?.peltier_temp_c ?? 0,
            ms713_16v: data.ms713?.supply_16v ?? 0,
            ms713_5v: data.ms713?.supply_5v ?? 0,
          }];
          return newHistory.length > 60 ? newHistory.slice(newHistory.length - 60) : newHistory;
        });

        if (data.ms713?.peltier_temp_c != null && data.ms713.peltier_temp_c > -4.5) {
          addLog(`Advertencia Térmica: Peltier MS-713 superó umbral (${data.ms713.peltier_temp_c.toFixed(1)}°C)`, "warning");
        }

      } catch (err: any) {
        const errMsg = err.message || "Error al conectar con los instrumentos";
        setError(errMsg);
        addLog(errMsg, "error");
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const globalStatus = !health ? "loading" : error ? "error" : (health.ms713?.peltier_temp_c != null && health.ms713.peltier_temp_c > -4.5 ? "warning" : "ok");

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const renderHistoryChart = (dataKey: string, color: string, label: string, unit: string, domain: [number | 'auto', number | 'auto']) => (
    <div style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <span style={styles.chartLabel}>{label}</span>
        <span style={styles.chartUnit}>{unit}</span>
      </div>
      <div style={styles.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
            <XAxis dataKey="time" hide />
            <YAxis domain={domain} hide />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
              labelStyle={{ color: "#888" }}
              formatter={(value: any) => [`${value?.toFixed(3)} ${unit}`, label]}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              fill={`url(#grad-${dataKey})`}
              dot={false}
              isAnimationActive={false} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const MetricTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    unit: string;
    color?: string;
    small?: boolean;
  }> = ({ icon, label, value, unit, color = "#e0e0e0", small }) => (
    <div style={small ? styles.metricTileSmall : styles.metricTile}>
      <div style={styles.tileIcon}>{icon}</div>
      <div style={styles.tileContent}>
        <span style={styles.tileLabel}>{label}</span>
        <div style={styles.tileValueRow}>
          <span style={{ ...styles.tileValue, color }}>{value}</span>
          <span style={styles.tileUnit}>{unit}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.iconBox}>
            <Activity size={22} color="#10b981" />
          </div>
          <div>
            <h2 style={styles.title}>Salud y Diagnóstico</h2>
            <p style={styles.subtitle}>Telemetría en tiempo real del hardware EKO WISER</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.headerStat}>
            <span style={styles.headerStatLabel}>Uptime</span>
            <span style={styles.headerStatValue}>{formatUptime(uptime)}</span>
          </div>
          <div style={styles.headerStat}>
            <span style={styles.headerStatLabel}>Muestras</span>
            <span style={styles.headerStatValue}>{sampleCount}</span>
          </div>
          <div style={{
            ...styles.statusBadge, 
            backgroundColor: globalStatus === 'ok' ? 'rgba(16, 185, 129, 0.1)' : globalStatus === 'warning' ? 'rgba(245, 158, 11, 0.1)' : globalStatus === 'loading' ? 'rgba(136,136,136,0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: globalStatus === 'ok' ? 'rgba(16, 185, 129, 0.3)' : globalStatus === 'warning' ? 'rgba(245, 158, 11, 0.3)' : globalStatus === 'loading' ? 'rgba(136,136,136,0.3)' : 'rgba(239, 68, 68, 0.3)'
          }}>
            {globalStatus === 'ok' && <><CheckCircle2 size={16} color="#10b981" /><span style={{color: '#10b981', fontWeight: 700, fontSize: 12}}>OPERATIVO</span></>}
            {globalStatus === 'warning' && <><AlertCircle size={16} color="#f59e0b" /><span style={{color: '#f59e0b', fontWeight: 700, fontSize: 12}}>ADVERTENCIA</span></>}
            {globalStatus === 'error' && <><AlertCircle size={16} color="#ef4444" /><span style={{color: '#ef4444', fontWeight: 700, fontSize: 12}}>ERROR</span></>}
            {globalStatus === 'loading' && <><Activity size={16} color="#888" /><span style={{color: '#888', fontWeight: 700, fontSize: 12}}>INICIALIZANDO</span></>}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      {health ? (
        <div style={styles.mainGrid}>
          {/* Left Column - Sensor Cards */}
          <div style={styles.sensorColumn}>
            {/* MS-711 Card */}
            <div style={styles.sensorCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                  <Radio size={16} color="#f97316" />
                  <h3 style={styles.cardTitle}>MS-711</h3>
                  <span style={styles.cardSubtitle}>UV-VIS-NIR · 300–1100 nm</span>
                </div>
                {health.ms711?.connection === "Stable" ? (
                  <span style={styles.badgeOk}><CheckCircle2 size={11} /> Conectado</span>
                ) : (
                  <span style={styles.badgeError}><AlertCircle size={11} /> Error</span>
                )}
              </div>
              <div style={styles.metricsRow}>
                <MetricTile
                  icon={<Thermometer size={14} color="#f97316" />}
                  label="Temperatura Interna"
                  value={health.ms711?.sensor_temp_c?.toFixed(2) ?? "—"}
                  unit="°C"
                  color="#f97316"
                />
                <MetricTile
                  icon={<Zap size={14} color="#eab308" />}
                  label="Alimentación (12V DC)"
                  value={health.ms711?.supply_voltage_v?.toFixed(3) ?? "—"}
                  unit="V"
                  color="#eab308"
                />
                <MetricTile
                  icon={<Shield size={14} color="#10b981" />}
                  label="Estado Obturador"
                  value={health.ms711?.shutter_status ?? "—"}
                  unit=""
                  color="#10b981"
                />
              </div>
            </div>

            {/* MS-713 Card */}
            <div style={styles.sensorCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                  <Radio size={16} color="#3b82f6" />
                  <h3 style={styles.cardTitle}>MS-713</h3>
                  <span style={styles.cardSubtitle}>NIR Extendido · 900–2500 nm</span>
                </div>
                {health.ms713?.connection === "Stable" ? (
                  <span style={styles.badgeOk}><CheckCircle2 size={11} /> Conectado</span>
                ) : (
                  <span style={styles.badgeError}><AlertCircle size={11} /> Error</span>
                )}
              </div>
              <div style={styles.metricsRow}>
                <MetricTile
                  icon={<Thermometer size={14} color="#3b82f6" />}
                  label="Control Peltier (TEC)"
                  value={health.ms713?.peltier_temp_c?.toFixed(2) ?? "—"}
                  unit="°C"
                  color={(health.ms713?.peltier_temp_c ?? -20) > -4.5 ? "#ef4444" : "#3b82f6"}
                />
                <MetricTile
                  icon={<Zap size={14} color="#eab308" />}
                  label="Alimentación Principal"
                  value={health.ms713?.supply_16v?.toFixed(3) ?? "—"}
                  unit="V"
                  color="#eab308"
                />
                <MetricTile
                  icon={<Cpu size={14} color="#10b981" />}
                  label="Alimentación Lógica"
                  value={health.ms713?.supply_5v?.toFixed(3) ?? "—"}
                  unit="V"
                  color="#10b981"
                />
                <MetricTile
                  icon={<Shield size={14} color="#8b5cf6" />}
                  label="Estado Obturador"
                  value={health.ms713?.shutter_status ?? "—"}
                  unit=""
                  color="#8b5cf6"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Charts + Logs */}
          <div style={styles.rightColumn}>
            {/* Charts Grid */}
            <div style={styles.chartsGrid}>
              {renderHistoryChart("ms711_temp", "#f97316", "Temp. MS-711", "°C", ['auto', 'auto'])}
              {renderHistoryChart("ms711_volt", "#eab308", "Voltaje MS-711", "V", ['auto', 'auto'])}
              {renderHistoryChart("ms713_temp", "#3b82f6", "Peltier MS-713", "°C", ['auto', 'auto'])}
              {renderHistoryChart("ms713_16v", "#eab308", "16V MS-713", "V", ['auto', 'auto'])}
            </div>

            {/* Log Panel */}
            <div style={styles.logPanel}>
              <div style={styles.logHeader}>
                <Terminal size={13} color="#888" />
                <span style={styles.logTitle}>Consola de Eventos</span>
                <span style={styles.logCount}>{logs.length} entradas</span>
              </div>
              <div style={styles.logContent}>
                {logs.map((log) => (
                  <div key={log.id} style={styles.logEntry}>
                    <span style={styles.logTime}>[{log.time}]</span>
                    {log.type === "info" && <Info size={11} color="#3b82f6" />}
                    {log.type === "warning" && <AlertCircle size={11} color="#f59e0b" />}
                    {log.type === "error" && <AlertCircle size={11} color="#ef4444" />}
                    <span style={{
                      color: log.type === "error" ? "#ef4444" : log.type === "warning" ? "#f59e0b" : "#a0a0a0"
                    }}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
          <Activity size={24} color="#555" style={{ marginRight: 12 }} /> Adquiriendo telemetría...
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "20px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    height: "calc(100vh - 48px)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  headerStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  headerStatLabel: {
    fontSize: 10,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 500,
  },
  headerStatValue: {
    fontSize: 14,
    color: "#e0e0e0",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.15)",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 600,
    margin: "0 0 2px 0",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "#888888",
    fontSize: 13,
    margin: 0,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid",
    letterSpacing: "0.05em",
  },
  mainGrid: {
    display: "flex",
    gap: 20,
    flex: 1,
    minHeight: 0,
  },
  sensorColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: 420,
    minWidth: 380,
    flexShrink: 0,
  },
  sensorCard: {
    backgroundColor: "#141414",
    border: "1px solid #252525",
    borderRadius: 8,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid #222",
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: "#e0e0e0",
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },
  cardSubtitle: {
    color: "#666",
    fontSize: 11,
    fontWeight: 400,
  },
  badgeOk: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "#10b981",
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  badgeError: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  metricsRow: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  metricTile: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    backgroundColor: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
  },
  metricTileSmall: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    backgroundColor: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
  },
  tileIcon: {
    width: 32,
    height: 32,
    backgroundColor: "#161616",
    border: "1px solid #252525",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tileContent: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  tileLabel: {
    color: "#777",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 500,
    marginBottom: 1,
  },
  tileValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  tileValue: {
    fontSize: 17,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  tileUnit: {
    color: "#555",
    fontSize: 11,
    fontWeight: 500,
  },
  rightColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
    minHeight: 0,
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  chartCard: {
    backgroundColor: "#141414",
    border: "1px solid #252525",
    borderRadius: 8,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartLabel: {
    color: "#999",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  chartUnit: {
    color: "#555",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
  },
  chartArea: {
    flex: 1,
    minHeight: 0,
  },
  logPanel: {
    backgroundColor: "#0c0c0c",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    height: 160,
    flexShrink: 0,
  },
  logHeader: {
    padding: "8px 14px",
    borderBottom: "1px solid #1e1e1e",
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  logTitle: {
    color: "#777",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    flex: 1,
  },
  logCount: {
    color: "#555",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
  },
  logContent: {
    padding: "10px 14px",
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
  },
  logEntry: {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    lineHeight: 1.4,
  },
  logTime: {
    color: "#555",
    minWidth: 65,
  },
};
