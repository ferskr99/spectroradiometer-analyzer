import React, { useState, useEffect } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import {
  Navigation, MapPin, Clock, Move, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, X, CheckCircle, AlertCircle, Loader,
  Mountain, Target
} from "lucide-react";

interface TrackerCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackState = { type: "idle" } | { type: "loading"; msg: string } | { type: "success"; msg: string } | { type: "error"; msg: string };

export const TrackerCalibrationModal: React.FC<TrackerCalibrationModalProps> = ({ isOpen, onClose }) => {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [elevation, setElevation] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle" });

  useEffect(() => {
    if (isOpen) {
      loadSavedLocation();
    }
  }, [isOpen]);

  const loadSavedLocation = async () => {
    try {
      const res = await apiClient.getTrackerLocation();
      if (res.status === "configured" && res.location) {
        setLatitude(String(res.location.latitude));
        setLongitude(String(res.location.longitude));
        setElevation(String(res.location.elevation));
      }
    } catch {
      // No location saved yet, leave fields empty
    }
  };

  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback({ type: "idle" }), 4000);
  };

  // ── SYNC_TIME ──────────────────────────────────────────────────────
  const handleSyncTime = async () => {
    setFeedback({ type: "loading", msg: "Sincronizando reloj RTC…" });
    try {
      const res = await apiClient.calibrateTracker({ command: "SYNC_TIME" });
      showFeedback("success", res.message);
    } catch (err: any) {
      showFeedback("error", err?.message || "Error al sincronizar el reloj.");
    }
  };

  // ── SET_LOCATION ───────────────────────────────────────────────────
  const handleSetLocation = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const elev = parseFloat(elevation) || 0;

    if (isNaN(lat) || isNaN(lon)) {
      showFeedback("error", "Ingrese valores numéricos válidos para latitud y longitud.");
      return;
    }
    if (lat < -90 || lat > 90) {
      showFeedback("error", "Latitud fuera de rango (-90° a 90°).");
      return;
    }
    if (lon < -180 || lon > 180) {
      showFeedback("error", "Longitud fuera de rango (-180° a 180°).");
      return;
    }

    setFeedback({ type: "loading", msg: "Enviando coordenadas al tracker…" });
    try {
      const res = await apiClient.calibrateTracker({
        command: "SET_LOCATION",
        latitude: lat,
        longitude: lon,
        elevation: elev,
      });
      showFeedback("success", res.message);
    } catch (err: any) {
      showFeedback("error", err?.message || "Error al configurar la ubicación.");
    }
  };

  // ── AUTO-ALIGN (Hill-Climbing) ─────────────────────────────────────
  const handleAutoAlign = async () => {
    setFeedback({ type: "loading", msg: "Iniciando escaneo espiral..." });
    try {
      const res = await apiClient.calibrateTracker({ command: "AUTO_ALIGN" });
      showFeedback("success", res.message);
    } catch (err: any) {
      showFeedback("error", err?.message || "Error durante el auto-alineamiento.");
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={styles.headerIcon}>
              <Navigation size={20} color="#eab308" />
            </div>
            <div>
              <h2 style={styles.headerTitle}>Calibración del Sun Tracker</h2>
              <p style={styles.headerSub}>STR-22G / STR-32G — Control RS-232C</p>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Feedback Banner */}
        {feedback.type !== "idle" && (
          <div style={{
            ...styles.feedbackBanner,
            backgroundColor: feedback.type === "loading" ? "rgba(59,130,246,0.1)" : feedback.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            borderColor: feedback.type === "loading" ? "rgba(59,130,246,0.25)" : feedback.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
            color: feedback.type === "loading" ? "#60a5fa" : feedback.type === "success" ? "#10b981" : "#ef4444",
          }}>
            {feedback.type === "loading" && <Loader size={14} className="spin" />}
            {feedback.type === "success" && <CheckCircle size={14} />}
            {feedback.type === "error" && <AlertCircle size={14} />}
            <span>{feedback.msg}</span>
          </div>
        )}

        <div style={styles.body}>
          {/* ── Sección 1: Ubicación GPS ──────────────────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <MapPin size={16} color="#f43f5e" />
              <h3 style={styles.sectionTitle}>Ubicación del Sitio</h3>
            </div>
            <p style={styles.sectionDesc}>
              Coordenadas geográficas del punto de instalación. Estas se escriben en la EEPROM del tracker para el cálculo de posición solar.
            </p>
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Latitud (°)</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.0001"
                  min={-90}
                  max={90}
                  placeholder="-12.0464"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Longitud (°)</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.0001"
                  min={-180}
                  max={180}
                  placeholder="-77.0428"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>
                  <Mountain size={12} style={{ marginRight: 4 }} />
                  Elevación (m)
                </label>
                <input
                  style={styles.input}
                  type="number"
                  step="1"
                  placeholder="154"
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value)}
                />
              </div>
            </div>
            <button
              style={styles.actionBtn}
              onClick={handleSetLocation}
              disabled={feedback.type === "loading"}
            >
              <MapPin size={14} />
              Enviar Ubicación al Tracker
            </button>
          </div>

          {/* ── Sección 2: Sincronización de Reloj ─────────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Clock size={16} color="#60a5fa" />
              <h3 style={styles.sectionTitle}>Reloj RTC Interno</h3>
            </div>
            <p style={styles.sectionDesc}>
              Sincroniza el reloj de tiempo real (RTC) del tracker con la hora UTC del servidor. Esto es crucial para que el cálculo de la posición solar sea preciso.
            </p>
            <button
              style={{ ...styles.actionBtn, backgroundColor: "rgba(59,130,246,0.15)", borderColor: "rgba(59,130,246,0.3)", color: "#60a5fa" }}
              onClick={handleSyncTime}
              disabled={feedback.type === "loading"}
            >
              <Clock size={14} />
              Sincronizar Hora (UTC)
            </button>
          </div>

          {/* ── Sección 3: Auto-Alineamiento Inteligente ──────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Target size={16} color="#a855f7" />
              <h3 style={styles.sectionTitle}>Auto-Alineamiento Solar (Hill-Climbing)</h3>
            </div>
            <p style={styles.sectionDesc}>
              Ejecuta un escaneo espiral autónomo de los motores. El software evaluará la intensidad radiométrica en tiempo real y fijará el tracker en la coordenada de irradiancia máxima para lograr un enganche perfecto.
            </p>
            
            <button
              style={{ ...styles.actionBtn, backgroundColor: "rgba(168, 85, 247, 0.15)", borderColor: "rgba(168, 85, 247, 0.3)", color: "#a855f7", marginTop: 12, justifyContent: "center" }}
              onClick={handleAutoAlign}
              disabled={feedback.type === "loading"}
            >
              <Target size={14} />
              Iniciar Búsqueda Espiral y Bloquear Coordenadas
            </button>
          </div>
        </div>

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Estilos (glassmorphism + dark theme consistente con el proyecto)
// ─────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9999,
    backgroundColor: "rgba(0,0,0,0.65)",
    backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "fadeIn 0.2s ease-out",
  },
  modal: {
    backgroundColor: "rgba(22,22,22,0.95)",
    border: "1px solid rgba(234,179,8,0.2)",
    borderRadius: 16,
    width: "100%",
    maxWidth: 620,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(234,179,8,0.08)",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #333",
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(234,179,8,0.1)",
    border: "1px solid rgba(234,179,8,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: "#e0e0e0", letterSpacing: "-0.02em" },
  headerSub: { margin: "2px 0 0 0", fontSize: 12, color: "#888" },
  closeBtn: {
    background: "none", border: "none", color: "#888",
    cursor: "pointer", padding: 4, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  feedbackBanner: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 24px", fontSize: 13, fontWeight: 500,
    borderBottom: "1px solid",
  },
  body: { padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 24 },
  section: {
    backgroundColor: "rgba(255,255,255,0.02)",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 20,
  },
  sectionHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: "#e0e0e0" },
  sectionDesc: { margin: "0 0 16px 0", fontSize: 12, color: "#888", lineHeight: 1.5 },
  inputRow: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 130 },
  inputLabel: { fontSize: 11, fontWeight: 500, color: "#aaa", display: "flex", alignItems: "center" },
  input: {
    backgroundColor: "#111", border: "1px solid #444", color: "#e0e0e0",
    borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none",
    transition: "border-color 0.2s",
    fontFamily: "'JetBrains Mono', monospace",
  },
  actionBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "10px 16px",
    backgroundColor: "rgba(234,179,8,0.12)",
    border: "1px solid rgba(234,179,8,0.25)",
    color: "#eab308",
    borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s",
  },
  jogContainer: {
    display: "flex", justifyContent: "center", gap: 48, padding: "8px 0",
  },
  jogColumn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  },
  jogLabel: { fontSize: 11, fontWeight: 600, color: "#a855f7", letterSpacing: "0.05em", textTransform: "uppercase" },
  jogBtn: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.08)",
    border: "1px solid rgba(168,85,247,0.25)",
    color: "#a855f7",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
    fontSize: 18,
  },
  jogCenter: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.05)",
    border: "1px solid rgba(168,85,247,0.15)",
    color: "#666",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700,
  },
};
