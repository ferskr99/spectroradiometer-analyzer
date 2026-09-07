import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, History, Settings, Layers, Cpu, Award, FileText } from 'lucide-react';
import { SplashScreen } from './SplashScreen';
import { useAppWebSocket } from '../../application/hooks/useWebSocket';

export const Layout: React.FC = () => {
  // Mantener la conexión WS global mientras la app esté abierta
  useAppWebSocket();
  return (
    <div style={styles.page} className="app-page">
      <SplashScreen />
      <style>{globalCSS}</style>
      
      {/* Sidebar Navigation */}
      <nav style={styles.sidebar} className="app-sidebar">
        <div style={styles.logoSection} className="logo-section" title="Spectroradiometer Analyzer v1.0.0">
          <Activity size={24} color="#e0e0e0" />
        </div>

        <div style={styles.navLinks} className="nav-links">
          <NavLink 
            to="/" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Panel Principal"
          >
            <LayoutDashboard size={20} />
          </NavLink>
          
          <NavLink 
            to="/history" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Registro de Datos"
          >
            <History size={20} />
          </NavLink>

          <NavLink 
            to="/diagnostics" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Salud y Diagnóstico"
          >
            <Cpu size={20} />
          </NavLink>

          <NavLink 
            to="/calibration" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Calibración"
          >
            <Award size={20} />
          </NavLink>

          <NavLink 
            to="/reports" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Reportes PDF"
          >
            <FileText size={20} />
          </NavLink>
        </div>

        <div style={styles.bottomSection} className="bottom-section">
          <NavLink 
            to="/settings" 
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {})
            })}
            title="Configuración"
          >
            <Settings size={20} />
          </NavLink>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={styles.contentArea} className="app-content">
        <header style={styles.header} className="app-header">
          <div style={styles.headerLeft}>
            <h1 style={styles.appTitle}>Spectroradiometer Analyzer</h1>
            <span style={styles.version}>v1.0.0</span>
          </div>
          <div style={styles.headerRight} className="header-right">
            <div style={styles.headerBadge}>
              <Settings size={14} /> EKO Instruments
            </div>
            <div style={styles.headerBadge}>
              MS-711 / MS-713
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: #111111;
    color: #e0e0e0;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Slider plano */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: #333333;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #e0e0e0;
    cursor: pointer;
    border: 1px solid #111111;
    transition: transform 0.1s ease;
  }
  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
  input[type="range"]:disabled::-webkit-slider-thumb {
    background: #555555;
    cursor: not-allowed;
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
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #111111;
  }
  ::-webkit-scrollbar-thumb {
    background: #333333;
    border-radius: 4px;
  }

  /* ─── Responsive Breakpoints ──────────────────────────────── */

  /* Tablets y pantallas medianas (< 1200px) */
  @media (max-width: 1200px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    .top-row {
      flex-direction: column !important;
    }
  }

  /* Pantallas pequeñas (< 768px) */
  @media (max-width: 768px) {
    .app-page {
      flex-direction: column !important;
    }
    .app-sidebar {
      width: 100% !important;
      height: 56px !important;
      flex-direction: row !important;
      border-right: none !important;
      border-bottom: 1px solid #333333 !important;
      padding: 0 8px !important;
      overflow-x: auto !important;
    }
    .app-sidebar .logo-section {
      margin-bottom: 0 !important;
      margin-right: 16px !important;
    }
    .nav-links {
      flex-direction: row !important;
      gap: 4px !important;
      flex: 1 !important;
    }
    .bottom-section {
      margin-top: 0 !important;
      margin-left: auto !important;
    }
    .app-content {
      height: auto !important;
      min-height: calc(100vh - 56px) !important;
    }
    .app-header {
      padding: 0 12px !important;
    }
    .header-right {
      display: none !important;
    }
    .main-dashboard {
      padding: 12px !important;
      gap: 12px !important;
    }
    .metrics-grid {
      grid-template-columns: 1fr !important;
    }
    .spectral-graph-container {
      height: 280px !important;
    }
    .settings-grid {
      grid-template-columns: 1fr !important;
    }
  }

  /* Pantallas muy pequeñas (< 480px) */
  @media (max-width: 480px) {
    .metrics-grid {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }
    .app-header h1 {
      font-size: 12px !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    backgroundColor: "#111111",
  },
  sidebar: {
    width: 64,
    backgroundColor: "#1e1e1e",
    borderRight: "1px solid #333333",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 0",
    flexShrink: 0,
    zIndex: 10,
  },
  logoSection: {
    marginBottom: 32,
    cursor: "help",
  },
  navLinks: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 4,
    color: "#888888",
    textDecoration: "none",
    transition: "background-color 0.1s ease, color 0.1s ease",
    cursor: "pointer",
  },
  navLinkActive: {
    color: "#ffffff",
    backgroundColor: "#0078d4",
  },
  bottomSection: {
    marginTop: "auto",
  },
  contentArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100vh",
    overflowY: "hidden",
    backgroundColor: "#111111",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: 48,
    minHeight: 48,
    backgroundColor: "#1e1e1e",
    borderBottom: "1px solid #333333",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  appTitle: {
    color: "#cccccc",
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
  },
  version: {
    color: "#666666",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#888888",
    fontSize: 12,
  },
};
