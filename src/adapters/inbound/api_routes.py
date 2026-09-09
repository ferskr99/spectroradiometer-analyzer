from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import io
import csv
import asyncio
import logging
from datetime import datetime, timezone

from src.domain.models import SpectrometerConfig, SpectralData, AnalysisResult, AnalysisRequest
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.exceptions import (
    HardwareConnectionError,
    HardwareTimeoutError,
    SpectralProcessingError,
    SCADABaseError,
)
from src.application.dependencies import get_hardware_adapter
from src.application.spectral_processing import SpectralProcessorUseCase
from src.infrastructure.db.database import get_db
from src.infrastructure.db.models import MeasurementRecord
from src.application.advanced_scheduler import AdvancedScheduler, SchedulerConfig
from src.application.websocket_manager import ws_manager
from src.application.solar_geometry import SolarGeometry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Canal WebSocket genérico para eventos (mediciones, alertas)."""
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)


@router.websocket("/ws/telemetry")
async def websocket_telemetry(
    websocket: WebSocket,
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter),
):
    """
    Canal de Telemetría SCADA en Tiempo Real.

    Empuja el estado operativo de MS-711 y MS-713 (temperaturas Peltier,
    voltajes de alimentación, estado de conexión) a una frecuencia de ~1 Hz.

    Este canal opera independientemente de las mediciones espectrales:
    la telemetría fluye incluso cuando no se están tomando espectros.

    Protocolo de cierre:
        - 1011 (Internal Error): Error de hardware irrecuperable.
        - 1013 (Try Again Later): Timeout de comunicación temporal.
    """
    await websocket.accept()
    logger.info("Cliente conectado al canal de telemetría SCADA")

    try:
        while True:
            try:
                # Leer telemetría de ambos instrumentos en paralelo
                ms711_status, ms713_status = await asyncio.gather(
                    adapter.read_instrument_status("MS-711"),
                    adapter.read_instrument_status("MS-713"),
                    return_exceptions=True,
                )

                # Construir payload de telemetría
                payload = {
                    "type": "telemetry",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "instruments": {
                        "ms711": ms711_status if isinstance(ms711_status, dict) else {
                            "error": str(ms711_status), "connection": "Error"
                        },
                        "ms713": ms713_status if isinstance(ms713_status, dict) else {
                            "error": str(ms713_status), "connection": "Error"
                        },
                    },
                }

                await websocket.send_json(payload)

            except HardwareConnectionError as e:
                # Error irrecuperable: cerrar con código 1011
                await websocket.send_json({
                    "type": "scada_error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": e.to_dict(),
                })
                await websocket.close(code=1011, reason=e.detail)
                return

            except HardwareTimeoutError as e:
                # Error temporal: cerrar con código 1013
                await websocket.send_json({
                    "type": "scada_error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": e.to_dict(),
                })
                await websocket.close(code=1013, reason=e.detail)
                return

            # Frecuencia de telemetría: 1 Hz
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        logger.info("Cliente desconectado del canal de telemetría")
    except Exception as e:
        logger.error(f"Error inesperado en telemetría: {e}")
        try:
            await websocket.close(code=1011, reason="Error interno del servidor")
        except Exception:
            pass

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
    Obtiene la telemetría y salud actual de los instrumentos físicos.
    Delegada al puerto de hardware real/simulado (Liskov Substitution).
    """
    try:
        ms711_status = await adapter.read_instrument_status("MS-711")
        ms713_status = await adapter.read_instrument_status("MS-713")
        return {
            "status": "OK",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ms711": ms711_status,
            "ms713": ms713_status,
        }
    except HardwareConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_dict())
    except Exception as e:
        logger.error(f"Error obteniendo diagnósticos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze", response_model=AnalysisResult, tags=["Análisis"])
async def analyze_spectra(
    request: AnalysisRequest,
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter),
    db: Session = Depends(get_db)
):
    """
    Orquestación Asíncrona de Medición SCADA.

    Pipeline atómico:
        1. Configurar obturador (MS-711: 10-5000ms, MS-713: 1-30ms).
        2. Adquirir espectros crudos vía RS-232C (I/O asíncrono).
        3. Fusión espectral 300-2500nm e interpolación a 1nm.
        4. Cálculos radiométricos vectorizados (PAR, PPFD, Iluminancia).
        5. Inversión atmosférica (AOD Bouguer-Lambert-Beer + CSR, PWV Ingold).
        6. Persistencia en SQLite y broadcast WebSocket.

    Gestión de errores SCADA:
        - 503: Hardware desconectado o no responde.
        - 504: Timeout del obturador.
        - 422: Error de procesamiento espectral (broadcasting, calibración).
        - 500: Error inesperado (traza sanitizada).
    """
    try:
        # ── 1. CONFIGURACIÓN DEL HARDWARE (I/O asíncrono) ──────────
        if request.sensor_target in ["MS-711", "Merge"]:
            await adapter.configure_sensor(
                SpectrometerConfig(sensor_id="MS-711", exposure_time_ms=request.exposure_time_ms)
            )
        if request.sensor_target in ["MS-713", "Merge"]:
            await adapter.configure_sensor(
                SpectrometerConfig(sensor_id="MS-713", exposure_time_ms=request.exposure_time_ms)
            )

        # ── 2. ADQUISICIÓN DE ESPECTROS CRUDOS ─────────────────────
        if request.sensor_target == "MS-711":
            data = await adapter.read_spectrum("MS-711")
            interpolated = data
        elif request.sensor_target == "MS-713":
            data = await adapter.read_spectrum("MS-713")
            interpolated = data
        else:
            # Lectura sincronizada de ambos sensores
            ms711_data, ms713_data = await asyncio.gather(
                adapter.read_spectrum("MS-711"),
                adapter.read_spectrum("MS-713"),
            )
            interpolated = SpectralProcessorUseCase.merge_and_interpolate(
                ms711_data, ms713_data
            )

        # ── 3. CÁLCULOS RADIOMÉTRICOS (CPU-bound vectorizado) ──────
        par = SpectralProcessorUseCase.calculate_par(interpolated)
        ppfd = SpectralProcessorUseCase.calculate_ppfd(interpolated)
        illuminance = SpectralProcessorUseCase.calculate_illuminance(interpolated)
        total_irradiance = SpectralProcessorUseCase.calculate_total_irradiance(interpolated)

        # ── 4. GEOMETRÍA SOLAR + INVERSIÓN ATMOSFÉRICA ─────────────
        solar = SolarGeometry()
        solar_pos = solar.get_solar_position()
        air_mass = solar_pos.get('air_mass')

        pwv = SpectralProcessorUseCase.calculate_pwv(
            interpolated, air_mass, band='940nm'
        )
        aod = SpectralProcessorUseCase.calculate_aod(
            interpolated, air_mass,
            pressure_hpa=solar.pressure_hpa,
            cr_factor=0.02,  # Corrección CSR para FOV 5° de los EKO
        )

        # ── 5. ENSAMBLAJE DEL RESULTADO ────────────────────────────
        result = AnalysisResult(
            merged_spectrum=interpolated,
            par=par,
            ppfd=ppfd,
            illuminance=illuminance,
            total_irradiance=total_irradiance,
            applied_exposure_ms=getattr(adapter, "exposure_time_ms", request.exposure_time_ms),
            pwv_cm=pwv,
            aod_bands=aod,
            solar_geometry=solar_pos,
        )

        # ── 6. PERSISTENCIA + BROADCAST ────────────────────────────
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

        # Broadcast asíncrono al frontend (no bloqueante)
        asyncio.create_task(ws_manager.broadcast_measurement({
            "id": record.id,
            "timestamp": record.timestamp.isoformat(),
            "par": par,
            "ppfd": ppfd,
            "illuminance": illuminance,
            "total_irradiance": total_irradiance,
            "pwv_cm": pwv,
            "aod_bands": aod,
            "solar_geometry": solar_pos,
        }))

        return result

    # ── GESTIÓN DE ERRORES SCADA ───────────────────────────────────
    except HardwareConnectionError as e:
        logger.error(f"SCADA: Hardware desconectado — {e.to_dict()}")
        asyncio.create_task(ws_manager.broadcast_error(
            "HardwareConnectionError", e.detail, e.sensor_id
        ))
        raise HTTPException(status_code=503, detail=e.to_dict())

    except HardwareTimeoutError as e:
        logger.error(f"SCADA: Timeout de obturador — {e.to_dict()}")
        asyncio.create_task(ws_manager.broadcast_error(
            "HardwareTimeoutError", e.detail, e.sensor_id
        ))
        raise HTTPException(status_code=504, detail=e.to_dict())

    except (ValueError, IndexError, TypeError) as e:
        # Errores de NumPy broadcasting, dimensiones incompatibles, etc.
        error = SpectralProcessingError(
            operation="analyze_spectra",
            detail=str(e)
        )
        logger.error(f"SCADA: Error de procesamiento — {error.to_dict()}")
        asyncio.create_task(ws_manager.broadcast_error(
            "SpectralProcessingError", str(e)
        ))
        raise HTTPException(status_code=422, detail=error.to_dict())

    except SCADABaseError as e:
        logger.error(f"SCADA: Error de dominio — {e.to_dict()}")
        raise HTTPException(status_code=503, detail=e.to_dict())

    except Exception as e:
        logger.critical(f"SCADA: Error inesperado en pipeline — {type(e).__name__}: {e}")
        asyncio.create_task(ws_manager.broadcast_error(
            "InternalError", "Error inesperado en el pipeline de medición"
        ))
        raise HTTPException(
            status_code=500,
            detail={
                "error_type": "InternalError",
                "detail": "Error inesperado en el pipeline de medición. Revise los logs del servidor.",
            }
        )

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