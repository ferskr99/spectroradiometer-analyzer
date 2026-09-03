import React, { useState, useEffect } from "react";
import { apiClient, SchedulerConfig, SchedulerStatusResponse } from "../../infrastructure/api/api_client";
import { Clock, Play, Square, AlertTriangle } from "lucide-react";

export const ContinuousSchedulerPanel: React.FC = () => {
  const [status, setStatus] = useState<SchedulerStatusResponse>({ is_running: false, config: null, last_exposure_ms: null });
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [interval, setIntervalMins] = useState(10);
  const [sensorTarget, setSensorTarget] = useState("Merge");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Inicializar fechas con defaults razonables
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // Format para input datetime-local: YYYY-MM-DDThh:mm
    const toLocalISO = (d: Date) => {
      const tzoffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
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
      // Solo sobreescribir los inputs si el scheduler está actualmente corriendo
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
      alert("Error al intentar cambiar el estado del programador automático. Verifica las fechas.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleBox}>
          <Clock size={16} color="#0078d4" />
          <h3 style={styles.title}>Programador de Medición Continua</h3>
        </div>
        {status.is_running ? (
          <span style={styles.badgeActive}>EJECUTANDO</span>
        ) : (
          <span style={styles.badgeIdle}>DETENIDO</span>
        )}
      </div>

      <div style={styles.body}>
        <div style={{ ...styles.timeGrid, marginBottom: 12 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Sensor Objetivo</label>
            <select 
              value={sensorTarget}
              onChange={e => setSensorTarget(e.target.value)}
              style={styles.selectInput}
              disabled={status.is_running}
            >
              <option value="MS-711">MS-711 (UV-VIS-NIR)</option>
              <option value="MS-713">MS-713 (NIR ext.)</option>
              <option value="Merge">Fusión (Completo)</option>
            </select>
          </div>
          <div style={{ ...styles.formGroup, flex: 1, justifyContent: "flex-end" }}>
            <div style={styles.autoExposureBadge}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#eab308" }}></span>
              Auto-Exposición {status.last_exposure_ms ? `(${status.last_exposure_ms} ms)` : ""}
            </div>
          </div>
        </div>

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

          <div style={styles.formGroup}>
            <label style={styles.label}>Intervalo (min)</label>
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

        <div style={styles.warningBox}>
          <AlertTriangle size={14} color="#eab308" />
          <span style={styles.warningText}>
            En caso de error crítico (ej. desconexión), el sistema gatillará el protocolo de emergencia y generará un volcado de rescate automáticamente.
          </span>
        </div>

        <button 
          style={status.is_running ? styles.buttonStop : styles.buttonStart}
          onClick={handleToggleScheduler}
          disabled={isProcessing}
        >
          {status.is_running ? (
            <><Square size={14} fill="currentColor" /> Abortar Medición Continua</>
          ) : (
            <><Play size={14} fill="currentColor" /> Iniciar Protocolo de Medición</>
          )}
        </button>
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
    flex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #333333",
    backgroundColor: "#111111",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  titleBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    margin: 0,
  },
  badgeActive: {
    backgroundColor: "#0078d4",
    color: "#ffffff",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  badgeIdle: {
    backgroundColor: "#333333",
    color: "#888888",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  body: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  timeGrid: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  label: {
    color: "#888888",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  inputTime: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#ffffff",
    padding: "8px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
  inputNum: {
    padding: "6px 12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#e0e0e0",
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    width: "100%",
    outline: "none",
  },
  selectInput: {
    padding: "6px 12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#e0e0e0",
    borderRadius: 4,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    width: "100%",
    outline: "none",
    cursor: "pointer",
  },
  warningBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    border: "1px solid rgba(234, 179, 8, 0.3)",
    padding: "10px 12px",
    borderRadius: 4,
  },
  warningText: {
    color: "#eab308",
    fontSize: 11,
  },
  buttonStart: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    padding: "10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase",
  },
  buttonStop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "none",
    padding: "10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase",
  },
  autoExposureBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid rgba(234, 179, 8, 0.2)",
    fontWeight: 500,
  }
};
