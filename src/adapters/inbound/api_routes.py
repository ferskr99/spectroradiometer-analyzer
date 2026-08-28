from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import io
import csv

from src.domain.models import SpectrometerConfig, SpectralData, AnalysisResult, AnalysisRequest
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.application.dependencies import get_hardware_adapter
from src.application.spectral_processing import SpectralProcessorUseCase
from src.infrastructure.db.database import get_db
from src.infrastructure.db.models import MeasurementRecord
from src.application.scheduler_service import SchedulerService

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

@router.get("/scheduler/status", tags=["Scheduler"])
def get_scheduler_status():
    return SchedulerService.status()

@router.post("/scheduler/start", tags=["Scheduler"])
def start_scheduler(interval_minutes: int = 10):
    success = SchedulerService.start(interval_minutes)
    if not success:
        raise HTTPException(status_code=400, detail="El Scheduler ya está corriendo.")
    return {"message": "Scheduler iniciado", "interval_minutes": interval_minutes}

@router.post("/scheduler/stop", tags=["Scheduler"])
def stop_scheduler():
    success = SchedulerService.stop()
    if not success:
        raise HTTPException(status_code=400, detail="El Scheduler no está corriendo.")
    return {"message": "Scheduler detenido"}

@router.get("/{sensor_id}/spectrum", response_model=SpectralData)
async def get_spectrum(
    sensor_id: str, 
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    if sensor_id not in ["MS-711", "MS-712"]:
        raise HTTPException(status_code=422, detail="Modelo de sensor no soportado.")
    
    return await adapter.read_spectrum(sensor_id)

@router.get("/health", tags=["Hardware"])
async def get_health_diagnostics(
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    """
    Obtiene la telemetría y salud actual de los instrumentos físicos (temperaturas, voltajes, etc.).
    """
    # Para la simulación, generamos valores realistas pero ligeramente fluctuantes.
    # En la integración final, esto llamará a los comandos específicos del hardware.
    import random
    return {
        "status": "OK",
        "ms711": {
            "sensor_temp_c": round(24.5 + random.uniform(-0.5, 0.5), 2),
            "supply_voltage_v": round(12.0 + random.uniform(-0.1, 0.1), 2),
            "connection": "Stable"
        },
        "ms712": {
            "peltier_temp_c": round(-5.0 + random.uniform(-0.2, 0.2), 2), # El manual dice que debe mantenerse en -5C
            "supply_voltage_v": round(5.0 + random.uniform(-0.05, 0.05), 2),
            "connection": "Stable"
        }
    }

@router.post("/analyze", response_model=AnalysisResult, tags=["Análisis"])
async def analyze_spectra(
    request: AnalysisRequest,
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter),
    db: Session = Depends(get_db)
):
    """
    Configura de forma atómica y adquiere los datos de los sensores solicitados.
    """
    # 1. Configurar ambos equipos
    if request.sensor_target in ["MS-711", "Merge"]:
        await adapter.configure_sensor(SpectrometerConfig(sensor_id="MS-711", exposure_time_ms=request.exposure_time_ms))
    if request.sensor_target in ["MS-712", "Merge"]:
        await adapter.configure_sensor(SpectrometerConfig(sensor_id="MS-712", exposure_time_ms=request.exposure_time_ms))

    # 2. Adquirir y procesar datos crudos
    if request.sensor_target == "MS-711":
        data = await adapter.read_spectrum("MS-711")
        interpolated = data
    elif request.sensor_target == "MS-712":
        data = await adapter.read_spectrum("MS-712")
        interpolated = data
    else:
        ms711_data = await adapter.read_spectrum("MS-711")
        ms712_data = await adapter.read_spectrum("MS-712")
        interpolated = SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms712_data)

    # 3. Cálculos radiométricos deterministas
    par = SpectralProcessorUseCase.calculate_par(interpolated)
    ppfd = SpectralProcessorUseCase.calculate_ppfd(interpolated)
    illuminance = SpectralProcessorUseCase.calculate_illuminance(interpolated)
    total_irradiance = SpectralProcessorUseCase.calculate_total_irradiance(interpolated)

    result = AnalysisResult(
        merged_spectrum=interpolated,
        par=par,
        ppfd=ppfd,
        illuminance=illuminance,
        total_irradiance=total_irradiance
    )

    # 4. Guardar en Base de Datos (Datalogger)
    record = MeasurementRecord(
        sensor_target=request.sensor_target,
        exposure_time_ms=request.exposure_time_ms,
        par=par,
        ppfd=ppfd,
        illuminance=illuminance,
        total_irradiance=total_irradiance
    )
    record.set_spectrum(interpolated.model_dump())
    
    db.add(record)
    db.commit()
    db.refresh(record)

    return result

@router.get("/history/list", tags=["Datalogger"])
def get_history(limit: int = 500, db: Session = Depends(get_db)):
    """Obtiene el historial de mediciones recientes (sin el json pesado)."""
    records = db.query(MeasurementRecord).order_by(MeasurementRecord.timestamp.desc()).limit(limit).all()
    # Invertir para que los más antiguos queden arriba y los nuevos abajo (1, 2, 3, 4...)
    records.reverse()
    # Mapear resultados excluyendo el spectrum_json
    return [{
        "id": r.id,
        "timestamp": r.timestamp.isoformat(),
        "sensor_target": r.sensor_target,
        "exposure_time_ms": r.exposure_time_ms,
        "par": r.par,
        "ppfd": r.ppfd,
        "illuminance": r.illuminance,
        "total_irradiance": r.total_irradiance
    } for r in records]

@router.get("/history/batch", tags=["Datalogger"])
def get_history_batch(ids: str, db: Session = Depends(get_db)):
    """
    Obtiene múltiples registros específicos incluyendo su espectro completo para graficar superposiciones.
    El parámetro 'ids' debe ser una lista separada por comas, ej: ?ids=1,2,3
    """
    try:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="El formato de los IDs debe ser una lista de números enteros separados por coma.")
    
    records = db.query(MeasurementRecord).filter(MeasurementRecord.id.in_(id_list)).all()
    
    results = {}
    for record in records:
        results[record.id] = AnalysisResult(
            merged_spectrum=record.get_spectrum(),
            par=record.par,
            ppfd=record.ppfd,
            illuminance=record.illuminance,
            total_irradiance=record.total_irradiance
        )
    return results

@router.get("/history/{record_id}", response_model=AnalysisResult, tags=["Datalogger"])
def get_history_detail(record_id: int, db: Session = Depends(get_db)):
    """Obtiene un registro específico incluyendo su espectro completo para graficar."""
    record = db.query(MeasurementRecord).filter(MeasurementRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
        
    return AnalysisResult(
        merged_spectrum=record.get_spectrum(),
        par=record.par,
        ppfd=record.ppfd,
        illuminance=record.illuminance,
        total_irradiance=record.total_irradiance
    )

@router.get("/history/export/csv", tags=["Datalogger"])
def export_history_csv(db: Session = Depends(get_db)):
    """Exporta el historial completo en formato CSV de manera eficiente en RAM."""
    
    # Solo consultamos las columnas numéricas, IGNORANDO el pesado 'spectrum_json'
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

    def iter_csv():
        # Escribimos las cabeceras
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Fecha/Hora (UTC)", "Sensor", "Exposicion (ms)", "PAR (W/m2)", "PPFD (umol/m2/s)", "Iluminancia (lx)", "Irradiancia Total (W/m2)"])
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)
        
        # Iterar en bloques manejables usando yield_per para no saturar la RAM
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
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historial_mediciones.csv"}
    )

@router.get("/history/export/batch/csv", tags=["Datalogger"])
def export_history_batch_csv(ids: str, db: Session = Depends(get_db)):
    """Exporta solo los registros seleccionados en formato CSV."""
    try:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="IDs inválidos")

    query = db.query(
        MeasurementRecord.id,
        MeasurementRecord.timestamp,
        MeasurementRecord.sensor_target,
        MeasurementRecord.exposure_time_ms,
        MeasurementRecord.par,
        MeasurementRecord.ppfd,
        MeasurementRecord.illuminance,
        MeasurementRecord.total_irradiance
    ).filter(MeasurementRecord.id.in_(id_list)).order_by(MeasurementRecord.timestamp.asc())

    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Fecha/Hora (UTC)", "Sensor", "Exposicion (ms)", "PAR (W/m2)", "PPFD (umol/m2/s)", "Iluminancia (lx)", "Irradiancia Total (W/m2)"])
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)
        
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
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=seleccion_mediciones.csv"}
    )