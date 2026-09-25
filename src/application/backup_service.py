import os
import csv
import logging
from datetime import datetime, timezone
from src.infrastructure.db.database import SessionLocal
from src.infrastructure.db.models import MeasurementRecord

logger = logging.getLogger(__name__)

class BackupService:
    @staticmethod
    def perform_backup():
        """
        Ejecuta el respaldo automático a disco de todas las mediciones numéricas.
        """
        export_dir = "exports"
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
        filename = f"{export_dir}/mediciones_{timestamp_str}.csv"
        
        db = SessionLocal()
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
                        f"{r.par:.4f}" if r.par is not None else "N/A",
                        f"{r.ppfd:.4f}" if r.ppfd is not None else "N/A",
                        f"{r.illuminance:.2f}" if r.illuminance is not None else "N/A",
                        f"{r.total_irradiance:.4f}" if r.total_irradiance is not None else "N/A"
                    ])
                    count += 1
                    
            logger.info(f"Respaldo automático exitoso. {count} registros guardados en {filename}.")
        except Exception as e:
            logger.error(f"Error durante el respaldo automático: {str(e)}")
        finally:
            db.close()
