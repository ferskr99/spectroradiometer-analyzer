import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { X, ZoomOut, Maximize, Move } from "lucide-react";

interface ExpandedGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  lines: { key: string; color: string; name: string }[];
  title: string;
}

const PAR_START = 400;
const PAR_END = 700;

export const ExpandedGraphModal: React.FC<ExpandedGraphModalProps> = ({
  isOpen,
  onClose,
  data,
  lines,
  title
}) => {
  if (!isOpen || !data || data.length === 0) return null;

  // Encontrar límites absolutos
  const globalXMin = data[0].wavelength;
  const globalXMax = data[data.length - 1].wavelength;

  const [xDomain, setXDomain] = useState<[number, number]>([globalXMin, globalXMax]);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  // Filtramos datos visibles para Y dinámico
  const visibleData = useMemo(() => {
    return data.filter(d => d.wavelength >= xDomain[0] && d.wavelength <= xDomain[1]);
  }, [data, xDomain]);

  const dynamicYMax = useMemo(() => {
    if (visibleData.length === 0) return 10;
    let max = 0;
    visibleData.forEach(d => {
      lines.forEach(line => {
        if (d[line.key] > max) max = d[line.key];
      });
    });
    return max * 1.05; // 5% de margen superior
  }, [visibleData, lines]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Zoom centrado
    const zoomFactor = 0.15;
    const isZoomOut = e.deltaY > 0;
    
    // Asumimos que el div mide aproximadamente window.innerWidth, pero podemos ser precisos
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left; // pixels desde la izquierda
    const widthPx = rect.width;
    
    // Proporción de donde está el cursor (0 a 1)
    const ratio = Math.max(0, Math.min(1, (cursorX - 60) / (widthPx - 80))); // 60 y 20 son margenes aproximados
    
    const currentRange = xDomain[1] - xDomain[0];
    const change = currentRange * zoomFactor;

    let newMin = xDomain[0];
    let newMax = xDomain[1];

    if (isZoomOut) {
      newMin = Math.max(globalXMin, xDomain[0] - change * ratio);
      newMax = Math.min(globalXMax, xDomain[1] + change * (1 - ratio));
    } else {
      newMin = xDomain[0] + change * ratio;
      newMax = xDomain[1] - change * (1 - ratio);
      // Limitar zoom maximo (ej. 10nm)
      if (newMax - newMin < 10) {
        newMin = xDomain[0];
        newMax = xDomain[1];
      }
    }

    setXDomain([newMin, newMax]);
  }, [xDomain, globalXMin, globalXMax]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const rect = e.currentTarget.getBoundingClientRect();
    const widthPx = rect.width;
    
    const range = xDomain[1] - xDomain[0];
    const dataUnitsPerPixel = range / widthPx;
    
    // Si muevo a la derecha (deltaX > 0), veo datos más a la izquierda (shift negativo)
    let shift = -(deltaX * dataUnitsPerPixel);
    
    // Limites globales (clamp shift)
    if (xDomain[0] + shift < globalXMin) {
      shift = globalXMin - xDomain[0];
    }
    if (xDomain[1] + shift > globalXMax) {
      shift = globalXMax - xDomain[1];
    }
    
    setXDomain([xDomain[0] + shift, xDomain[1] + shift]);
    setDragStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setXDomain([globalXMin, globalXMax]);
  };

  return createPortal(
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.titleBox}>
            <Maximize size={18} color="#0078d4" />
            <h2 style={styles.title}>{title}</h2>
          </div>
          <div style={styles.controls}>
            <span style={styles.hint}><Move size={12}/> Arrastrar para mover | Scrool para zoom</span>
            <button onClick={resetZoom} style={styles.iconBtn} title="Restablecer vista">
              <ZoomOut size={16} />
            </button>
            <button onClick={onClose} style={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div 
          style={{...styles.graphContainer, cursor: isDragging ? 'grabbing' : 'grab'}}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              
              <XAxis
                dataKey="wavelength"
                type="number"
                domain={xDomain}
                allowDataOverflow={true}
                tickCount={15}
                tick={{ fill: "#888", fontSize: 12, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#444" }}
                label={{
                  value: "Longitud de onda (nm)",
                  position: "insideBottom",
                  offset: -10,
                  style: { fill: "#aaa", fontSize: 12 }
                }}
              />
              
              <YAxis
                domain={[0, dynamicYMax]}
                allowDataOverflow={true}
                tick={{ fill: "#888", fontSize: 12, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#444" }}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
                label={{
                  value: "Irradiancia",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#aaa", fontSize: 12 }
                }}
              />
              
              <Tooltip 
                contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 4 }}
                itemStyle={{ color: "#eee" }}
                cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4' }} 
              />
              
              <ReferenceLine
                x={PAR_START}
                stroke="#666"
                strokeDasharray="4 4"
                label={{ value: "PAR", position: "top", fill: "#888", fontSize: 10 }}
              />
              <ReferenceLine
                x={PAR_END}
                stroke="#666"
                strokeDasharray="4 4"
                label={{ value: "Fin PAR", position: "top", fill: "#888", fontSize: 10 }}
              />

              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>,
    document.body
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#111111",
    border: "1px solid #333",
    borderRadius: 8,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    backgroundColor: "#1e1e1e",
    borderBottom: "1px solid #333",
  },
  titleBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 18,
    fontWeight: 600,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  hint: {
    color: "#888",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  graphContainer: {
    flex: 1,
    padding: "24px 24px 24px 0",
    position: "relative",
  },
};
