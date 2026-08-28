import React, { useEffect, useState } from 'react';
import { Award, Shield, ShieldAlert, ShieldCheck, Clock, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../infrastructure/api/api_client';

interface CalibrationCoefficient {
  wavelength_nm: number;
  sensitivity: number;
  offset: number;
}

interface SensorCalibration {
  last_calibration: string;
  next_calibration: string;
  days_remaining: number;
  days_since: number;
  progress_pct: number;
  status: 'valid' | 'warning' | 'expired';
  serial_number: string;
  coefficients: CalibrationCoefficient[];
}

interface CalibrationHistory {
  date: string;
  sensor: string;
  performed_by: string;
  type: string;
}

interface CalibrationData {
  ms711: SensorCalibration;
  ms712: SensorCalibration;
  calibration_history: CalibrationHistory[];
}

export const CalibrationView: React.FC = () => {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalibration = async () => {
      try {
        const result = await apiClient.getCalibrationStatus();
        setData(result);
      } catch (error) {
        console.error("Error fetching calibration data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCalibration();
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'valid') return '#22c55e';
    if (status === 'warning') return '#eab308';
    return '#ef4444';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'valid') return <ShieldCheck size={20} color="#22c55e" />;
    if (status === 'warning') return <ShieldAlert size={20} color="#eab308" />;
    return <Shield size={20} color="#ef4444" />;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'valid') return 'Calibración Vigente';
    if (status === 'warning') return 'Próxima a Vencer';
    return 'Calibración Expirada';
  };

  const renderSensorCard = (sensorId: string, sensor: SensorCalibration) => {
    const isExpanded = expandedSensor === sensorId;
    const color = getStatusColor(sensor.status);

    return (
      <div key={sensorId} style={styles.sensorCard}>
        <div style={styles.sensorHeader}>
          <div style={styles.sensorTitleRow}>
            {getStatusIcon(sensor.status)}
            <div>
              <h3 style={styles.sensorName}>{sensorId.toUpperCase()}</h3>
              <span style={styles.serialNumber}>S/N: {sensor.serial_number}</span>
            </div>
          </div>
          <div style={{...styles.statusBadge, backgroundColor: color + '20', color: color, borderColor: color + '40'}}>
            {getStatusLabel(sensor.status)}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={styles.progressSection}>
          <div style={styles.progressLabels}>
            <span style={styles.progressLabel}>
              <Clock size={12} style={{ marginRight: 4 }} />
              {sensor.days_since} días desde última calibración
            </span>
            <span style={{...styles.progressLabel, color}}>
              {sensor.days_remaining} días restantes
            </span>
          </div>
          <div style={styles.progressBarBg}>
            <div style={{
              ...styles.progressBarFill,
              width: `${sensor.progress_pct}%`,
              backgroundColor: color,
            }} />
          </div>
        </div>

        {/* Dates */}
        <div style={styles.datesRow}>
          <div style={styles.dateBox}>
            <span style={styles.dateLabel}>Última Calibración</span>
            <span style={styles.dateValue}>
              {new Date(sensor.last_calibration).toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div style={styles.dateBox}>
            <span style={styles.dateLabel}>Próxima Calibración</span>
            <span style={{...styles.dateValue, color}}>
              {new Date(sensor.next_calibration).toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Expandable Coefficients */}
        <button 
          style={styles.expandButton}
          onClick={() => setExpandedSensor(isExpanded ? null : sensorId)}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? 'Ocultar Coeficientes' : 'Ver Coeficientes de Calibración'}
        </button>

        {isExpanded && (
          <div style={styles.coefficientsTable}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>λ (nm)</th>
                  <th style={styles.th}>Sensibilidad</th>
                  <th style={styles.th}>Offset</th>
                </tr>
              </thead>
              <tbody>
                {sensor.coefficients.map((c) => (
                  <tr key={c.wavelength_nm} style={styles.tr}>
                    <td style={styles.td}>{c.wavelength_nm}</td>
                    <td style={styles.td}>{c.sensitivity.toFixed(5)}</td>
                    <td style={styles.td}>{c.offset.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <main style={styles.main}>
        <div style={styles.loadingState}>Cargando datos de calibración...</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={styles.main}>
        <div style={styles.loadingState}>Error al cargar datos de calibración.</div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      {/* Page Header */}
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>
          <Award size={20} style={{ marginRight: 8 }} />
          Gestión de Calibración
        </h2>
        <button style={styles.uploadButton}>
          <Upload size={14} />
          Cargar Archivo de Calibración
        </button>
      </div>

      {/* Sensor Cards */}
      <div style={styles.cardsGrid}>
        {renderSensorCard('ms711', data.ms711)}
        {renderSensorCard('ms712', data.ms712)}
      </div>

      {/* Calibration History */}
      <div style={styles.historySection}>
        <h3 style={styles.sectionTitle}>Historial de Calibraciones</h3>
        <div style={styles.historyTableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Sensor</th>
                <th style={styles.th}>Realizada por</th>
                <th style={styles.th}>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {data.calibration_history.map((h, i) => (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td}>
                    {new Date(h.date).toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td style={styles.td}>{h.sensor}</td>
                  <td style={styles.td}>{h.performed_by}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.typeBadge,
                      ...(h.type === 'Fábrica' ? styles.typeFabrica : styles.typeRecal)
                    }}>
                      {h.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "flex",
    flexDirection: "column",
    padding: "32px",
    flex: 1,
    height: "calc(100vh - 48px)",
    overflow: "auto",
    gap: 32,
    backgroundColor: "#111111",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "16px",
    borderBottom: "1px solid #333333",
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    display: "flex",
    alignItems: "center",
  },
  uploadButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "none",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.1s ease",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 28,
  },
  sensorCard: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  sensorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sensorTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  sensorName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  serialNumber: {
    color: "#888888",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
  statusBadge: {
    padding: "6px 14px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid",
    textTransform: "uppercase",
  },
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: "#cccccc",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    fontWeight: 500,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#333333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  datesRow: {
    display: "flex",
    gap: 16,
  },
  dateBox: {
    flex: 1,
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  dateLabel: {
    color: "#888888",
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 600,
  },
  dateValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
  },
  expandButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px",
    backgroundColor: "#111111",
    border: "1px solid #333333",
    borderRadius: 4,
    color: "#cccccc",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.1s ease",
    marginTop: 8,
  },
  coefficientsTable: {
    overflowX: "auto",
    border: "1px solid #333333",
    borderRadius: 4,
    backgroundColor: "#111111",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
  },
  th: {
    padding: "12px 16px",
    borderBottom: "1px solid #333333",
    backgroundColor: "#1e1e1e",
    color: "#cccccc",
    fontWeight: 600,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #333333",
  },
  td: {
    padding: "12px 16px",
    color: "#ffffff",
    whiteSpace: "nowrap",
  },
  historySection: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    marginTop: 16,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    margin: 0,
    paddingBottom: 8,
    borderBottom: "1px solid #333333",
  },
  historyTableContainer: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333333",
    borderRadius: 4,
    overflow: "hidden",
  },
  typeBadge: {
    padding: "4px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  typeFabrica: {
    backgroundColor: "#0078d4",
    color: "#ffffff",
    border: "1px solid #005a9e",
  },
  typeRecal: {
    backgroundColor: "#5c2d91",
    color: "#ffffff",
    border: "1px solid #4a2474",
  },
  loadingState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#888888",
    fontSize: 15,
    fontWeight: 500,
  },
};

export default CalibrationView;
