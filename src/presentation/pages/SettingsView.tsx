import React, { useState, useEffect } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import type { HardwareSettings, SerialPortInfo } from "../../infrastructure/api/api_client";
import { Settings, Usb, Save, RefreshCw, CheckCircle, AlertCircle, Globe, Crosshair, Navigation, MapPin, Database, Wrench } from "lucide-react";
import { TrackerCalibrationModal } from "../components/TrackerCalibrationModal";

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<HardwareSettings>({
    sensors: {
      global: { ms711: { port: "COM3", enabled: true }, ms713: { port: "COM4", enabled: true } },
      direct: { ms711: { port: "COM5", enabled: true }, ms713: { port: "COM6", enabled: true } },
    },
    tracker: { port: "COM7", enabled: false }
  });
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [portsWarning, setPortsWarning] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, { status: "testing"|"success"|"error", msg?: string }>>({});
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPorts();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.getHardwareSettings();
      setSettings(data);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPorts = async () => {
    try {
      const data = await apiClient.listSerialPorts();
      setAvailablePorts(data.ports || []);
      if (data.warning) setPortsWarning(data.warning);
    } catch (err) {
      console.error("Error loading ports:", err);
    }
  };

  const handlePortChange = (group: "global" | "direct" | "tracker", sensor: "ms711" | "ms713" | "tracker", value: string) => {
    if (group === "tracker") {
      setSettings(prev => ({ ...prev, tracker: { ...prev.tracker!, port: value } }));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [group]: {
          ...prev.sensors[group as "global"|"direct"],
          [sensor]: { ...prev.sensors[group as "global"|"direct"][sensor as "ms711"|"ms713"], port: value },
        },
      },
    }));
  };

  
  const handleStationChange = (field: keyof typeof settings.station, value: number) => {
    setSettings(prev => prev && prev.station ? {
      ...prev,
      station: { ...prev.station, [field]: value }
    } : prev);
  };

const handleToggle = (group: "global" | "direct" | "tracker", sensor: "ms711" | "ms713" | "tracker") => {
    if (group === "tracker") {
      setSettings(prev => ({ ...prev, tracker: { ...prev.tracker!, enabled: !prev.tracker!.enabled } }));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [group]: {
          ...prev.sensors[group as "global"|"direct"],
          [sensor]: { ...prev.sensors[group as "global"|"direct"][sensor as "ms711"|"ms713"], enabled: !prev.sensors[group as "global"|"direct"][sensor as "ms711"|"ms713"].enabled },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await apiClient.saveHardwareSettings(settings);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  const handleTestConnection = async (port: string, id: string) => {
    setTestResults(prev => ({ ...prev, [id]: { status: "testing" } }));
    try {
      const res = await apiClient.testConnection(port);
      setTestResults(prev => ({ ...prev, [id]: { status: "success", msg: res.message } }));
      setTimeout(() => { setTestResults(prev => { const n = {...prev}; delete n[id]; return n; }); }, 3000);
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [id]: { status: "error", msg: err.message } }));
      setTimeout(() => { setTestResults(prev => { const n = {...prev}; delete n[id]; return n; }); }, 5000);
    }
  };

  const renderPortSelect = (group: "global" | "direct" | "tracker", sensor: "ms711" | "ms713" | "tracker", label: string) => {
    const config = group === "tracker" ? settings.tracker! : settings.sensors[group as "global"|"direct"][sensor as "ms711"|"ms713"];
    const id = `${group}-${sensor}`;
    const testRes = testResults[id];

    return (
      <div style={styles.formGroup}>
        <div style={styles.sensorHeader}>
          <label style={styles.label}>{label}</label>
          <button
            style={{
              ...styles.toggleButton,
              backgroundColor: config.enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(136, 136, 136, 0.1)",
              color: config.enabled ? "#10b981" : "#666",
              borderColor: config.enabled ? "rgba(16, 185, 129, 0.3)" : "#333",
            }}
            onClick={() => handleToggle(group, sensor)}
          >
            {config.enabled ? "Habilitado" : "Deshabilitado"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={{ ...styles.select, flex: 1, opacity: config.enabled ? 1 : 0.4 }}
            value={config.port}
            onChange={(e) => handlePortChange(group, sensor, e.target.value)}
            disabled={!config.enabled}
          >
            <option value={config.port}>{config.port} (Actual)</option>
            {availablePorts
              .filter((p) => p.device !== config.port)
              .map((p) => (
                <option key={p.device} value={p.device}>
                  {p.device} — {p.description}
                </option>
              ))}
            {["COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
              "/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyUSB2", "/dev/ttyUSB3"]
              .filter((p) => p !== config.port && !availablePorts.find((ap) => ap.device === p))
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
          <button 
            style={{ ...styles.testBtn, opacity: config.enabled ? 1 : 0.4 }}
            disabled={!config.enabled || testRes?.status === "testing"}
            onClick={() => handleTestConnection(config.port, id)}
          >
            {testRes?.status === "testing" ? <RefreshCw size={14} className="spin" /> : "Validar"}
          </button>
        </div>
        {testRes && testRes.status !== "testing" && (
          <div style={{ ...styles.testResult, color: testRes.status === "success" ? "#10b981" : "#ef4444" }}>
            {testRes.status === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            {testRes.msg}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div style={{ padding: 40, color: "#fff" }}>Cargando configuración...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>
          <Settings size={20} color="#8b5cf6" />
        </div>
        <div>
          <h2 style={styles.title}>Configuración de Hardware</h2>
          <p style={styles.subtitle}>Asignación de puertos seriales para la instrumentación EKO</p>
        </div>
      </div>

      {portsWarning && (
        <div style={styles.warningBanner}>
          <AlertCircle size={16} color="#eab308" />
          <span>{portsWarning}</span>
        </div>
      )}

      <div style={styles.grid}>
        {/* Grupo Global */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Globe size={18} color="#60a5fa" />
            <h3 style={styles.cardTitle}>Radiación Global</h3>
          </div>
          <p style={styles.cardDesc}>Sensores orientados al cenit.</p>
          <div style={styles.cardBody}>
            {renderPortSelect("global", "ms711", "MS-711 (VIS-NIR)")}
            {renderPortSelect("global", "ms713", "MS-713 (SWIR)")}
          </div>
        </div>

        {/* Grupo Directo */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Crosshair size={18} color="#f43f5e" />
            <h3 style={styles.cardTitle}>Radiación Directa</h3>
          </div>
          <p style={styles.cardDesc}>Sensores montados en el Sun Tracker.</p>
          <div style={styles.cardBody}>
            {renderPortSelect("direct", "ms711", "MS-711 (VIS-NIR)")}
            {renderPortSelect("direct", "ms713", "MS-713 (SWIR)")}
          </div>
        </div>

        {/* Estación y Geolocalización */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <MapPin size={18} color="#10b981" />
            <h3 style={styles.cardTitle}>Geolocalización</h3>
          </div>
          <p style={styles.cardDesc}>Parámetros de la estación para geometría solar.</p>
          <div style={styles.cardBody}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Latitud (°)</label>
              <input type="number" step="0.0001" style={styles.input} value={settings.station?.latitude || ""} onChange={(e) => handleStationChange("latitude", parseFloat(e.target.value))} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Longitud (°)</label>
              <input type="number" step="0.0001" style={styles.input} value={settings.station?.longitude || ""} onChange={(e) => handleStationChange("longitude", parseFloat(e.target.value))} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{...styles.formGroup, flex: 1}}>
                <label style={styles.label}>Altitud (msnm)</label>
                <input type="number" step="1" style={styles.input} value={settings.station?.altitude || ""} onChange={(e) => handleStationChange("altitude", parseFloat(e.target.value))} />
              </div>
              <div style={{...styles.formGroup, flex: 1}}>
                <label style={styles.label}>Presión (hPa)</label>
                <input type="number" step="0.1" style={styles.input} value={settings.station?.pressure || ""} onChange={(e) => handleStationChange("pressure", parseFloat(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        {/* Tracker Solar */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Navigation size={18} color="#eab308" />
            <h3 style={styles.cardTitle}>Sun Tracker (STR)</h3>
          </div>
          <p style={styles.cardDesc}>Dispositivo motorizado para el seguimiento solar.</p>
          <div style={styles.cardBody}>
            {settings.tracker && renderPortSelect("tracker", "tracker", "Controlador RS-232C")}
            
            <div style={{ paddingTop: 8 }}>
              <button
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "10px 16px",
                  backgroundColor: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)",
                  color: "#eab308", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={() => setIsCalibrationOpen(true)}
              >
                <Wrench size={14} />
                Calibración Avanzada
              </button>
            </div>
          </div>
        </div>


      </div>

      <div style={styles.footer}>
        <div style={styles.statusBox}>
          {saveStatus === "saving" && <><RefreshCw size={16} color="#666" className="spin" /><span style={{ color: "#888" }}>Guardando...</span></>}
          {saveStatus === "saved" && <><CheckCircle size={16} color="#10b981" /><span style={{ color: "#10b981" }}>Configuración guardada correctamente</span></>}
          {saveStatus === "error" && <><AlertCircle size={16} color="#ef4444" /><span style={{ color: "#ef4444" }}>Error al guardar la configuración</span></>}
        </div>
        <button
          style={styles.saveBtn}
          onClick={handleSave}
          disabled={saveStatus === "saving"}
        >
          <Save size={16} />
          Guardar Cambios
        </button>
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Modal de Calibración del Sun Tracker */}
      <TrackerCalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 32, maxWidth: 1200, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 32 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(139, 92, 246, 0.2)" },
  title: { margin: 0, fontSize: 24, fontWeight: 600, color: "#e0e0e0", letterSpacing: "-0.02em" },
  subtitle: { margin: "4px 0 0 0", color: "#888", fontSize: 14 },
  warningBanner: { display: "flex", alignItems: "center", gap: 12, backgroundColor: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.2)", color: "#eab308", padding: "12px 16px", borderRadius: 8, marginBottom: 24, fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32 },
  card: { backgroundColor: "#161616", border: "1px solid #333", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" },
  cardHeader: { display: "flex", alignItems: "center", gap: 10, padding: "20px 20px 8px 20px" },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "#e0e0e0" },
  cardDesc: { margin: "0 20px 20px 20px", fontSize: 12, color: "#888", lineHeight: 1.4 },
  cardBody: { padding: "0 20px 24px 20px", display: "flex", flexDirection: "column", gap: 20 },
  formGroup: { display: "flex", flexDirection: "column", gap: 8 },
  sensorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 12, fontWeight: 500, color: "#aaa" },
  toggleButton: { padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, border: "1px solid", cursor: "pointer", transition: "all 0.2s" },
  input: { backgroundColor: "#111", border: "1px solid #444", color: "#e0e0e0", borderRadius: 6, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%" }, select: { backgroundColor: "#111", border: "1px solid #444", color: "#e0e0e0", borderRadius: 6, padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer", transition: "all 0.2s" },
  testBtn: { padding: "0 12px", borderRadius: 6, backgroundColor: "#222", border: "1px solid #444", color: "#ccc", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" },
  testResult: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginTop: 4 },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderTop: "1px solid #333" },
  statusBox: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, minWidth: 200 },
  saveBtn: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" },
};
