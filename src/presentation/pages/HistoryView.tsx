import React, { useState, useEffect } from 'react';
import { DataLog } from '../components/DataLog';
import { SpectralGraph } from '../components/SpectralGraph';
import { SuperimposedGraph } from '../components/SuperimposedGraph';
import { apiClient, AnalysisResult } from '../../infrastructure/api/api_client';
import { Activity } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dataDict, setDataDict] = useState<Record<string, AnalysisResult>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSelection = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      if (selected) {
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

  const hasSelection = selectedIds.length > 0;
  const isSingleSelection = selectedIds.length === 1;
  const singleRecordDetail = isSingleSelection ? dataDict[selectedIds[0]] : null;

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
      <div style={{...styles.layout, ...(hasSelection ? styles.layoutSplit : styles.layoutFull)}}>
        {/* Left Column: DataLog */}
        <div style={styles.leftColumn}>
          <DataLog 
            fullHeight={true} 
            multiSelect={true}
            selectedRecordIds={selectedIds}
            onToggleRecordSelection={handleToggleSelection}
          />
        </div>

        {/* Right Column: Detail View (only shown if records are selected) */}
        {hasSelection && (
          <div style={styles.rightColumn}>
            
            <div style={styles.detailHeaderCard}>
              <h3 style={styles.detailTitle}>
                {isSingleSelection 
                  ? `Espectro de la Medición #${selectedIds[0]}` 
                  : `Comparación Espectral (${selectedIds.length} seleccionadas)`}
              </h3>
              <button 
                style={styles.closeButton} 
                onClick={() => {
                  setSelectedIds([]);
                  setDataDict({});
                }}
                title="Limpiar selección"
              >
                ✕
              </button>
            </div>

            {isLoading ? (
              <div style={styles.loadingState}>
                <Activity size={24} className="spin" color="#666666" />
                <span>Procesando datos espectrales...</span>
              </div>
            ) : (
              <div style={styles.graphContainer}>
                {isSingleSelection ? (
                  <SpectralGraph 
                    data={singleRecordDetail?.merged_spectrum ?? null} 
                    isLoading={false} 
                    height={450} 
                  />
                ) : (
                  <SuperimposedGraph 
                    dataDict={dataDict} 
                    isLoading={false} 
                    height={450} 
                  />
                )}
                
                {hasSelection && Object.keys(dataDict).length > 0 && (
                  <div style={{ marginTop: 24, overflowY: "auto", paddingRight: 8, flex: 1, minHeight: 0 }}>
                    {selectedIds.map(id => {
                      const record = dataDict[id];
                      if (!record) return null;
                      return (
                        <div key={id} style={{ marginBottom: 20 }}>
                          <h4 style={{ color: '#cccccc', fontSize: 12, marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>
                            DATOS REGISTRADOS — MEDICIÓN #{id}
                          </h4>
                          <div style={styles.metricsGrid}>
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Radiación PAR</div>
                              <div style={styles.metricValue}>{record.par.toFixed(2)} <span style={{fontSize: 12, color: "#888"}}>W/m²</span></div>
                            </div>
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Flujo Fotones (PPFD)</div>
                              <div style={styles.metricValue}>{record.ppfd.toFixed(2)} <span style={{fontSize: 12, color: "#888"}}>µmol</span></div>
                            </div>
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Iluminancia</div>
                              <div style={styles.metricValue}>{Math.round(record.illuminance)} <span style={{fontSize: 12, color: "#888"}}>lx</span></div>
                            </div>
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Irradiancia Total</div>
                              <div style={styles.metricValue}>{record.total_irradiance.toFixed(2)} <span style={{fontSize: 12, color: "#888"}}>W/m²</span></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
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
  loadingState: {
    height: 450,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "#888888",
    fontSize: 13,
  },
  graphContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  metricsGrid: {
    display: "flex",
    gap: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metricLabel: {
    color: "#888888",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  metricValue: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
  }
};

export default HistoryView;
