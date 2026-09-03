import React, { useState, useEffect } from "react";
import { apiClient } from "../../infrastructure/api/api_client";
import { Settings, Play, Square, Clock, Usb } from "lucide-react";

export const SettingsView: React.FC = () => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>
          <Settings size={20} color="#8b5cf6" />
        </div>
        <div>
          <h2 style={styles.title}>Configuración y Automatización</h2>
          <p style={styles.subtitle}>Ajustes de hardware y medición por intervalos (Scheduled Measurement)</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Panel de Hardware */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleBox}>
              <Usb size={18} color="#888" />
              <h3 style={styles.cardTitle}>Configuración de Puertos (Hardware)</h3>
            </div>
          </div>
          <div style={styles.cardBody}>
            <p style={styles.description}>Selecciona el puerto COM correspondiente a cada espectrorradiómetro conectado.</p>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>MS-711 COM Port</label>
              <select style={styles.select} defaultValue="COM3">
                <option value="COM1">COM1</option>
                <option value="COM2">COM2</option>
                <option value="COM3">COM3 (Simulado)</option>
                <option value="COM4">COM4</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>MS-712 COM Port</label>
              <select style={styles.select} defaultValue="COM4">
                <option value="COM1">COM1</option>
                <option value="COM2">COM2</option>
                <option value="COM3">COM3</option>
                <option value="COM4">COM4 (Simulado)</option>
              </select>
            </div>
            
            <button style={styles.buttonSecondary}>Guardar Configuración</button>
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
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    border: "1px solid rgba(139, 92, 246, 0.2)",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: 24,
  },
  card: {
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2a2a2a",
    padding: "16px 24px",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  cardTitleBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: "#e0e0e0",
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
  },
  cardBody: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  description: {
    color: "#888888",
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    color: "#a0a0a0",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#e0e0e0",
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
  },
  input: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#e0e0e0",
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
  },
  buttonSecondary: {
    backgroundColor: "#2a2a2a",
    color: "#e0e0e0",
    border: "none",
    padding: "12px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  buttonStart: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    padding: "12px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  buttonStop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "none",
    padding: "12px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  badgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  badgeIdle: {
    backgroundColor: "rgba(136, 136, 136, 0.15)",
    color: "#888888",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
};
