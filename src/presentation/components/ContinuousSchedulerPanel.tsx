import React, { useState, useEffect } from "react";
import { apiClient, SchedulerConfig, SchedulerStatusResponse } from "../../infrastructure/api/api_client";
import { Clock, Play, Square, AlertTriangle, ShieldCheck } from "lucide-react";

export const ContinuousSchedulerPanel: React.FC = () => {
  const [status, setStatus] = useState<SchedulerStatusResponse>({ is_running: false, config: null, last_exposure_ms: null });
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [interval, setIntervalMins] = useState(10);
  const [sensorTarget, setSensorTarget] = useState("All");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const toLocalISO = (d: Date) => {
      const tzoffset = d.getTimezoneOffset() * 60000;
      return (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    };
    
    setStartTime(toLocalISO(now));
    setEndTime(toLocalISO(tomorrow));

    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await apiClient.getSchedulerStatus();
      setStatus(res);
      if (res.is_running && res.config) {
        const sTime = new Date(res.config.start_time);
        const eTime = new Date(res.config.end_time);
        const toLocalISO = (d: Date) => {
          const tzoffset = d.getTimezoneOffset() * 60000;
          return (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
        };
        setStartTime(toLocalISO(sTime));
        setEndTime(toLocalISO(eTime));
        setIntervalMins(res.config.interval_minutes);
        setSensorTarget(res.config.sensor_target);
      }
    } catch (err) {
      console.error("Error fetching scheduler status", err);
    }
  };

  const handleToggleScheduler = async () => {
    setIsProcessing(true);
    try {
      if (status.is_running) {
        await apiClient.stopScheduler();
      } else {
        const config: SchedulerConfig = {
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          interval_minutes: interval,
          sensor_target: sensorTarget,
          exposure_time_ms: 10,
          auto_exposure: true
        };
        await apiClient.startScheduler(config);
      }
      await fetchStatus();
    } catch (err) {
      console.error("Error toggling scheduler", err);
      alert("Error al cambiar el estado del programador. Verifica las fechas.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleBox}>
          <Clock size={15} color="#0078d4" />
          <h3 style={styles.title}>Control Programado</h3>
        </div>
        {status.is_running ? (
          <span style={styles.badgeActive}>EJECUTANDO</span>
        ) : (
          <span style={styles.badgeIdle}>DETENIDO</span>
        )}
      </div>

      <div style={styles.body}>
        {/* Sensor Objetivo */}
        <div style={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={styles.label}>Sensor Objetivo</label>
            <div style={styles.autoBadge}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#eab308" }}></span>
              Auto-Exposición {status.last_exposure_ms ? '(' + status.last_exposure_ms + ' ms)' : ''}
            </div>
          </div>
          <select 
            value={sensorTarget}
            onChange={e => setSensorTarget(e.target.value)}
            style={styles.selectInput}
            disabled={status.is_running}
          >
            <option value="Global">Espectro Global (GHI)</option>
            <option value="Direct">Espectro Directo (DNI)</option>
            <option value="All">Adquisición Total (4 sensores)</option>
          </select>
        </div>

        {/* Fechas de Inicio, Fin e Intervalo */}
        <div style={styles.timeGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Inicio</label>
            <input 
              type="datetime-local" 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              style={styles.inputTime}
              disabled={status.is_running}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Fin</label>
            <input 
              type="datetime-local" 
              value={endTime} 
              onChange={e => setEndTime(e.target.value)}
              style={styles.inputTime}
              disabled={status.is_running}
            />
          </div>

          <div style={{ ...styles.formGroup, flex: 0.5 }}>
            <label style={styles.label}>Int. (min)</label>
            <input 
              type="number" 
              min="1"
              value={interval} 
              onChange={e => setIntervalMins(Number(e.target.value))}
              style={styles.inputNum}
              disabled={status.is_running}
            />
          </div>
        </div>

        {/* Advertencia / Protocolo de Rescate */}
        <div style={styles.warningBox}>
          <AlertTriangle size={14} color="#eab308" style={{ flexShrink: 0 }} />
          <span style={styles.warningText}>
            En caso de falla o desconexión física, el sistema activará el protocolo de emergencia y rescate automático.
          </span>
        </div>

        {/* Estado del Ciclo Automatizado */}
        <div style={styles.statusBox}>
          <ShieldCheck size={14} color="#10b981" style={{ flexShrink: 0 }} />
          <span style={styles.statusBoxText}>
            {status.is_running
              ? 'Ciclo activo cada ' + interval + ' min. Próxima adquisición programada.'
              : 'Programador listo para inicio de ciclo automático.'}
          </span>
        </div>

        {/* Botón de Acción */}
        <div style={styles.actionSection}>
          <button 
            style={status.is_running ? styles.buttonStop : styles.buttonStart}
            onClick={handleToggleScheduler}
            disabled={isProcessing}
          >
            {status.is_running ? (
              <><Square size={14} fill="currentColor" /> ABORTAR MEDICIÓN</>
            ) : (
              <><Play size={14} fill="currentColor" /> INICIAR PROTOCOLO</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #333333",
    backgroundColor: "#111111",
  },
  titleBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: 0,
    letterSpacing: "0.03em",
  },
  badgeActive: {
    backgroundColor: "#0078d4",
    color: "#ffffff",
    padding: "3px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  badgeIdle: {
    backgroundColor: "#333333",
    color: "#888888",
    padding: "3px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  body: {
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 16,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  autoBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#eab308",
    fontWeight: 600,
  },
  selectInput: {
    padding: "8px 10px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#ffffff",
    borderRadius: 4,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    width: "100%",
    outline: "none",
    cursor: "pointer",
  },
  timeGrid: {
    display: "flex",
    gap: 10,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  inputTime: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#ffffff",
    padding: "8px 10px",
    borderRadius: 4,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    width: "100%",
    boxSizing: "border-box",
  },
  inputNum: {
    padding: "8px 10px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#ffffff",
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    textAlign: "center",
    fontWeight: 600,
  },
  warningBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    border: "1px solid rgba(234, 179, 8, 0.25)",
    padding: "8px 10px",
    borderRadius: 4,
  },
  warningText: {
    color: "#eab308",
    fontSize: 10,
    lineHeight: 1.2,
  },
  statusBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    padding: "8px 10px",
    borderRadius: 4,
  },
  statusBoxText: {
    color: "#10b981",
    fontSize: 10,
    lineHeight: 1.2,
  },
  actionSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonStart: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    padding: "8px 24px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase",
    height: 38,
    letterSpacing: "0.05em",
    width: "auto",
    minWidth: 200,
    boxShadow: "0 2px 6px rgba(0, 120, 212, 0.3)",
  },
  buttonStop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "none",
    padding: "8px 24px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase",
    height: 38,
    letterSpacing: "0.05em",
    width: "auto",
    minWidth: 200,
    boxShadow: "0 2px 6px rgba(239, 68, 68, 0.3)",
  },
};

export default ContinuousSchedulerPanel;
