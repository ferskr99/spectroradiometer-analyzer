import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import {
  Activity, Thermometer, Zap, Shield, Cpu, Radio,
  CheckCircle2, AlertCircle, Terminal, Info, Navigation, Globe, Crosshair
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Tipos de datos ─────────────────────────────────────────────────

interface HistoryPoint {
  time: string;
  // MS-711 Global
  ms711g_temp: number;
  ms711g_volt: number;
  // MS-713 Global
  ms713g_peltier: number;
  ms713g_16v: number;
  // MS-711 Direct
  ms711d_temp: number;
  ms711d_volt: number;
  // MS-713 Direct
  ms713d_peltier: number;
  ms713d_16v: number;
  // Tracker
  tracker_az: number;
  tracker_el: number;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: "info" | "warning" | "error";
}

type DeviceStatus = "ok" | "warning" | "error" | "disabled";

// ─── Componente Principal ─────────────────────────────────────────

export const DiagnosticsView: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const initialTime = new Date().toLocaleTimeString("es-MX", { hour12: false });
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, time: initialTime, message: "Inicializando sistema de diagnóstico de 5 dispositivos...", type: "info" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: "info" | "warning" | "error" = "info") => {
    const time = new Date().toLocaleTimeString("es-MX", { hour12: false });
    setLogs(prev => {
      const newLogs = [...prev, { id: Date.now() + Math.random(), time, message, type }];
      return newLogs.length > 100 ? newLogs.slice(-100) : newLogs;
    });
  };

  useEffect(() => {
    const i = setInterval(() => setUptime(p => p + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiClient.getHealth();
        setHealth(data);
        setError(null);
        setSampleCount(p => p + 1);

        const timeStr = new Date().toLocaleTimeString("es-MX", { hour12: false });
        setHistory(prev => {
          const point: HistoryPoint = {
            time: timeStr,
            ms711g_temp: data.ms711_global?.sensor_temp_c ?? 0,
            ms711g_volt: data.ms711_global?.supply_voltage_v ?? 0,
            ms713g_peltier: data.ms713_global?.peltier_temp_c ?? 0,
            ms713g_16v: data.ms713_global?.supply_16v ?? 0,
            ms711d_temp: data.ms711_direct?.sensor_temp_c ?? 0,
            ms711d_volt: data.ms711_direct?.supply_voltage_v ?? 0,
            ms713d_peltier: data.ms713_direct?.peltier_temp_c ?? 0,
            ms713d_16v: data.ms713_direct?.supply_16v ?? 0,
            tracker_az: data.tracker?.azimuth ?? 0,
            tracker_el: data.tracker?.elevation ?? 0,
          };
          const next = [...prev, point];
          return next.length > 60 ? next.slice(-60) : next;
        });

        // Alertas inteligentes
        if (data.ms713_global?.peltier_temp_c != null && data.ms713_global.peltier_temp_c > -4.5)
          addLog(`Alerta Térmica: Peltier MS-713 Global ${data.ms713_global.peltier_temp_c.toFixed(1)}°C (umbral -5°C)`, "warning");
        if (data.ms713_direct?.peltier_temp_c != null && data.ms713_direct.peltier_temp_c > -4.5)
          addLog(`Alerta Térmica: Peltier MS-713 Directo ${data.ms713_direct.peltier_temp_c.toFixed(1)}°C`, "warning");
      } catch (err: any) {
        const msg = err.message || "Error de conexión con el hardware";
        setError(msg);
        addLog(msg, "error");
      }
    };
    fetchHealth();
    const i = setInterval(fetchHealth, 2000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getDeviceStatus = (deviceData: any): DeviceStatus => {
    if (!deviceData) return "error";
    if (deviceData.connection === "Disabled") return "disabled";
    if (deviceData.connection !== "Stable") return "error";
    if (deviceData.peltier_temp_c != null && deviceData.peltier_temp_c > -4.5) return "warning";
    return "ok";
  };

  const globalStatus = !health ? "loading" : error ? "error" : "ok";
  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // ─── Componentes Internos ─────────────────────────────────────────

  const StatusDot: React.FC<{ status: DeviceStatus }> = ({ status }) => {
    const colors: Record<DeviceStatus, string> = { ok: "#10b981", warning: "#f59e0b", error: "#ef4444", disabled: "#555" };
    return <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors[status], display: "inline-block", flexShrink: 0, boxShadow: status === "ok" ? "0 0 6px rgba(16,185,129,0.5)" : status === "error" ? "0 0 6px rgba(239,68,68,0.4)" : "none" }} />;
  };

  const MetricRow: React.FC<{ icon: React.ReactNode; label: string; value: string; unit: string; color?: string }> = ({ icon, label, value, unit, color = "#e0e0e0" }) => (
    <div style={S.metricRow}>
      <div style={S.metricIcon}>{icon}</div>
      <span style={S.metricLabel}>{label}</span>
      <span style={{ ...S.metricValue, color }}>{value}</span>
      <span style={S.metricUnit}>{unit}</span>
    </div>
  );

  const DeviceCard: React.FC<{
    title: string; subtitle: string; icon: React.ReactNode; iconColor: string;
    status: DeviceStatus; metrics: React.ReactNode;
  }> = ({ title, subtitle, icon, iconColor, status, metrics }) => (
    <div style={{ ...S.deviceCard, borderColor: status === "error" ? "rgba(239,68,68,0.3)" : status === "warning" ? "rgba(245,158,11,0.2)" : "#252525" }}>
      <div style={S.cardHeader}>
        <div style={{ ...S.cardIconBox, backgroundColor: `${iconColor}11`, borderColor: `${iconColor}33` }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={S.cardTitleRow}>
            <h3 style={S.cardTitle}>{title}</h3>
            <StatusDot status={status} />
          </div>
          <p style={S.cardSubtitle}>{subtitle}</p>
        </div>
        <span style={{
          ...S.statusBadge,
          backgroundColor: status === "ok" ? "rgba(16,185,129,0.1)" : status === "warning" ? "rgba(245,158,11,0.1)" : status === "disabled" ? "rgba(136,136,136,0.08)" : "rgba(239,68,68,0.1)",
          color: status === "ok" ? "#10b981" : status === "warning" ? "#f59e0b" : status === "disabled" ? "#666" : "#ef4444",
          borderColor: status === "ok" ? "rgba(16,185,129,0.25)" : status === "warning" ? "rgba(245,158,11,0.25)" : status === "disabled" ? "rgba(136,136,136,0.2)" : "rgba(239,68,68,0.25)",
        }}>
          {status === "ok" ? "CONECTADO" : status === "warning" ? "ADVERTENCIA" : status === "disabled" ? "DESHABILITADO" : "ERROR"}
        </span>
      </div>
      <div style={S.cardMetrics}>{metrics}</div>
    </div>
  );

  const renderChart = (dataKey: string, color: string, label: string, unit: string) => (
    <div style={S.chartCard}>
      <div style={S.chartHeader}>
        <span style={S.chartLabel}>{label}</span>
        <span style={S.chartUnit}>{unit}</span>
      </div>
      <div style={S.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
              labelStyle={{ color: "#888" }}
              formatter={(v: any) => [`${Number(v).toFixed(3)} ${unit}`, label]}
            />
            <Area type="linear" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#g-${dataKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.headerIcon}><Activity size={22} color="#10b981" /></div>
          <div>
            <h2 style={S.title}>Salud y Diagnóstico</h2>
            <p style={S.subtitle}>Telemetría en tiempo real · 4 Espectrorradiómetros + 1 Sun Tracker</p>
          </div>
        </div>
        <div style={S.headerRight}>
          <div style={S.headerStat}><span style={S.statLabel}>UPTIME</span><span style={S.statValue}>{formatUptime(uptime)}</span></div>
          <div style={S.headerStat}><span style={S.statLabel}>MUESTRAS</span><span style={S.statValue}>{sampleCount}</span></div>
          <div style={{
            ...S.globalBadge,
            backgroundColor: globalStatus === "ok" ? "rgba(16,185,129,0.1)" : globalStatus === "loading" ? "rgba(136,136,136,0.1)" : "rgba(239,68,68,0.1)",
            borderColor: globalStatus === "ok" ? "rgba(16,185,129,0.3)" : globalStatus === "loading" ? "rgba(136,136,136,0.3)" : "rgba(239,68,68,0.3)",
          }}>
            {globalStatus === "ok" && <><CheckCircle2 size={15} color="#10b981" /><span style={{ color: "#10b981", fontWeight: 700, fontSize: 12 }}>OPERATIVO</span></>}
            {globalStatus === "error" && <><AlertCircle size={15} color="#ef4444" /><span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>ERROR</span></>}
            {globalStatus === "loading" && <><Activity size={15} color="#888" /><span style={{ color: "#888", fontWeight: 700, fontSize: 12 }}>CARGANDO</span></>}
          </div>
        </div>
      </div>

      {health ? (
        <div style={S.content}>
          {/* Fila Superior: 5 Tarjetas de Dispositivos */}
          <div style={S.devicesRow}>
            {/* MS-711 Global */}
            <DeviceCard
              title="MS-711" subtitle="Global · VIS-NIR · 300–1100nm"
              icon={<Globe size={16} color="#60a5fa" />} iconColor="#60a5fa"
              status={getDeviceStatus(health.ms711_global)}
              metrics={<>
                <MetricRow icon={<Thermometer size={12} color="#f97316" />} label="Temperatura" value={health.ms711_global?.sensor_temp_c?.toFixed(2) ?? "—"} unit="°C" color="#f97316" />
                <MetricRow icon={<Zap size={12} color="#eab308" />} label="Alimentación" value={health.ms711_global?.supply_voltage_v?.toFixed(3) ?? "—"} unit="V" color="#eab308" />
                <MetricRow icon={<Shield size={12} color="#10b981" />} label="Obturador" value={health.ms711_global?.shutter_status ?? "—"} unit="" color="#10b981" />
              </>}
            />
            {/* MS-713 Global */}
            <DeviceCard
              title="MS-713" subtitle="Global · SWIR · 900–2500nm"
              icon={<Globe size={16} color="#3b82f6" />} iconColor="#3b82f6"
              status={getDeviceStatus(health.ms713_global)}
              metrics={<>
                <MetricRow icon={<Thermometer size={12} color="#3b82f6" />} label="Peltier TEC" value={health.ms713_global?.peltier_temp_c?.toFixed(2) ?? "—"} unit="°C" color={(health.ms713_global?.peltier_temp_c ?? -20) > -4.5 ? "#ef4444" : "#3b82f6"} />
                <MetricRow icon={<Zap size={12} color="#eab308" />} label="Alim. 16V" value={health.ms713_global?.supply_16v?.toFixed(3) ?? "—"} unit="V" color="#eab308" />
                <MetricRow icon={<Cpu size={12} color="#10b981" />} label="Lógica 5V" value={health.ms713_global?.supply_5v?.toFixed(3) ?? "—"} unit="V" color="#10b981" />
              </>}
            />
            {/* MS-711 Direct */}
            <DeviceCard
              title="MS-711" subtitle="Directo · VIS-NIR · 300–1100nm"
              icon={<Crosshair size={16} color="#f43f5e" />} iconColor="#f43f5e"
              status={getDeviceStatus(health.ms711_direct)}
              metrics={<>
                <MetricRow icon={<Thermometer size={12} color="#f97316" />} label="Temperatura" value={health.ms711_direct?.sensor_temp_c?.toFixed(2) ?? "—"} unit="°C" color="#f97316" />
                <MetricRow icon={<Zap size={12} color="#eab308" />} label="Alimentación" value={health.ms711_direct?.supply_voltage_v?.toFixed(3) ?? "—"} unit="V" color="#eab308" />
                <MetricRow icon={<Shield size={12} color="#10b981" />} label="Obturador" value={health.ms711_direct?.shutter_status ?? "—"} unit="" color="#10b981" />
              </>}
            />
            {/* MS-713 Direct */}
            <DeviceCard
              title="MS-713" subtitle="Directo · SWIR · 900–2500nm"
              icon={<Crosshair size={16} color="#8b5cf6" />} iconColor="#8b5cf6"
              status={getDeviceStatus(health.ms713_direct)}
              metrics={<>
                <MetricRow icon={<Thermometer size={12} color="#8b5cf6" />} label="Peltier TEC" value={health.ms713_direct?.peltier_temp_c?.toFixed(2) ?? "—"} unit="°C" color={(health.ms713_direct?.peltier_temp_c ?? -20) > -4.5 ? "#ef4444" : "#8b5cf6"} />
                <MetricRow icon={<Zap size={12} color="#eab308" />} label="Alim. 16V" value={health.ms713_direct?.supply_16v?.toFixed(3) ?? "—"} unit="V" color="#eab308" />
                <MetricRow icon={<Cpu size={12} color="#10b981" />} label="Lógica 5V" value={health.ms713_direct?.supply_5v?.toFixed(3) ?? "—"} unit="V" color="#10b981" />
              </>}
            />
            {/* Sun Tracker */}
            <DeviceCard
              title="STR-22G" subtitle="Sun Tracker · RS-232C"
              icon={<Navigation size={16} color="#eab308" />} iconColor="#eab308"
              status={getDeviceStatus(health.tracker)}
              metrics={<>
                <MetricRow icon={<Navigation size={12} color="#eab308" />} label="Azimut" value={health.tracker?.azimuth?.toFixed(2) ?? "—"} unit="°" color="#eab308" />
                <MetricRow icon={<Navigation size={12} color="#f59e0b" />} label="Elevación" value={health.tracker?.elevation?.toFixed(2) ?? "—"} unit="°" color="#f59e0b" />
                <MetricRow icon={<Radio size={12} color="#10b981" />} label="Puerto" value={health.tracker?.port ?? "—"} unit="" color="#888" />
              </>}
            />
          </div>

          {/* Fila Inferior: Gráficas de Historia + Log */}
          <div style={S.bottomRow}>
            <div style={S.chartsSection}>
              <div style={S.chartsGrid}>
                {renderChart("ms711g_temp", "#f97316", "Temp. 711-G", "°C")}
                {renderChart("ms713g_peltier", "#3b82f6", "Peltier 713-G", "°C")}
                {renderChart("ms711d_temp", "#f43f5e", "Temp. 711-D", "°C")}
                {renderChart("ms713d_peltier", "#8b5cf6", "Peltier 713-D", "°C")}
                {renderChart("ms711g_volt", "#eab308", "Volt. 711-G", "V")}
                {renderChart("tracker_el", "#eab308", "Elevación Tracker", "°")}
              </div>
            </div>

            <div style={S.logPanel}>
              <div style={S.logHeader}>
                <Terminal size={13} color="#888" />
                <span style={S.logTitle}>Consola de Eventos</span>
                <span style={S.logCount}>{logs.length}</span>
              </div>
              <div style={S.logContent}>
                {logs.map((log) => (
                  <div key={log.id} style={S.logEntry}>
                    <span style={S.logTime}>[{log.time}]</span>
                    {log.type === "info" && <Info size={11} color="#3b82f6" />}
                    {log.type === "warning" && <AlertCircle size={11} color="#f59e0b" />}
                    {log.type === "error" && <AlertCircle size={11} color="#ef4444" />}
                    <span style={{ color: log.type === "error" ? "#ef4444" : log.type === "warning" ? "#f59e0b" : "#a0a0a0" }}>
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
          <Activity size={24} color="#555" style={{ marginRight: 12 }} /> Adquiriendo telemetría de 5 dispositivos...
        </div>
      )}
    </div>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  container: { padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 48px)", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  headerIcon: { width: 44, height: 44, backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: 600, margin: "0 0 2px 0", letterSpacing: "-0.02em" },
  subtitle: { color: "#888", fontSize: 13, margin: 0 },
  headerStat: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  statLabel: { fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 },
  statValue: { fontSize: 14, color: "#e0e0e0", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  globalBadge: { display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 6, border: "1px solid", letterSpacing: "0.05em" },

  content: { flex: 1, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 },

  // Dispositivos
  devicesRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, flexShrink: 0 },
  deviceCard: { backgroundColor: "#141414", border: "1px solid #252525", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  cardHeader: { display: "flex", alignItems: "center", gap: 10 },
  cardIconBox: { width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid", flexShrink: 0 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 6 },
  cardTitle: { color: "#e0e0e0", fontSize: 14, fontWeight: 700, margin: 0 },
  cardSubtitle: { color: "#666", fontSize: 10, margin: 0, marginTop: 1 },
  statusBadge: { padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, border: "1px solid", letterSpacing: "0.06em", flexShrink: 0 },
  cardMetrics: { display: "flex", flexDirection: "column", gap: 6 },

  // Metric rows
  metricRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", backgroundColor: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 5 },
  metricIcon: { width: 24, height: 24, backgroundColor: "#161616", border: "1px solid #252525", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  metricLabel: { color: "#777", fontSize: 10, flex: 1, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.03em" },
  metricValue: { fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  metricUnit: { color: "#555", fontSize: 10, fontWeight: 500, minWidth: 16 },

  // Charts + Logs
  bottomRow: { flex: 1, display: "flex", gap: 14, minHeight: 0 },
  chartsSection: { flex: 1, minWidth: 0, minHeight: 0 },
  chartsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, height: "100%" },
  chartCard: { backgroundColor: "#141414", border: "1px solid #252525", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", minHeight: 0 },
  chartHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  chartLabel: { color: "#999", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  chartUnit: { color: "#555", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" },
  chartArea: { flex: 1, minHeight: 0 },

  // Log panel
  logPanel: { width: 320, minWidth: 280, backgroundColor: "#0c0c0c", border: "1px solid #1e1e1e", borderRadius: 8, display: "flex", flexDirection: "column", flexShrink: 0 },
  logHeader: { padding: "8px 14px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 8, backgroundColor: "#111", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  logTitle: { color: "#777", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 },
  logCount: { color: "#555", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
  logContent: { padding: "10px 14px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
  logEntry: { display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4 },
  logTime: { color: "#555", minWidth: 65 },
};
