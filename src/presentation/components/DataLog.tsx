import React, { useEffect, useState, useRef } from "react";
import { Download, History, RefreshCcw, Zap, AlertTriangle, Radio } from "lucide-react";
import { apiClient, MeasurementRecord } from "../../infrastructure/api/api_client";

interface DataLogProps {
  fullHeight?: boolean;
  selectedRecordId?: number | null;
  onSelectRecord?: (id: number) => void;
  multiSelect?: boolean;
  selectedRecordIds?: number[];
  onToggleRecordSelection?: (id: number, selected: boolean) => void;
  onSetRecordSelection?: (ids: number[]) => void;
}

export const DataLog: React.FC<DataLogProps> = ({ 
  fullHeight = false,
  selectedRecordId = null,
  onSelectRecord,
  multiSelect = false,
  selectedRecordIds = [],
  onToggleRecordSelection,
  onSetRecordSelection
}) => {
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [isLoading, setIsLoading] = useState(false);

  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveModeRef = useRef(isLiveMode);
  useEffect(() => { liveModeRef.current = isLiveMode; }, [isLiveMode]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getHistory(page, limit);
      setHistory(data.items);
      setTotalRecords(data.total);
      return data.items;
    } catch (error) {
      console.error("Error fetching history", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const onMeasurementComplete = async () => {
      const items = await fetchHistory();
      if (liveModeRef.current && items.length > 0 && onToggleRecordSelection) {
        // En modo Live, seleccionar automáticamente la nueva medición
        onToggleRecordSelection(items[0].id, true);
      }
    };
    window.addEventListener("spectrometer:measurement_complete", onMeasurementComplete);
    
    fetchHistory();
    
    return () => {
      window.removeEventListener("spectrometer:measurement_complete", onMeasurementComplete);
    };
  }, [page, onToggleRecordSelection]);

  const handleSmartSelect = (mode: "Picos" | "Sensores") => {
    if (!onSetRecordSelection) return;
    if (mode === "Picos") {
      let maxId = history[0]?.id; let maxVal = -1;
      let minId = history[0]?.id; let minVal = Infinity;
      history.forEach(r => {
        if (r.par > maxVal) { maxVal = r.par; maxId = r.id; }
        if (r.par < minVal && r.par > 0) { minVal = r.par; minId = r.id; }
      });
      const selection = [];
      if (maxId) selection.push(maxId);
      if (minId && minId !== maxId) selection.push(minId);
      onSetRecordSelection(selection);
    } else if (mode === "Sensores") {
      const newestDirect = history.find(r => r.sensor_target === "Espectro Directo")?.id;
      const newestGlobal = history.find(r => r.sensor_target === "Espectro Global")?.id;
      const selection = [];
      if (newestDirect) selection.push(newestDirect);
      if (newestGlobal) selection.push(newestGlobal);
      onSetRecordSelection(selection);
    }
  };

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
        <div style={{ ...styles.actions, gap: 10 }}>
          {multiSelect && (
            <>
              <button 
                onClick={() => setIsLiveMode(!isLiveMode)}
                style={{...styles.exportButton, backgroundColor: isLiveMode ? "#ef4444" : "#333", border: isLiveMode ? "1px solid #dc2626" : "1px solid #444"}}
                title="Auto-seleccionar mediciones nuevas"
              >
                <Radio size={14} className={isLiveMode ? "pulse" : ""} />
                {isLiveMode ? "Live Tracking ON" : "Live Tracking OFF"}
              </button>
              <button onClick={() => handleSmartSelect("Picos")} style={styles.exportButton}>
                <Zap size={14} /> Picos RFA
              </button>
              <button onClick={() => handleSmartSelect("Sensores")} style={styles.exportButton}>
                <History size={14} /> Global vs Directo
              </button>
            </>
          )}
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

      <div className="custom-scrollbar" style={{...styles.tableContainer, ...(fullHeight ? { maxHeight: "none", flex: 1 } : { maxHeight: 180 })}}>
        <style>
          {`
            .pulse { animation: pulse-anim 2s infinite; }
            @keyframes pulse-anim { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            .anomaly-row { background-color: rgba(239, 68, 68, 0.1) !important; }
          `}
        </style>
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
              {history.map((record, index) => {
                const isActive = multiSelect ? selectedRecordIds.includes(record.id) : selectedRecordId === record.id;
                
                let hasAnomaly = false;
                if (index < history.length - 1) {
                  const olderRecord = history[index + 1];
                  if (olderRecord.total_irradiance > 0 && record.total_irradiance < olderRecord.total_irradiance * 0.7) {
                    hasAnomaly = true;
                  }
                }

                return (
                  <tr 
                    key={record.id} 
                    style={{
                      ...styles.tr,
                      ...((onSelectRecord || multiSelect) ? styles.trClickable : {}),
                      ...(isActive ? styles.trActive : {})
                    }}
                    className={hasAnomaly ? "anomaly-row" : ""}
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
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>
                      {hasAnomaly && (
                        <span title="Alerta: Caída brusca de irradiancia detectada">
                          <AlertTriangle size={14} color="#ef4444" style={{ marginRight: 4, verticalAlign: "middle" }} />
                        </span>
                      )}
                      #{record.id}
                    </td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>
                      {new Date(record.timestamp.endsWith('Z') ? record.timestamp : record.timestamp + 'Z').toLocaleString("es-MX", {
                        hour12: false,
                      })}
                    </td>
                    <td style={{...styles.td, ...(isActive ? styles.tdActive : {})}}>
                      {record.sensor_target === "Espectro Global" ? (
                        <span style={{ color: "#3b82f6", fontWeight: 600 }}>{record.sensor_target}</span>
                      ) : record.sensor_target === "Espectro Directo" ? (
                        <span style={{ color: "#f97316", fontWeight: 600 }}>{record.sensor_target}</span>
                      ) : record.sensor_target === "Adquisición Total" ? (
                        <span style={{ color: "#22c55e", fontWeight: 600 }}>{record.sensor_target}</span>
                      ) : (
                        record.sensor_target
                      )}
                    </td>
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

      {/* Paginación Clásica */}
      <div style={styles.pagination}>
        <div style={styles.paginationInfo}>
          Mostrando {history.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalRecords)} de {totalRecords} registros
        </div>
        <div style={styles.paginationControls}>
          <button 
            style={{...styles.pageButton, ...(page === 1 ? styles.pageButtonDisabled : {})}} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Anterior
          </button>
          <span style={styles.pageText}>
            Página {page} de {Math.ceil(totalRecords / limit) || 1}
          </span>
          <button 
            style={{...styles.pageButton, ...(page >= Math.ceil(totalRecords / limit) ? styles.pageButtonDisabled : {})}} 
            onClick={() => setPage(p => Math.min(Math.ceil(totalRecords / limit), p + 1))}
            disabled={page >= Math.ceil(totalRecords / limit)}
          >
            Siguiente →
          </button>
        </div>
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
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTop: "1px solid #333",
    flexWrap: "wrap",
    gap: 16,
  },
  paginationInfo: {
    fontSize: 12,
    color: "#888",
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  pageButton: {
    backgroundColor: "#111",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 4,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  pageText: {
    fontSize: 12,
    color: "#e0e0e0",
    fontWeight: 500,
  }
};

export default DataLog;
