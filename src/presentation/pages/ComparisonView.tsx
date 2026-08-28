import React, { useState, useEffect } from "react";
import { DataLog } from "../components/DataLog";
import { SuperimposedGraph } from "../components/SuperimposedGraph";
import { apiClient } from "../../infrastructure/api/api_client";
import type { AnalysisResult } from "../../infrastructure/api/api_client";
import { Layers } from "lucide-react";

export const ComparisonView: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dataDict, setDataDict] = useState<Record<string, AnalysisResult>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSelection = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      if (selected) {
        // Limitar a 10 selecciones para no saturar el gráfico
        if (prev.length >= 10) return prev;
        return [...prev, id];
      } else {
        return prev.filter((item) => item !== id);
      }
    });
  };

  useEffect(() => {
    const fetchBatch = async () => {
      if (selectedIds.length === 0) {
        setDataDict({});
        return;
      }

      setIsLoading(true);
      try {
        const results = await apiClient.getHistoryBatch(selectedIds);
        setDataDict(results);
      } catch (error) {
        console.error("Error fetching batch history", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatch();
  }, [selectedIds]);

  return (
    <main style={styles.main}>
      <style>
        {`
          @keyframes slideInRight {
            0% { opacity: 0; transform: translateX(40px); }
            100% { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
      <div style={{...styles.layout, ...(selectedIds.length > 0 ? styles.layoutSplit : styles.layoutFull)}}>
        {/* Left Column: DataLog */}
        <div style={styles.leftColumn}>
          <DataLog 
            fullHeight={true} 
            multiSelect={true}
            selectedRecordIds={selectedIds}
            onToggleRecordSelection={handleToggleSelection}
          />
        </div>

        {/* Right Column: Detail View (only shown if a record is selected) */}
        {selectedIds.length > 0 && (
          <div style={styles.rightColumn}>
            
            <div style={styles.detailHeaderCard}>
              <h3 style={styles.detailTitle}>
                Comparación Espectral ({selectedIds.length} seleccionadas)
              </h3>
              <button 
                style={styles.closeButton} 
                onClick={() => setSelectedIds([])}
                title="Limpiar selección"
              >
                ✕
              </button>
            </div>

            <div style={styles.graphContainer}>
              <SuperimposedGraph 
                dataDict={dataDict} 
                isLoading={isLoading} 
                height={550} 
              />
            </div>

          </div>
        )}
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "flex",
    flexDirection: "column",
    padding: "24px", 
    flex: 1,
    height: "calc(100vh - 48px)", 
    overflow: "hidden", 
  },
  layout: {
    display: "flex",
    gap: 24,
    height: "100%",
    minHeight: 0,
    transition: "all 0.3s ease",
  },
  layoutFull: {
    flexDirection: "row",
  },
  layoutSplit: {
    flexDirection: "row", 
  },
  leftColumn: {
    flex: 1.4, 
    display: "flex",
    flexDirection: "column",
    minWidth: 700, 
    minHeight: 0,
    transition: "flex 0.3s ease",
  },
  rightColumn: {
    flex: 1, 
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 450, 
    minHeight: 0,
    animation: "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
  },
  detailHeaderCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "16px 20px",
  },
  detailTitle: {
    color: "#e0e0e0",
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "#888888",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s",
  },
  graphContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
};
