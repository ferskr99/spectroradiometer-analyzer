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
                <th style={styles.th}>Sensor</th>
                <th style={styles.th}>Origen</th>
                <th style={styles.th}>Exp (ms)</th>
                <th style={styles.th}>RFA (W/m²)</th>
                <th style={styles.th}>DFFF (µmol)</th>
                <th style={styles.th}>Ilumin. (lx)</th>
                <th style={styles.th}>Total (W/m²)</th>
                <th style={styles.th}>AP (cm)</th>
                <th style={styles.th}>EOA</th>
                <th style={styles.th}>ACS (°)</th>
                <th style={styles.th}>MA</th>
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
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>
                      {record.measurement_mode === "Continua (Programada)" ? (
                        <span style={styles.badgeContinua}>Continua</span>
                      ) : (
                        <span style={styles.badgeManual}>Manual</span>
                      )}
                    </td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.exposure_time_ms}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.par?.toFixed(3) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.ppfd?.toFixed(3) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.illuminance?.toFixed(2) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.total_irradiance?.toFixed(3) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.pwv_cm?.toFixed(4) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.aod_nm500?.toFixed(4) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.sza?.toFixed(2) ?? "N/A"}</td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>{record.air_mass?.toFixed(2) ?? "N/A"}</td>
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
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
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
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
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
    transition: "background-color 0.1s ease",
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#111111",
    color: "#cccccc",
    border: "1px solid #333333",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.1s ease",
    whiteSpace: "nowrap",
  },
  exportButtonActive: {
    backgroundColor: "#0078d4",
    color: "#ffffff",
    borderColor: "#0078d4",
  },
  tableContainer: {
    overflowX: "auto",
    overflowY: "auto",
    border: "1px solid #333333",
    borderRadius: 4,
    minHeight: 0,
    backgroundColor: "#111111",
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
    borderBottom: "1px solid #333333",
    backgroundColor: "#1e1e1e",
    color: "#cccccc",
    fontWeight: 600,
    textTransform: "uppercase",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #333333",
    transition: "background-color 0.1s ease",
  },
  trClickable: {
    cursor: "pointer",
  },
  trActive: {
    backgroundColor: "#1e1e1e",
    borderLeft: "3px solid #0078d4",
  },
  td: {
    padding: "10px 14px",
    color: "#ffffff",
    whiteSpace: "nowrap",
  },
  tdActive: {
    fontWeight: 600,
  },
  emptyState: {
    padding: "40px",
    textAlign: "center",
    color: "#888888",
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
    accentColor: "#0078d4",
  },
  badgeManual: {
    backgroundColor: "#333333",
    color: "#aaaaaa",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  badgeContinua: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    color: "#eab308",
    border: "1px solid rgba(234, 179, 8, 0.3)",
    padding: "3px 7px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
  },
};

export default DataLog;
