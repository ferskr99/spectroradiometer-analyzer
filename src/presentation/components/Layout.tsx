import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, History, Settings, Layers, Cpu, Award, FileText, Menu, ChevronLeft } from 'lucide-react';
import { SplashScreen } from './SplashScreen';
import { useAppWebSocket } from '../../application/hooks/useWebSocket';

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/history", icon: History, label: "Historial" },
  { to: "/diagnostics", icon: Cpu, label: "Diagnóstico" },
  { to: "/calibration", icon: Award, label: "Calibración" },
  { to: "/reports", icon: FileText, label: "Reportes" },
];

const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 220;
const TRANSITION_MS = 280;

export const Layout: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  useAppWebSocket();

  const sidebarWidth = expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

  return (
    <div style={styles.page} className="app-page">
      <SplashScreen />
      <style>{globalCSS}</style>
      
      {/* Sidebar Navigation */}
      <nav
        style={{
          ...styles.sidebar,
          width: sidebarWidth,
        }}
        className="app-sidebar"
        onMouseLeave={() => expanded && setExpanded(false)}
      >
        {/* Logo + Toggle */}
        <div style={styles.logoSection}>
          <button
            onClick={() => setExpanded(prev => !prev)}
            style={styles.toggleBtn}
            title={expanded ? "Contraer menú" : "Expandir menú"}
          >
            {expanded ? (
              <ChevronLeft size={20} color="#e0e0e0" />
            ) : (
              <Menu size={20} color="#e0e0e0" />
            )}
          </button>
          {expanded && (
            <span style={styles.logoText}>Menú</span>
          )}
        </div>

        {/* Nav Links */}
        <div style={styles.navLinks} className="nav-links">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
                justifyContent: expanded ? "flex-start" : "center",
                paddingLeft: expanded ? 16 : 0,
              })}
              title={expanded ? undefined : item.label}
            >
              <item.icon size={20} style={{ flexShrink: 0 }} />
              <span
                style={{
                  ...styles.linkLabel,
                  opacity: expanded ? 1 : 0,
                  width: expanded ? "auto" : 0,
                  marginLeft: expanded ? 14 : 0,
                }}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>

        {/* Bottom - Settings */}
        <div style={styles.bottomSection} className="bottom-section">
          <NavLink
            to="/settings"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
              justifyContent: expanded ? "flex-start" : "center",
              paddingLeft: expanded ? 16 : 0,
            })}
            title={expanded ? undefined : "Configuración"}
          >
            <Settings size={20} style={{ flexShrink: 0 }} />
            <span
              style={{
                ...styles.linkLabel,
                opacity: expanded ? 1 : 0,
                width: expanded ? "auto" : 0,
                marginLeft: expanded ? 14 : 0,
              }}
            >
              Configuración
            </span>
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

  /* Sidebar transition */
  .app-sidebar {
    transition: width ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
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
      transition: none !important;
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
    backgroundColor: "#1a1a1a",
    borderRight: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 0",
    flexShrink: 0,
    zIndex: 10,
    overflow: "hidden",
  },
  logoSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
    width: "100%",
    paddingLeft: 20,
    paddingRight: 12,
    minHeight: 32,
  },
  logoText: {
    color: "#e0e0e0",
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    letterSpacing: "-0.01em",
  },
  toggleBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  navLinks: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
    width: "100%",
    padding: "0 12px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 40,
    borderRadius: 8,
    color: "#888888",
    textDecoration: "none",
    transition: "background-color 0.15s ease, color 0.15s ease",
    cursor: "pointer",
    overflow: "hidden",
  },
  navLinkActive: {
    color: "#ffffff",
    backgroundColor: "#0078d4",
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    transition: `opacity ${TRANSITION_MS}ms ease, margin ${TRANSITION_MS}ms ease`,
  },
  bottomSection: {
    marginTop: "auto",
    width: "100%",
    padding: "0 12px",
    borderTop: "1px solid #252525",
    paddingTop: 12,
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
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid #2a2a2a",
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
