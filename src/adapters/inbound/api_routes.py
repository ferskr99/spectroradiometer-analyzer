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

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

@router.get("/{sensor_id}/spectrum", response_model=SpectralData)
async def get_spectrum(
    sensor_id: str, 
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    if sensor_id not in ["MS-711", "MS-712"]:
        raise HTTPException(status_code=422, detail="Modelo de sensor no soportado.")
    
    return await adapter.read_spectrum(sensor_id)

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