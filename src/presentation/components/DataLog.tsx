import React, { useEffect, useState } from "react";
import { Download, History, RefreshCcw } from "lucide-react";
import { apiClient, MeasurementRecord } from "../../infrastructure/api/api_client";

interface DataLogProps {
  fullHeight?: boolean;
  selectedRecordId?: number | null;
  onSelectRecord?: (id: number) => void;
  multiSelect?: boolean;
  selectedRecordIds?: number[];
  onToggleRecordSelection?: (id: number, selected: boolean) => void;
}

export const DataLog: React.FC<DataLogProps> = ({ 
  fullHeight = false,
  selectedRecordId = null,
  onSelectRecord,
  multiSelect = false,
  selectedRecordIds = [],
  onToggleRecordSelection
}) => {
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getHistory(500); // Get more records for full view
      setHistory(data);
    } catch (error) {
      console.error("Error fetching history", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Escuchar el evento personalizado de medición exitosa
    const onMeasurementComplete = () => fetchHistory();
    window.addEventListener("spectrometer:measurement_complete", onMeasurementComplete);
    
    fetchHistory();
    
    return () => {
      window.removeEventListener("spectrometer:measurement_complete", onMeasurementComplete);
    };
  }, []);

  const hasSelection = multiSelect && selectedRecordIds.length > 0;

  const handleExport = () => {
    if (hasSelection) {
      window.location.href = apiClient.getHistoryBatchCsvUrl(selectedRecordIds);
    } else {
      window.location.href = apiClient.getHistoryCsvUrl();
    }
  };

  return (
    <div style={{...styles.container, ...(fullHeight ? { flex: 1 } : {})}}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <History size={14} style={{ marginRight: 6 }} />
          Registro de Mediciones (Data Logger)
        </h3>
        <div style={styles.actions}>
          <button onClick={fetchHistory} style={styles.iconButton} title="Refrescar">
            <RefreshCcw size={14} />
          </button>
          <button 
            onClick={handleExport} 
            style={{...styles.exportButton, ...(hasSelection ? styles.exportButtonActive : {})}}
          >
            <Download size={14} />
            {hasSelection ? `Exportar Selección (${selectedRecordIds.length})` : "Exportar Todo a CSV"}
          </button>
        </div>
      </div>

      <div style={{...styles.tableContainer, ...(fullHeight ? { maxHeight: "none", flex: 1 } : { maxHeight: 180 })}}>
        {isLoading && history.length === 0 ? (
          <div style={styles.emptyState}>Cargando...</div>
        ) : history.length === 0 ? (
          <div style={styles.emptyState}>No hay mediciones registradas.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {multiSelect && <th style={{...styles.th, width: 40}}></th>}
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Fecha y Hora</th>
                <th style={styles.th}>Modo</th>
                <th style={styles.th}>Exp (ms)</th>
                <th style={styles.th}>PAR (W/m²)</th>
                <th style={styles.th}>PPFD (µmol)</th>
                <th style={styles.th}>Total (W/m²)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => {
                const isActive = multiSelect ? selectedRecordIds.includes(record.id) : selectedRecordId === record.id;
                return (
                  <tr 
                    key={record.id} 
                    style={{
                      ...styles.tr,
                      ...((onSelectRecord || multiSelect) ? styles.trClickable : {}),
                      ...(isActive ? styles.trActive : {})
                    }}
                    onClick={() => {
                      if (multiSelect && onToggleRecordSelection) {
                        onToggleRecordSelection(record.id, !isActive);
                      } else if (onSelectRecord) {
                        onSelectRecord(record.id);
                      }
                    }}
                  >
                    {multiSelect && (
                      <td style={styles.tdCheckbox}>
                        <input 
                          type="checkbox" 
                          checked={isActive} 
                          onChange={(e) => onToggleRecordSelection?.(record.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          style={styles.checkbox}
                        />
                      </td>
                    )}
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>#{record.id}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>
                      {new Date(record.timestamp.endsWith('Z') ? record.timestamp : record.timestamp + 'Z').toLocaleString("es-MX", {
                        hour12: false,
                      })}
                    </td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.sensor_target}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.exposure_time_ms}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.par.toFixed(3)}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.ppfd.toFixed(3)}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.total_irradiance.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    color: "#e0e0e0",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    gap: 12,
  },
  iconButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px",
    backgroundColor: "transparent",
    border: "1px solid #333333",
    borderRadius: 4,
    color: "#888888",
    cursor: "pointer",
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#333333",
    color: "#e0e0e0",
    border: "1px solid #444444",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  exportButtonActive: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    borderColor: "#3b82f6",
  },
  tableContainer: {
    overflowX: "auto",
    overflowY: "auto",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    minHeight: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
  th: {
    padding: "10px 14px",
    borderBottom: "1px solid #2a2a2a",
    backgroundColor: "#1c1c1c",
    color: "#888888",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #2a2a2a",
    transition: "background-color 0.2s",
  },
  trClickable: {
    cursor: "pointer",
  },
  trActive: {
    backgroundColor: "#2a2a2a",
    borderLeft: "3px solid #3b82f6",
  },
  td: {
    padding: "10px 14px",
    color: "#e0e0e0",
    whiteSpace: "nowrap",
  },
  tdActive: {
    fontWeight: 600,
    color: "#ffffff",
  },
  emptyState: {
    padding: "40px",
    textAlign: "center",
    color: "#666666",
    fontSize: 13,
  },
  tdCheckbox: {
    padding: "10px 14px",
    width: 40,
    textAlign: "center",
  },
  checkbox: {
    cursor: "pointer",
    width: 16,
    height: 16,
    accentColor: "#3b82f6",
  },
};

export default DataLog;
