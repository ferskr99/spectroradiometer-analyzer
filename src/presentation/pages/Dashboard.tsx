/**
 * Dashboard.tsx
 *
 * Vista principal de la cabina científica del espectrorradiómetro.
 * Ensambla ControlPanel, MetricsSummary y SpectralGraph en un layout
 * responsivo de dos columnas.
 *
 * Columna izquierda: Control + Métricas (panel lateral fijo).
 * Columna derecha: Gráfico espectral (área principal expandible).
 */

import React from "react";
import {
  useAnalyzeSpectrum,
  useConfigureSensor,
} from "../../application/hooks/useSpectrometer";
import type { SensorId } from "../../infrastructure/api";
import { ControlPanel } from "../components/ControlPanel";
import { MetricsSummary } from "../components/MetricsSummary";
import { SpectralGraph } from "../components/SpectralGraph";

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const {
    analyze,
    data,
    isPending,
    isError,
    error,
    isSuccess,
  } = useAnalyzeSpectrum();

  const { configure } = useConfigureSensor();

  const handleConfigure = (sensorId: SensorId, exposureMs: number) => {
    configure({ sensor_id: sensorId, exposure_time_ms: exposureMs });
  };

  return (
    <div style={styles.page}>
      {/* ─── Global CSS (animaciones keyframes) ────────────── */}
      <style>{globalCSS}</style>

      {/* ─── Header de la aplicación ───────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>◈</span>
            <h1 style={styles.appTitle}>Spectroradiometer Analyzer</h1>
          </div>
          <span style={styles.version}>v1.0.0</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.headerBadge}>
            <span style={styles.badgeDot} />
            EKO Instruments
          </div>
          <div style={styles.headerBadge}>
            MS-711 / MS-712
          </div>
        </div>
      </header>

      {/* ─── Contenido principal — Layout de dos columnas ──── */}
      <main style={styles.main}>
        {/* Columna izquierda: Control + Métricas */}
        <aside style={styles.sidebar}>
          <ControlPanel
            onAnalyze={analyze}
            onConfigure={handleConfigure}
            isPending={isPending}
            isSuccess={isSuccess}
            errorMessage={isError ? error?.message ?? "Error desconocido" : null}
          />

          <MetricsSummary
            data={data ?? null}
            isLoading={isPending}
          />
        </aside>

        {/* Columna derecha: Gráfico espectral */}
        <section style={styles.content}>
          <SpectralGraph
            data={data?.merged_spectrum ?? null}
            isLoading={isPending}
            height={540}
          />

          {/* Barra de estado inferior */}
          <div style={styles.statusBar}>
            <span style={styles.statusText}>
              {isPending
                ? "⏳ Captura en progreso — esperando respuesta del obturador..."
                : isSuccess && data
                  ? `✅ Última medición: ${data.merged_spectrum?.wavelengths.length ?? 0} puntos espectrales adquiridos`
                  : isError
                    ? "❌ Error en la última medición"
                    : "⬜ Listo para iniciar medición"}
            </span>
            <span style={styles.statusTimestamp}>
              {new Date().toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────── */}
      <footer style={styles.footer}>
        <span>Arquitectura Hexagonal · React + FastAPI + NumPy/SciPy</span>
        <span>Tesis — Análisis de Irradiancia Espectral</span>
      </footer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// CSS global (animaciones keyframes requeridas por los componentes)
// ─────────────────────────────────────────────────────────────────────

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: #020617;
    color: #f1f5f9;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  /* Estilizar slider en navegadores WebKit */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: #1e293b;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #0f172a;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
    transition: all 0.15s ease;
  }
  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(59, 130, 246, 0.6);
  }
  input[type="range"]:disabled::-webkit-slider-thumb {
    background: #475569;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Firefox */
  input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #0f172a;
  }

  /* Ocultar flechas del input numérico */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
  }

  /* Scrollbar estilizada */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #0f172a;
  }
  ::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
  }
`;

// ─────────────────────────────────────────────────────────────────────
// Estilos del layout
// ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#020617",
  },

  // Header
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    backgroundColor: "#0f172a",
    borderBottom: "1px solid #1e293b",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    fontSize: 22,
    color: "#3b82f6",
    fontWeight: 700,
  },
  appTitle: {
    color: "#f1f5f9",
    fontSize: 17,
    fontWeight: 700,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  version: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    backgroundColor: "#1e293b",
    padding: "2px 8px",
    borderRadius: 4,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#64748b",
    fontSize: 12,
    padding: "4px 12px",
    backgroundColor: "#1e293b",
    borderRadius: 6,
    border: "1px solid #334155",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#10b981",
    display: "inline-block",
  },

  // Main layout
  main: {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: 20,
    padding: 20,
    flex: 1,
    minHeight: 0,
  },

  // Sidebar (columna izquierda)
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto" as const,
    maxHeight: "calc(100vh - 130px)",
    paddingRight: 4,
  },

  // Content (columna derecha)
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },

  // Status bar
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    border: "1px solid #1e293b",
  },
  statusText: {
    color: "#64748b",
    fontSize: 12,
  },
  statusTimestamp: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },

  // Footer
  footer: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 24px",
    borderTop: "1px solid #1e293b",
    color: "#334155",
    fontSize: 11,
  },
};

export default Dashboard;
