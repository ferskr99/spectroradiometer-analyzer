import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, History, Settings } from 'lucide-react';

export const Layout: React.FC = () => {
  return (
    <div style={styles.page}>
      <style>{globalCSS}</style>
      
      {/* Sidebar Navigation */}
      <nav style={styles.sidebar}>
        <div style={styles.logoSection} title="Spectroradiometer Analyzer v1.0.0">
          <Activity size={24} color="#e0e0e0" />
        </div>

        <div style={styles.navLinks}>
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
        </div>

        <div style={styles.bottomSection}>
          <div style={styles.navLink} title="Instrumento: EKO MS-711 / MS-712">
            <Settings size={20} />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={styles.contentArea}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.appTitle}>Spectroradiometer Analyzer</h1>
            <span style={styles.version}>v1.0.0</span>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.headerBadge}>
              <Settings size={14} /> EKO Instruments
            </div>
            <div style={styles.headerBadge}>
              MS-711 / MS-712
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
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    backgroundColor: "#111111",
  },
  sidebar: {
    width: 64,
    backgroundColor: "#161616",
    borderRight: "1px solid #2a2a2a",
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
    borderRadius: 8,
    color: "#666666",
    textDecoration: "none",
    transition: "all 0.2s ease",
    cursor: "pointer",
  },
  navLinkActive: {
    color: "#e0e0e0",
    backgroundColor: "#2a2a2a",
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
    overflowY: "auto",
  },
  // Reused header from Dashboard
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: 48,
    minHeight: 48,
    backgroundColor: "#161616",
    borderBottom: "1px solid #2a2a2a",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  appTitle: {
    color: "#e0e0e0",
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "0.01em",
  },
  version: {
    color: "#888888",
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
