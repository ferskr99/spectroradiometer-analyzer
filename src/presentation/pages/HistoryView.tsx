import React, { useState, useEffect } from 'react';
import { DataLog } from '../components/DataLog';
import { SpectralGraph } from '../components/SpectralGraph';
import { apiClient, AnalysisResult } from '../../infrastructure/api/api_client';
import { Activity } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [recordDetail, setRecordDetail] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedRecordId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const detail = await apiClient.getHistoryDetail(selectedRecordId);
        setRecordDetail(detail);
      } catch (error) {
        console.error("Error fetching record detail:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [selectedRecordId]);

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
      <div style={{...styles.layout, ...(selectedRecordId ? styles.layoutSplit : styles.layoutFull)}}>
        {/* Left Column: DataLog */}
        <div style={styles.leftColumn}>
          <DataLog 
            fullHeight={true} 
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
          />
        </div>

        {/* Right Column: Detail View (only shown if a record is selected) */}
        {selectedRecordId && (
          <div style={styles.rightColumn}>
            
            <div style={styles.detailHeaderCard}>
              <h3 style={styles.detailTitle}>
                Espectro de la Medición #{selectedRecordId}
              </h3>
              <button 
                style={styles.closeButton} 
                onClick={() => {
                  setSelectedRecordId(null);
                  setRecordDetail(null);
                }}
                title="Cerrar detalles"
              >
                ✕
              </button>
            </div>

            {isLoading ? (
              <div style={styles.loadingState}>
                <Activity size={24} className="spin" color="#666666" />
                <span>Cargando espectro...</span>
              </div>
            ) : (
              <div style={styles.graphContainer}>
                <SpectralGraph 
                  data={recordDetail?.merged_spectrum ?? null} 
                  isLoading={false} 
                  height={450} 
                />
                
                {recordDetail && (
                  <div style={styles.metricsGrid}>
                    <div style={styles.metricBox}>
                      <div style={styles.metricLabel}>PAR</div>
                      <div style={styles.metricValue}>{recordDetail.par.toFixed(2)} W/m²</div>
                    </div>
                    <div style={styles.metricBox}>
                      <div style={styles.metricLabel}>PPFD</div>
                      <div style={styles.metricValue}>{recordDetail.ppfd.toFixed(2)} µmol</div>
                    </div>
                    <div style={styles.metricBox}>
                      <div style={styles.metricLabel}>Iluminancia</div>
                      <div style={styles.metricValue}>{Math.round(recordDetail.illuminance)} lx</div>
                    </div>
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
    padding: "24px", // Remove max-width completely to use 100% of the monitor
    flex: 1,
    height: "calc(100vh - 48px)", // Viewport minus header
    overflow: "hidden", // Ensure main never scrolls, delegating scrolling to the table
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
    flexDirection: "row", // Side by side
  },
  leftColumn: {
    flex: 1.4, // Give the table significantly more space so all columns fit
    display: "flex",
    flexDirection: "column",
    minWidth: 700, // Ensure the table doesn't compress
    minHeight: 0,
    transition: "flex 0.3s ease",
  },
  rightColumn: {
    flex: 1, // Graph takes the rest
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 450, // Minimum for graph
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
