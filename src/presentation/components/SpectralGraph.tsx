import React, { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SpectralData } from "../../infrastructure/api";
import { Loader2, Activity, Maximize2 } from "lucide-react";
import { ExpandedGraphModal } from "./ExpandedGraphModal";

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface SpectralGraphProps {
  data: SpectralData | null;
  globalData?: SpectralData | null;
  directData?: SpectralData | null;
  diffuseData?: SpectralData | null;
  crossMetrics?: any | null;
  rawSpectra?: Record<string, SpectralData> | null;
  sensorTarget?: "Global" | "Direct" | "All" | string;
  isLoading: boolean;
  height?: number | string;
}

// ─────────────────────────────────────────────────────────────────────
// Constantes de dominio y paleta cromática
// ─────────────────────────────────────────────────────────────────────

const PAR_START = 400;
const PAR_END = 700;

export const SPECTRUM_COLORS = {
  global: "#00d2ff",  // Cyan Eléctrico (Espectro Global GHI)
  direct: "#f97316",  // Naranja Ámbar Solar (Espectro Directo DNI)
  diffuse: "#a855f7", // Púrpura Radiométrico (Espectro Difuso DHI)
} as const;

// ─────────────────────────────────────────────────────────────────────
// Subcomponentes internos
// ─────────────────────────────────────────────────────────────────────

const LoadingOverlay: React.FC = () => (
  <div style={styles.loadingOverlay}>
    <div style={styles.spinnerContainer}>
      <Loader2 size={32} className="spin-icon" color="#888888" />
      <p style={styles.loadingText}>Adquiriendo Espectro</p>
    </div>
    <style>{`.spin-icon { animation: spin 1s linear infinite; }`}</style>
  </div>
);

const EmptyState: React.FC<{ height?: number | string }> = ({ height = 300 }) => (
  <div style={{ ...styles.emptyState, height }}>
    <Activity size={32} color="#333333" />
    <p style={styles.emptyTitle}>Sin datos espectrales</p>
  </div>
);

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string; color?: string }>;
  label?: string | number;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const wavelength = Number(label);

  let region = "IOC (Infrarrojo de Onda Corta)";
  if (wavelength < 400) region = "UV (Ultravioleta)";
  else if (wavelength <= 700) region = "Visible / RFA";
  else if (wavelength <= 1100) region = "IRC (Infrarrojo Cercano)";

  return (
    <div style={styles.tooltip}>
      <div style={{ margin: "0 0 8px 0", color: "#cccccc", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #333", paddingBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span>Longitud de onda: <strong style={{ color: "#ffffff" }}>{wavelength.toFixed(1)} nm</strong></span>
        <span style={styles.tooltipRegion}>{region}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {payload.map((entry, idx) => {
          let labelName = "Irradiancia";
          let color = entry.color || "#ffffff";
          
          if (entry.dataKey === "irradiance_global") {
            labelName = "Espectro Global (GHI)";
            color = SPECTRUM_COLORS.global;
          } else if (entry.dataKey === "irradiance_direct") {
            labelName = "Espectro Directo (DNI)";
            color = SPECTRUM_COLORS.direct;
          } else if (entry.dataKey === "irradiance_diffuse") {
            labelName = "Espectro Difuso (DHI)";
            color = SPECTRUM_COLORS.diffuse;
          } else if (entry.dataKey === "raw_711_global") {
            labelName = "Crudo 711 G (VIS-NIR)";
            color = "#60a5fa";
          } else if (entry.dataKey === "raw_713_global") {
            labelName = "Crudo 713 G (SWIR)";
            color = "#3b82f6";
          } else if (entry.dataKey === "raw_711_direct") {
            labelName = "Crudo 711 D (VIS-NIR)";
            color = "#fb923c";
          } else if (entry.dataKey === "raw_713_direct") {
            labelName = "Crudo 713 D (SWIR)";
            color = "#f97316";
          }

          const val = Number(entry.value ?? 0);
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 12, color, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
                {labelName}:
              </span>
              <span style={{ fontSize: 12, color: "#ffffff", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                {val.toFixed(4)} W/m²/µm
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

export const SpectralGraph: React.FC<SpectralGraphProps> = ({
  data,
  globalData,
  directData,
  diffuseData,
  crossMetrics,
  rawSpectra,
  sensorTarget = "All",
  isLoading,
  height = 420,
}) => {
  const isGlobalAvailable = sensorTarget === "Global" || sensorTarget === "All" || !!globalData;
  const isDirectAvailable = sensorTarget === "Direct" || sensorTarget === "All" || !!directData;
  const isDiffuseAvailable = sensorTarget === "All" || !!diffuseData;
  const hasRaw711G = !!rawSpectra?.["MS-711_GLOBAL"];
  const hasRaw713G = !!rawSpectra?.["MS-713_GLOBAL"];
  const hasRaw711D = !!rawSpectra?.["MS-711_DIRECT"];
  const hasRaw713D = !!rawSpectra?.["MS-713_DIRECT"];

  const [showGlobal, setShowGlobal] = useState(true);
  const [showDirect, setShowDirect] = useState(true);
  const [showDiffuse, setShowDiffuse] = useState(true);


  // Sincronizar visibilidad de toggles al cambiar de modo de medición
  useEffect(() => {
    if (sensorTarget === "Global") {
      setShowGlobal(true);
      setShowDirect(false);
      setShowDiffuse(false);
    } else if (sensorTarget === "Direct") {
      setShowGlobal(false);
      setShowDirect(true);
      setShowDiffuse(false);
    } else if (sensorTarget === "All") {
      setShowGlobal(true);
      setShowDirect(true);
      setShowDiffuse(true);
    }
  }, [sensorTarget]);


  const weatherStatus = useMemo(() => {
    if (!crossMetrics || !crossMetrics.clearness_index) return null;
    const kt = crossMetrics.clearness_index;
    if (kt < 0.35) return { label: "Cielo Nublado", color: "#ef4444", icon: "☁️" };
    if (kt < 0.65) return { label: "Nubosidad Parcial", color: "#eab308", icon: "⛅" };
    return { label: "Cielo Despejado", color: "#10b981", icon: "☀️" };
  }, [crossMetrics]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Unificación de datasets espectrales por longitud de onda
  const chartData = useMemo(() => {
    const gData = globalData || (sensorTarget === "Global" ? data : null);
    const dData = directData || (sensorTarget === "Direct" ? data : null);
    const dfData = diffuseData;

    if (!gData && !dData && !dfData && !data) return [];

    const wavelengthMap = new Map<
      number,
      {
        wavelength: number;
        irradiance_global?: number;
        irradiance_direct?: number;
        irradiance_diffuse?: number;
        raw_711_global?: number;
        raw_713_global?: number;
        raw_711_direct?: number;
        raw_713_direct?: number;
      }
    >();

    const addSeries = (sd: SpectralData | null | undefined, key: string) => {
      if (!sd || !sd.wavelengths) return;
      for (let i = 0; i < sd.wavelengths.length; i += 2) {
        const wl = sd.wavelengths[i];
        const existing: any = wavelengthMap.get(wl) || { wavelength: wl };
        existing[key] = sd.irradiance[i];
        wavelengthMap.set(wl, existing);
      }
    };

    addSeries(gData, "irradiance_global");
    addSeries(dData, "irradiance_direct");
    addSeries(dfData, "irradiance_diffuse");


    // Fallback si data principal es el único disponible
    if (wavelengthMap.size === 0 && data && data.wavelengths) {
      for (let i = 0; i < data.wavelengths.length; i += 2) {
        const wl = data.wavelengths[i];
        if (sensorTarget === "Global") {
          wavelengthMap.set(wl, { wavelength: wl, irradiance_global: data.irradiance[i] });
        } else if (sensorTarget === "Direct") {
          wavelengthMap.set(wl, { wavelength: wl, irradiance_direct: data.irradiance[i] });
        } else {
          wavelengthMap.set(wl, { wavelength: wl, irradiance_global: data.irradiance[i] });
        }
      }
    }

    return Array.from(wavelengthMap.values()).sort((a, b) => a.wavelength - b.wavelength);
  }, [data, globalData, directData, diffuseData,
  crossMetrics, sensorTarget, rawSpectra]);

  // Escala Y dinámica considerando únicamente las series visibles
  const dynamicYMax = useMemo(() => {
    if (chartData.length === 0) return 10;
    let max = 0;
    chartData.forEach((d) => {
      if (showGlobal && isGlobalAvailable && d.irradiance_global && d.irradiance_global > max) {
        max = d.irradiance_global;
      }
      if (showDirect && isDirectAvailable && d.irradiance_direct && d.irradiance_direct > max) {
        max = d.irradiance_direct;
      }
      if (showDiffuse && isDiffuseAvailable && d.irradiance_diffuse && d.irradiance_diffuse > max) {
        max = d.irradiance_diffuse;
      }
    });
    return max > 0 ? max * 1.05 : 10;
  }, [chartData, showGlobal, showDirect, showDiffuse, isGlobalAvailable, isDirectAvailable, isDiffuseAvailable]);

  // Líneas dinámicas para el Modal de Zoom
  const modalLines = useMemo(() => {
    const lines = [];
    if (isGlobalAvailable && showGlobal) {
      lines.push({ key: "irradiance_global", color: SPECTRUM_COLORS.global, name: "Espectro Global (GHI)" });
    }
    if (isDirectAvailable && showDirect) {
      lines.push({ key: "irradiance_direct", color: SPECTRUM_COLORS.direct, name: "Espectro Directo (DNI)" });
    }
    if (isDiffuseAvailable && showDiffuse) {
      lines.push({ key: "irradiance_diffuse", color: SPECTRUM_COLORS.diffuse, name: "Espectro Difuso (DHI)" });
    }
    if (lines.length === 0) {
      lines.push({ key: "irradiance_global", color: SPECTRUM_COLORS.global, name: "Espectro Global" });
    }
    return lines;
  }, [isGlobalAvailable, isDirectAvailable, isDiffuseAvailable, showGlobal, showDirect, showDiffuse]);

  if (!data && !globalData && !directData && !isLoading) {
    return <EmptyState height={height} />;
  }

  return (
    <>
      <div style={{ ...styles.container, height }}>
        <div style={styles.header}>
          <h3 style={styles.title}>Distribución de Energía Espectral</h3>
          
          {/* Checks dinámicos e interactivos según el modo de medición */}
          <div style={{ display: "flex", gap: 14, marginLeft: "auto", alignItems: "center" }}>
            {sensorTarget === "Global" && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showGlobal ? SPECTRUM_COLORS.global : "#666" }}>
                <input
                  type="checkbox"
                  checked={showGlobal}
                  onChange={(e) => setShowGlobal(e.target.checked)}
                  style={{ accentColor: SPECTRUM_COLORS.global, cursor: "pointer" }}
                />
                Espectro Global (GHI)
              </label>
            )}

            {sensorTarget === "Direct" && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showDirect ? SPECTRUM_COLORS.direct : "#666" }}>
                <input
                  type="checkbox"
                  checked={showDirect}
                  onChange={(e) => setShowDirect(e.target.checked)}
                  style={{ accentColor: SPECTRUM_COLORS.direct, cursor: "pointer" }}
                />
                Espectro Directo (DNI)
              </label>
            )}

            {sensorTarget === "All" && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showGlobal ? SPECTRUM_COLORS.global : "#666" }}>
                  <input
                    type="checkbox"
                    checked={showGlobal}
                    onChange={(e) => setShowGlobal(e.target.checked)}
                    style={{ accentColor: SPECTRUM_COLORS.global, cursor: "pointer" }}
                  />
                  Espectro Global (GHI)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showDirect ? SPECTRUM_COLORS.direct : "#666" }}>
                  <input
                    type="checkbox"
                    checked={showDirect}
                    onChange={(e) => setShowDirect(e.target.checked)}
                    style={{ accentColor: SPECTRUM_COLORS.direct, cursor: "pointer" }}
                  />
                  Espectro Directo (DNI)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: showDiffuse ? SPECTRUM_COLORS.diffuse : "#666" }}>
                  <input
                    type="checkbox"
                    checked={showDiffuse}
                    onChange={(e) => setShowDiffuse(e.target.checked)}
                    style={{ accentColor: SPECTRUM_COLORS.diffuse, cursor: "pointer" }}
                  />
                  Espectro Difuso (DHI)
                </label>
              </>
            )}
          </div>


          <div style={styles.actions}>
            {weatherStatus && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: weatherStatus.color + "20", border: `1px solid ${weatherStatus.color}40`, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: weatherStatus.color, marginRight: 16 }}>
                <span>{weatherStatus.icon}</span> {weatherStatus.label}
              </div>
            )}

            <button 
              style={styles.actionBtn} 
              onClick={() => setIsModalOpen(true)}
              title="Expandir gráfico"
            >
              <Maximize2 size={16} color="#888888" />
            </button>
          </div>
        </div>

        <div style={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 30, bottom: 20 }}
            >
              <defs>
                <linearGradient id="globalFillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SPECTRUM_COLORS.global} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SPECTRUM_COLORS.global} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="directFillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SPECTRUM_COLORS.direct} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SPECTRUM_COLORS.direct} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="diffuseFillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SPECTRUM_COLORS.diffuse} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SPECTRUM_COLORS.diffuse} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />

              <XAxis
                dataKey="wavelength"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDataOverflow={true}
                tickCount={15}
                tick={{ fill: "#666666", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#333333" }}
                label={{
                  value: "Longitud de onda (nm)",
                  position: "insideBottom",
                  offset: -10,
                  style: { fill: "#888888", fontSize: 11, fontWeight: 500, textTransform: "uppercase" },
                }}
              />

              <YAxis
                domain={[0, dynamicYMax]}
                allowDataOverflow={true}
                tick={{ fill: "#666666", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#333333" }}
                width={70}
                tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}
                label={{
                  value: "Irradiancia (W/m²/µm)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -10,
                  style: { fill: "#888888", fontSize: 11, fontWeight: 500, textTransform: "uppercase" },
                }}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444', strokeWidth: 1, strokeDasharray: '4 4' }} />

              <ReferenceLine
                x={PAR_START}
                stroke="#666666"
                strokeDasharray="4 4"
                label={{ value: "Inicio RFA", position: "top", fill: "#888888", fontSize: 9 }}
              />
              <ReferenceLine
                x={PAR_END}
                stroke="#666666"
                strokeDasharray="4 4"
                label={{ value: "Fin RFA", position: "top", fill: "#888888", fontSize: 9 }}
              />
              
              {/* Espectro Global (GHI) */}
              {isGlobalAvailable && showGlobal && (
                <Area
                  type="linear"
                  dataKey="irradiance_global"
                  name="Espectro Global"
                  stroke={SPECTRUM_COLORS.global}
                  fill="url(#globalFillGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: SPECTRUM_COLORS.global, stroke: "#111111", strokeWidth: 2 }}
                  isAnimationActive={!isLoading}
                  animationDuration={400}
                />
              )}

              {/* Espectro Directo (DNI) */}
              {isDirectAvailable && showDirect && (
                <Area
                  type="linear"
                  dataKey="irradiance_direct"
                  name="Espectro Directo"
                  stroke={SPECTRUM_COLORS.direct}
                  fill="url(#directFillGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: SPECTRUM_COLORS.direct, stroke: "#111111", strokeWidth: 2 }}
                  isAnimationActive={!isLoading}
                  animationDuration={400}
                />
              )}

              {/* Espectro Difuso (DHI) */}
              {isDiffuseAvailable && showDiffuse && (
                <Area
                  type="linear"
                  dataKey="irradiance_diffuse"
                  name="Espectro Difuso"
                  stroke={SPECTRUM_COLORS.diffuse}
                  fill="url(#diffuseFillGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: SPECTRUM_COLORS.diffuse, stroke: "#111111", strokeWidth: 2 }}
                  isAnimationActive={!isLoading}
                  animationDuration={400}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>

          {isLoading && <LoadingOverlay />}
        </div>

        {/* Legend block removed to clean up UI */}
      </div>

      <ExpandedGraphModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={chartData}
        lines={modalLines}
        title="Distribución Espectral de Irradiancia"
      />
    </>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={styles.legendItem}>
    <div style={{ ...styles.legendDot, backgroundColor: color }} />
    <span style={styles.legendLabel}>{label}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    padding: "20px 24px 12px",
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #333333",
  },
  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  chartWrapper: {
    flex: 1,
    minHeight: 0,
    position: "relative" as const,
    width: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    borderRadius: 4,
    zIndex: 10,
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#cccccc",
    fontSize: 13,
    fontWeight: 500,
    textTransform: "uppercase",
    margin: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 4,
    border: "1px solid #333333",
    gap: 12,
  },
  emptyTitle: {
    color: "#888888",
    fontSize: 13,
    fontWeight: 500,
    margin: 0,
    textTransform: "uppercase",
  },
  tooltip: {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "10px 14px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
  },
  tooltipRegion: {
    fontSize: 10,
    color: "#ffffff",
    backgroundColor: "#333333",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    paddingTop: 8,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  legendLabel: {
    color: "#888888",
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 500,
  },
};

export default SpectralGraph;
