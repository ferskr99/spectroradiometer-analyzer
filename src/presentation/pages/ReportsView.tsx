import React, { useState } from 'react';
import { FileText, Download, Search, CheckSquare, Square, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../infrastructure/api/api_client';

interface HistoryRecord {
  id: number;
  timestamp: string;
  sensor_target: string;
  exposure_time_ms: number;
  par: number;
  ppfd: number;
  illuminance: number;
  total_irradiance: number;
}

export const ReportsView: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reportTitle, setReportTitle] = useState('Informe de Mediciones Espectrales');
  const [reportAuthor, setReportAuthor] = useState('Investigador EKO');
  const [reportNotes, setReportNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Utilizamos el método público del cliente de API
  const { data: records = [], isLoading } = useQuery<HistoryRecord[]>({
    queryKey: ['history', 'list'],
    queryFn: () => apiClient.getHistory(100) as unknown as Promise<HistoryRecord[]>,
  });

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  const handleGenerateReport = async () => {
    if (selectedIds.length === 0) return;
    
    setIsGenerating(true);
    try {
      const blob = await apiClient.generateReport({
        ids: selectedIds,
        title: reportTitle,
        author: reportAuthor,
        notes: reportNotes
      });
      
      // Crear un enlace temporal para descargar el Blob
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${new Date().getTime()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al generar el reporte:", error);
      alert("Hubo un error al generar el reporte. Verifica la consola.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>
          <FileText size={20} style={{ marginRight: 8 }} />
          Generación de Reportes
        </h2>
        <button 
          style={{
            ...styles.generateBtn, 
            opacity: selectedIds.length === 0 || isGenerating ? 0.5 : 1,
            cursor: selectedIds.length === 0 || isGenerating ? 'not-allowed' : 'pointer'
          }}
          onClick={handleGenerateReport}
          disabled={selectedIds.length === 0 || isGenerating}
        >
          <Download size={16} />
          {isGenerating ? 'Generando PDF...' : `Generar PDF (${selectedIds.length})`}
        </button>
      </div>

      <div style={styles.content}>
        {/* Panel Izquierdo: Configuración del Reporte */}
        <div style={styles.configPanel}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Configuración del Informe</h3>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Título del Reporte</label>
              <input 
                type="text" 
                style={styles.input} 
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
                placeholder="Ej. Análisis de campo Día 1"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Autor / Investigador</label>
              <input 
                type="text" 
                style={styles.input} 
                value={reportAuthor}
                onChange={e => setReportAuthor(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Notas u Observaciones (Opcional)</label>
              <textarea 
                style={styles.textarea} 
                value={reportNotes}
                onChange={e => setReportNotes(e.target.value)}
                placeholder="Condiciones climáticas, configuración del experimento, etc."
                rows={4}
              />
            </div>
            
            <div style={styles.infoBox}>
              <Info size={16} color="#3b82f6" />
              <p style={styles.infoText}>
                El PDF incluirá un resumen tabular de todas las mediciones seleccionadas y una página de detalle con los valores radiométricos completos para cada espectro.
              </p>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Selección de Mediciones */}
        <div style={styles.selectionPanel}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Mediciones a Incluir</h3>
              <div style={styles.searchBox}>
                <Search size={14} color="#888888" />
                <input type="text" placeholder="Buscar ID..." style={styles.searchInput} />
              </div>
            </div>

            <div style={styles.tableContainer}>
              {isLoading ? (
                <div style={styles.loading}>Cargando mediciones...</div>
              ) : (
                <table style={styles.table}>
                  <thead style={styles.thead}>
                    <tr>
                      <th style={styles.thCheck} onClick={toggleAll}>
                        {selectedIds.length === records.length && records.length > 0 ? (
                          <CheckSquare size={16} color="#3b82f6" />
                        ) : (
                          <Square size={16} color="#555555" />
                        )}
                      </th>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Fecha (UTC)</th>
                      <th style={styles.th}>Sensor</th>
                      <th style={styles.th}>Irradiancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const isSelected = selectedIds.includes(r.id);
                      return (
                        <tr 
                          key={r.id} 
                          style={{
                            ...styles.tr, 
                            backgroundColor: isSelected ? '#3b82f615' : 'transparent'
                          }}
                          onClick={() => toggleSelection(r.id)}
                        >
                          <td style={styles.tdCheck}>
                            {isSelected ? (
                              <CheckSquare size={16} color="#3b82f6" />
                            ) : (
                              <Square size={16} color="#555555" />
                            )}
                          </td>
                          <td style={styles.tdId}>#{r.id}</td>
                          <td style={styles.td}>
                            {new Date(r.timestamp).toLocaleDateString()} {new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td style={styles.td}>{r.sensor_target}</td>
                          <td style={styles.td}>{r.total_irradiance.toFixed(2)} W/m²</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: 'flex',
    flexDirection: 'column',
    padding: '32px',
    flex: 1,
    height: 'calc(100vh - 48px)',
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: '16px',
    borderBottom: "1px solid #333333",
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 24px',
    backgroundColor: '#0078d4',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    transition: 'background-color 0.1s ease',
  },
  content: {
    display: 'flex',
    gap: 28,
    flex: 1,
    minHeight: 0,
  },
  configPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  selectionPanel: {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  card: {
    backgroundColor: "#1e1e1e",
    border: '1px solid #333333',
    borderRadius: 4,
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 24px 0',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 24,
  },
  label: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: 600,
  },
  input: {
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: 4,
    padding: '12px 16px',
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.1s ease',
  },
  textarea: {
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: 4,
    padding: '12px 16px',
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',
    transition: 'border-color 0.1s ease',
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: 4,
    padding: '20px',
    marginTop: 'auto',
  },
  infoText: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: 4,
    padding: '8px 14px',
    width: 240,
    transition: 'border-color 0.1s ease',
  },
  searchInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  },
  tableContainer: {
    flex: 1,
    overflowY: 'auto',
    border: '1px solid #333333',
    borderRadius: 4,
    backgroundColor: '#111111',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thead: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#1e1e1e',
    zIndex: 1,
  },
  th: {
    padding: '14px 16px',
    color: '#cccccc',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    borderBottom: '1px solid #333333',
  },
  thCheck: {
    padding: '14px 16px',
    width: 48,
    borderBottom: '1px solid #333333',
    cursor: 'pointer',
  },
  tr: {
    borderBottom: '1px solid #333333',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  },
  td: {
    padding: '14px 16px',
    color: '#ffffff',
    fontSize: 13,
  },
  tdCheck: {
    padding: '14px 16px',
  },
  tdId: {
    padding: '14px 16px',
    color: '#888888',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
  },
  loading: {
    padding: 32,
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 500,
  },
};

export default ReportsView;
