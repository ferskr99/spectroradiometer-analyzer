from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
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
from src.infrastructure.db.models import MeasurementRecord
from src.application.advanced_scheduler import AdvancedScheduler, SchedulerConfig
from src.application.websocket_manager import ws_manager

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Mantener la conexión viva
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@router.get("/scheduler/status", tags=["Scheduler"])
def get_scheduler_status():
    return AdvancedScheduler.status()

@router.post("/scheduler/start", tags=["Scheduler"])
async def start_scheduler(config: SchedulerConfig):
    success = AdvancedScheduler.start(config)
    if not success:
        raise HTTPException(status_code=400, detail="El Scheduler ya está corriendo.")
    return {"message": "Scheduler avanzado iniciado", "config": config.model_dump()}

@router.post("/scheduler/stop", tags=["Scheduler"])
async def stop_scheduler():
    success = AdvancedScheduler.stop()
    if not success:
        raise HTTPException(status_code=400, detail="El Scheduler no está corriendo.")
    return {"message": "Scheduler detenido"}


@router.get("/{sensor_id}/spectrum", response_model=SpectralData)
async def get_spectrum(
    sensor_id: str, 
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    if sensor_id not in ["MS-711", "MS-713"]:
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
        "ms713": {
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
    if request.sensor_target in ["MS-713", "Merge"]:
        await adapter.configure_sensor(SpectrometerConfig(sensor_id="MS-713", exposure_time_ms=request.exposure_time_ms))

    # 2. Adquirir y procesar datos crudos
    if request.sensor_target == "MS-711":
        data = await adapter.read_spectrum("MS-711")
        interpolated = data
    elif request.sensor_target == "MS-713":
        data = await adapter.read_spectrum("MS-713")
        interpolated = data
    else:
        ms711_data = await adapter.read_spectrum("MS-711")
        ms713_data = await adapter.read_spectrum("MS-713")
        interpolated = SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms713_data)

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
        total_irradiance=total_irradiance,
        applied_exposure_ms=getattr(adapter, "exposure_time_ms", request.exposure_time_ms)
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

    # Emitir evento WebSocket para notificar a los clientes
    import asyncio
    asyncio.create_task(ws_manager.broadcast({
        "event": "NEW_MEASUREMENT",
        "data": {
            "id": record.id,
            "timestamp": record.timestamp.isoformat()
        }
    }))

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

# ─────────────────────────────────────────────────────────────────────
# Calibración
# ─────────────────────────────────────────────────────────────────────

@router.get("/calibration", tags=["Calibración"])
def get_calibration_status():
    """Retorna el estado actual de calibración de ambos sensores (simulado)."""
    from datetime import datetime, timezone, timedelta

    # Simulación: última calibración hace ~18 meses
    last_cal_711 = datetime(2025, 2, 15, tzinfo=timezone.utc)
    last_cal_712 = datetime(2025, 3, 20, tzinfo=timezone.utc)
    cycle_days = 730  # 2 años

    now = datetime.now(timezone.utc)

    def calc_status(last_cal: datetime):
        days_since = (now - last_cal).days
        days_remaining = max(0, cycle_days - days_since)
        progress_pct = min(100, round((days_since / cycle_days) * 100, 1))
        if days_remaining > 180:
            status = "valid"
        elif days_remaining > 0:
            status = "warning"
        else:
            status = "expired"
        return {
            "last_calibration": last_cal.isoformat(),
            "next_calibration": (last_cal + timedelta(days=cycle_days)).isoformat(),
            "days_remaining": days_remaining,
            "days_since": days_since,
            "progress_pct": progress_pct,
            "status": status
        }

    return {
        "ms711": {
            **calc_status(last_cal_711),
            "serial_number": "MS711-2024-0042",
            "coefficients": [
                {"wavelength_nm": 300, "sensitivity": 0.00215, "offset": -0.0003},
                {"wavelength_nm": 400, "sensitivity": 0.00312, "offset": -0.0001},
                {"wavelength_nm": 500, "sensitivity": 0.00298, "offset": 0.0000},
                {"wavelength_nm": 600, "sensitivity": 0.00276, "offset": 0.0001},
                {"wavelength_nm": 700, "sensitivity": 0.00241, "offset": -0.0002},
                {"wavelength_nm": 800, "sensitivity": 0.00198, "offset": 0.0001},
                {"wavelength_nm": 900, "sensitivity": 0.00165, "offset": -0.0001},
                {"wavelength_nm": 1000, "sensitivity": 0.00132, "offset": 0.0002},
                {"wavelength_nm": 1100, "sensitivity": 0.00108, "offset": -0.0001},
            ]
        },
        "ms713": {
            **calc_status(last_cal_712),
            "serial_number": "MS712-2024-0018",
            "coefficients": [
                {"wavelength_nm": 900, "sensitivity": 0.00178, "offset": -0.0002},
                {"wavelength_nm": 1000, "sensitivity": 0.00195, "offset": 0.0000},
                {"wavelength_nm": 1100, "sensitivity": 0.00210, "offset": 0.0001},
                {"wavelength_nm": 1200, "sensitivity": 0.00188, "offset": -0.0001},
                {"wavelength_nm": 1300, "sensitivity": 0.00162, "offset": 0.0002},
                {"wavelength_nm": 1400, "sensitivity": 0.00141, "offset": -0.0001},
                {"wavelength_nm": 1500, "sensitivity": 0.00118, "offset": 0.0001},
                {"wavelength_nm": 1600, "sensitivity": 0.00095, "offset": -0.0002},
                {"wavelength_nm": 2500, "sensitivity": 0.00078, "offset": 0.0001},
            ]
        },
        "calibration_history": [
            {"date": "2025-03-20", "sensor": "MS-713", "performed_by": "EKO Instruments", "type": "Fábrica"},
            {"date": "2025-02-15", "sensor": "MS-711", "performed_by": "EKO Instruments", "type": "Fábrica"},
            {"date": "2023-01-10", "sensor": "MS-711", "performed_by": "Lab. Metrología UNMSM", "type": "Recalibración"},
            {"date": "2023-01-10", "sensor": "MS-713", "performed_by": "Lab. Metrología UNMSM", "type": "Recalibración"},
        ]
    }

@router.post("/calibration/upload", tags=["Calibración"])
async def upload_calibration_file():
    """Simulación de carga de archivo de calibración."""
    return {"message": "Archivo de calibración procesado exitosamente (simulado)", "status": "ok"}

# ─────────────────────────────────────────────────────────────────────
# Reportes PDF
# ─────────────────────────────────────────────────────────────────────

@router.post("/reports/generate", tags=["Reportes"])
def generate_report(
    payload: dict,
    db: Session = Depends(get_db)
):
    """Genera un informe PDF con las mediciones seleccionadas."""
    from fpdf import FPDF
    from datetime import datetime, timezone
    import io

    ids = payload.get("ids", [])
    title = payload.get("title", "Informe de Mediciones Espectrales")
    author = payload.get("author", "Investigador")
    notes = payload.get("notes", "")

    records = db.query(MeasurementRecord).filter(MeasurementRecord.id.in_(ids)).order_by(MeasurementRecord.timestamp.asc()).all()

    if not records:
        raise HTTPException(status_code=404, detail="No se encontraron registros con los IDs proporcionados")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Portada ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 24)
    pdf.cell(0, 60, "", ln=True)
    pdf.cell(0, 15, title, ln=True, align="C")
    pdf.set_font("Helvetica", "", 14)
    pdf.cell(0, 10, "Spectroradiometer Analyzer - EKO MS-711 / MS-713", ln=True, align="C")
    pdf.cell(0, 20, "", ln=True)
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, f"Autor: {author}", ln=True, align="C")
    pdf.cell(0, 8, f"Fecha de generación: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", ln=True, align="C")
    pdf.cell(0, 8, f"Mediciones incluidas: {len(records)}", ln=True, align="C")

    if notes:
        pdf.cell(0, 20, "", ln=True)
        pdf.set_font("Helvetica", "I", 11)
        pdf.multi_cell(0, 7, f"Notas: {notes}", align="C")

    # ── Tabla de Resumen ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 12, "Resumen de Mediciones", ln=True)
    pdf.ln(5)

    # Cabeceras
    pdf.set_font("Helvetica", "B", 9)
    col_widths = [15, 45, 25, 20, 25, 25, 35]
    headers = ["ID", "Fecha/Hora", "Sensor", "Exp(ms)", "PAR(W/m²)", "PPFD", "Irr.Total(W/m²)"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border=1, align="C")
    pdf.ln()

    # Filas
    pdf.set_font("Helvetica", "", 8)
    for r in records:
        pdf.cell(col_widths[0], 7, str(r.id), border=1, align="C")
        ts = r.timestamp.strftime("%Y-%m-%d %H:%M") if r.timestamp else "N/A"
        pdf.cell(col_widths[1], 7, ts, border=1, align="C")
        pdf.cell(col_widths[2], 7, str(r.sensor_target), border=1, align="C")
        pdf.cell(col_widths[3], 7, str(r.exposure_time_ms), border=1, align="C")
        pdf.cell(col_widths[4], 7, f"{r.par:.4f}", border=1, align="C")
        pdf.cell(col_widths[5], 7, f"{r.ppfd:.4f}", border=1, align="C")
        pdf.cell(col_widths[6], 7, f"{r.total_irradiance:.4f}", border=1, align="C")
        pdf.ln()

    # ── Detalle por medición ──
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    for r in records:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, f"Medición #{r.id}", ln=True)
        pdf.set_font("Helvetica", "", 11)
        ts = r.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if r.timestamp else "N/A"
        pdf.cell(0, 7, f"Fecha: {ts}", ln=True)
        pdf.cell(0, 7, f"Sensor: {r.sensor_target}  |  Exposición: {r.exposure_time_ms} ms", ln=True)
        pdf.ln(5)

        # Métricas
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Resultados Radiométricos", ln=True)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, f"  PAR: {r.par:.4f} W/m²", ln=True)
        pdf.cell(0, 7, f"  PPFD: {r.ppfd:.4f} µmol/m²/s", ln=True)
        pdf.cell(0, 7, f"  Iluminancia: {r.illuminance:.2f} lux", ln=True)
        pdf.cell(0, 7, f"  Irradiancia Total: {r.total_irradiance:.4f} W/m²", ln=True)
        pdf.ln(5)

        # Generar gráfica espectral
        spectrum = r.get_spectrum()
        if spectrum and 'wavelengths' in spectrum and 'irradiance' in spectrum:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.plot(spectrum['wavelengths'], spectrum['irradiance'], color='#3b82f6', linewidth=1.5)
            ax.set_title("Distribución de Irradiancia Espectral", fontsize=10)
            ax.set_xlabel("Longitud de Onda (nm)", fontsize=9)
            ax.set_ylabel("Irradiancia (W/m²/µm)", fontsize=9)
            ax.grid(True, linestyle='--', alpha=0.6)
            plt.tight_layout()

            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150)
            plt.close(fig)
            buf.seek(0)

            # Insertar imagen en el PDF
            pdf.image(buf, w=170)
        else:
            pdf.set_font("Helvetica", "I", 10)
            pdf.cell(0, 10, "(Datos espectrales no disponibles para graficar)", ln=True)

    # ── Pie de reporte ──
    pdf.add_page()
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 60, "", ln=True)
    pdf.cell(0, 8, "Este informe fue generado automáticamente por Spectroradiometer Analyzer v1.0.0", ln=True, align="C")
    pdf.cell(0, 8, "EKO Instruments - Espectrorradiómetros MS-711 / MS-713", ln=True, align="C")

    # Generar bytes
    pdf_bytes = pdf.output()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=informe_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
    )