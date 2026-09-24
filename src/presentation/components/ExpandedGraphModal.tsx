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

const CustomExpandedTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const xValue = Number(label);
  const yValue = payload[0].value as number;

  return (
    <div style={{
      backgroundColor: "#111111",
      border: "1px solid #333333",
      borderRadius: 6,
      padding: "12px 16px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
    }}>
      <p style={{ margin: "0 0 8px 0", color: "#cccccc", fontSize: 13, fontWeight: 600, borderBottom: "1px solid #333", paddingBottom: 6 }}>
        Punto de Medición
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#ffffff", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          (X, Y) = ({xValue.toFixed(1)}, {yValue.toFixed(4)})
        </p>
        <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: "2px solid #333", display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#888888", fontFamily: "'JetBrains Mono', monospace" }}>
            <strong style={{ color: "#aaa" }}>X:</strong> {xValue.toFixed(1)} nm <span style={{ fontSize: 9 }}>(Longitud de onda)</span>
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "#888888", fontFamily: "'JetBrains Mono', monospace" }}>
            <strong style={{ color: "#aaa" }}>Y:</strong> {yValue.toFixed(4)} W/m²/µm <span style={{ fontSize: 9 }}>(Irradiancia)</span>
          </p>
        </div>
      </div>
    </div>
  );
};

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


  const dynamicYMax = useMemo(() => {
    if (data.length === 0) return 10;
    let max = 0;
    data.forEach(d => {
      lines.forEach(line => {
        if (d[line.key] > max) max = d[line.key];
      });
    });
    return max * 1.05; // 5% de margen superior
  }, [data, lines]);

  return createPortal(
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.titleBox}>
            <Maximize size={18} color="#0078d4" />
            <h2 style={styles.title}>{title}</h2>
          </div>
          <div style={styles.controls}>
            <button onClick={onClose} style={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={styles.graphContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              
              <XAxis
                dataKey="wavelength"
                type="number"
                domain={[globalXMin, globalXMax]}
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
                content={<CustomExpandedTooltip />}
                cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4' }} 
              />
              
              <ReferenceLine
                x={PAR_START}
                stroke="#666"
                strokeDasharray="4 4"
                label={{ value: "Inicio RFA", position: "top", fill: "#888", fontSize: 10 }}
              />
              <ReferenceLine
                x={PAR_END}
                stroke="#666"
                strokeDasharray="4 4"
                label={{ value: "Fin RFA", position: "top", fill: "#888", fontSize: 10 }}
              />

              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="linear"
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
