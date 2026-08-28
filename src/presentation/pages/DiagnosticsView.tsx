import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import { Activity, Thermometer, Zap, CheckCircle2, AlertCircle, Terminal, Info } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface HealthData {
  time: string;
  ms711_temp: number;
  ms711_volt: number;
  ms712_temp: number;
  ms712_volt: number;
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
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: "info" | "warning" | "error" = "info") => {
    const time = new Date().toLocaleTimeString("es-MX", { hour12: false });
    setLogs(prev => {
      const newLogs = [...prev, { id: Date.now() + Math.random(), time, message, type }];
      if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
      return newLogs;
    });
  };

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiClient.getHealth();
        setHealth(data);
        setError(null);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString("es-MX", { hour12: false });

        setHistory(prev => {
          const newHistory = [...prev, {
            time: timeStr,
            ms711_temp: data.ms711.sensor_temp_c,
            ms711_volt: data.ms711.supply_voltage_v,
            ms712_temp: data.ms712.peltier_temp_c,
            ms712_volt: data.ms712.supply_voltage_v,
          }];
          // Mantener los últimos 30 puntos (60 segundos a 2s)
          return newHistory.length > 30 ? newHistory.slice(newHistory.length - 30) : newHistory;
        });

        if (data.ms712.peltier_temp_c > -4.5) {
          addLog(`Advertencia Térmica: Peltier MS-712 superó umbral (${data.ms712.peltier_temp_c.toFixed(1)}°C)`, "warning");
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

  // Auto-scroll para los logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const globalStatus = !health ? "loading" : error ? "error" : (health.ms712.peltier_temp_c > -4.5 ? "warning" : "ok");

  const renderSparkline = (dataKey: string, color: string, domain: [number | 'auto', number | 'auto']) => (
    <div style={styles.sparklineContainer}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <YAxis domain={domain} hide />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTitleContainer}>
          <div style={styles.iconBox}>
            <Activity size={24} color="#10b981" />
          </div>
          <div>
            <h2 style={styles.title}>Salud y Diagnóstico</h2>
            <p style={styles.subtitle}>Telemetría en tiempo real del hardware EKO WISER</p>
          </div>
        </div>
        
        {/* Global Status Banner */}
        <div style={{
          ...styles.globalStatusBanner, 
          backgroundColor: globalStatus === 'ok' ? 'rgba(16, 185, 129, 0.1)' : globalStatus === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderColor: globalStatus === 'ok' ? 'rgba(16, 185, 129, 0.3)' : globalStatus === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'
        }}>
          {globalStatus === 'ok' && <><CheckCircle2 size={20} color="#10b981" /><span style={{color: '#10b981'}}>TODOS LOS SISTEMAS OPERATIVOS</span></>}
          {globalStatus === 'warning' && <><AlertCircle size={20} color="#f59e0b" /><span style={{color: '#f59e0b'}}>ADVERTENCIA TÉRMICA DETECTADA</span></>}
          {globalStatus === 'error' && <><AlertCircle size={20} color="#ef4444" /><span style={{color: '#ef4444'}}>ERROR CRÍTICO DEL SISTEMA</span></>}
          {globalStatus === 'loading' && <><Activity size={20} color="#888" /><span style={{color: '#888'}}>INICIALIZANDO...</span></>}
        </div>
      </div>

      <div style={styles.layout}>
        <div style={styles.mainContent}>
          {health ? (
            <div style={styles.grid}>
              {/* MS-711 Panel */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>MS-711 (VIS/NIR)</h3>
                  {health.ms711.connection === "Stable" ? (
                    <span style={styles.badgeOk}><CheckCircle2 size={12} /> Conectado</span>
                  ) : (
                    <span style={styles.badgeError}><AlertCircle size={12} /> Error</span>
                  )}
                </div>
                
                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <div style={styles.metricIcon}><Thermometer size={16} color="#f97316" /></div>
                    <div style={styles.metricData}>
                      <span style={styles.metricLabel}>Temperatura Interna</span>
                      <span style={styles.metricValue}>{health.ms711.sensor_temp_c.toFixed(1)} °C</span>
                    </div>
                  </div>
                  {renderSparkline("ms711_temp", "#f97316", ['auto', 'auto'])}
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <div style={styles.metricIcon}><Zap size={16} color="#eab308" /></div>
                    <div style={styles.metricData}>
                      <span style={styles.metricLabel}>Voltaje de Alimentación</span>
                      <span style={styles.metricValue}>{health.ms711.supply_voltage_v.toFixed(2)} V</span>
                    </div>
                  </div>
                  {renderSparkline("ms711_volt", "#eab308", ['auto', 'auto'])}
                </div>
              </div>

              {/* MS-712 Panel */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>MS-712 (NIR)</h3>
                  {health.ms712.connection === "Stable" ? (
                    <span style={styles.badgeOk}><CheckCircle2 size={12} /> Conectado</span>
                  ) : (
                    <span style={styles.badgeError}><AlertCircle size={12} /> Error</span>
                  )}
                </div>
                
                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <div style={styles.metricIcon}><Thermometer size={16} color="#3b82f6" /></div>
                    <div style={styles.metricData}>
                      <span style={styles.metricLabel}>Control Peltier (Objetivo: -5°C)</span>
                      <span style={{...styles.metricValue, color: health.ms712.peltier_temp_c > -4.5 ? '#ef4444' : '#e0e0e0'}}>
                        {health.ms712.peltier_temp_c.toFixed(1)} °C
                      </span>
                    </div>
                  </div>
                  {renderSparkline("ms712_temp", health.ms712.peltier_temp_c > -4.5 ? "#ef4444" : "#3b82f6", ['auto', 'auto'])}
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <div style={styles.metricIcon}><Zap size={16} color="#eab308" /></div>
                    <div style={styles.metricData}>
                      <span style={styles.metricLabel}>Voltaje de Alimentación</span>
                      <span style={styles.metricValue}>{health.ms712.supply_voltage_v.toFixed(2)} V</span>
                    </div>
                  </div>
                  {renderSparkline("ms712_volt", "#eab308", ['auto', 'auto'])}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, color: "#888", textAlign: "center" }}>
              Adquiriendo telemetría...
            </div>
          )}
        </div>

        {/* Log Panel */}
        <div style={styles.logPanel}>
          <div style={styles.logHeader}>
            <Terminal size={14} color="#888" />
            <span style={styles.logTitle}>Consola de Eventos</span>
          </div>
          <div style={styles.logContent}>
            {logs.map((log) => (
              <div key={log.id} style={styles.logEntry}>
                <span style={styles.logTime}>[{log.time}]</span>
                {log.type === "info" && <Info size={12} color="#3b82f6" />}
                {log.type === "warning" && <AlertCircle size={12} color="#f59e0b" />}
                {log.type === "error" && <AlertCircle size={12} color="#ef4444" />}
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
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    height: "calc(100vh - 48px)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleContainer: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 600,
    margin: "0 0 4px 0",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "#888888",
    fontSize: 14,
    margin: 0,
  },
  globalStatusBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 24px",
    borderRadius: 8,
    border: "1px solid",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.05em",
  },
  layout: {
    display: "flex",
    gap: 24,
    flex: 1,
    minHeight: 0,
  },
  mainContent: {
    flex: 2,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflowY: "auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: 24,
  },
  card: {
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2a2a2a",
    paddingBottom: 16,
  },
  cardTitle: {
    color: "#e0e0e0",
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  badgeOk: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "#10b981",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  badgeError: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  metricBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 36,
    height: 36,
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  metricData: {
    display: "flex",
    flexDirection: "column",
  },
  metricLabel: {
    color: "#888888",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 500,
    marginBottom: 2,
  },
  metricValue: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
  },
  sparklineContainer: {
    height: 40,
    width: "100%",
  },
  logPanel: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    border: "1px solid #222222",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    minWidth: 350,
  },
  logHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #222222",
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#161616",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  logTitle: {
    color: "#888888",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  logContent: {
    padding: "16px",
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
  },
  logEntry: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    lineHeight: 1.4,
  },
  logTime: {
    color: "#666666",
    minWidth: 70,
  },
};
