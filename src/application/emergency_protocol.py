import os
import csv
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from src.infrastructure.db.database import SessionLocal
from src.infrastructure.db.models import MeasurementRecord

logger = logging.getLogger(__name__)

class EmergencyProtocol:
    """
    Protocolo de emergencia que se dispara cuando ocurre un fallo crítico durante una medición continua.
    Realiza un volcado seguro e inmediato de los datos valiosos almacenados en la base de datos local.
    """
    
    @staticmethod
    def trigger_emergency_backup(reason: str):
        """
        Ejecuta el respaldo de emergencia a disco de todas las mediciones numéricas.
        """
        logger.error(f"[EMERGENCIA] Disparando protocolo de volcado de datos. Motivo: {reason}")
        
        export_dir = "exports"
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
        filename = f"{export_dir}/emergency_backup_{timestamp_str}.csv"
        
        db: Session = SessionLocal()
        try:
            # Consulta eficiente sin cargar el JSON pesado
            query = db.query(
                MeasurementRecord.id,
                MeasurementRecord.timestamp,
                MeasurementRecord.sensor_target,
                MeasurementRecord.exposure_time_ms,
                MeasurementRecord.par,
                MeasurementRecord.ppfd,
                MeasurementRecord.illuminance,
                MeasurementRecord.total_irradiance
            ).order_by(MeasurementRecord.timestamp.asc())
            
            with open(filename, mode='w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "ID", "Fecha/Hora (UTC)", "Sensor", "Exposicion (ms)", 
                    "PAR (W/m2)", "PPFD (umol/m2/s)", "Iluminancia (lx)", "Irradiancia Total (W/m2)"
                ])
                
                count = 0
                for r in query.yield_per(1000):
                    writer.writerow([
                        r.id,
                        r.timestamp.isoformat(),
                        r.sensor_target,
                        r.exposure_time_ms,
                        f"{r.par:.4f}",
                        f"{r.ppfd:.4f}",
                        f"{r.illuminance:.2f}",
                        f"{r.total_irradiance:.4f}"
                    ])
                    count += 1
                    
            logger.critical(f"[EMERGENCIA COMPLETADA] Respaldo crítico exitoso. {count} registros salvados en {filename}.")
        except Exception as e:
            logger.critical(f"[FALLO CRÍTICO] Falló el protocolo de emergencia: {str(e)}")
        finally:
            db.close()
