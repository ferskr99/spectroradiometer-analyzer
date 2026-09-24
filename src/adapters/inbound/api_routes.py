from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import io
import csv
import asyncio
import logging
from datetime import datetime, timezone

from src.domain.models import SpectrometerConfig, SpectralData, AnalysisResult, AnalysisRequest, HardwareSettings
import json
from pathlib import Path
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


# ─────────────────────────────────────────────────────────────────────
# Configuración de Hardware (Settings)
# ─────────────────────────────────────────────────────────────────────
SETTINGS_FILE = Path(__file__).resolve().parents[3] / "settings.json"

def _load_settings() -> dict:
    """Lee settings.json desde disco."""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {
        "sensors": {
            "global": {"ms711": {"port": "COM3", "enabled": True}, "ms713": {"port": "COM4", "enabled": True}},
            "direct": {"ms711": {"port": "COM5", "enabled": True}, "ms713": {"port": "COM6", "enabled": True}},
        },
        "tracker": {"port": "COM7", "enabled": False}
    }

def _save_settings(data: dict):
    """Escribe settings.json a disco."""
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@router.get("/settings/hardware", tags=["Settings"])
def get_hardware_settings():
    """Devuelve la configuración actual de puertos de hardware."""
    return _load_settings()

@router.post("/settings/hardware", tags=["Settings"])
def save_hardware_settings(payload: dict):
    """Guarda la configuración de puertos de hardware en disco."""
    _save_settings(payload)
    return {"message": "Configuración de hardware guardada exitosamente", "data": payload}

@router.get("/settings/ports", tags=["Settings"])
def list_serial_ports():
    """Lista los puertos serie disponibles en el sistema operativo."""
    try:
        import serial.tools.list_ports
        ports = serial.tools.list_ports.comports()
        return {
            "ports": [
                {"device": p.device, "description": p.description, "hwid": p.hwid}
                for p in ports
            ]
        }
    except ImportError:
        return {"ports": [], "warning": "pyserial no instalado, no se pueden detectar puertos reales."}

@router.post("/settings/test-connection", tags=["Settings"])
def test_connection(payload: dict):
    """Prueba la conexión a un puerto serie especificado."""
    port = payload.get("port")
    if not port:
        raise HTTPException(status_code=400, detail="Se requiere el parámetro port")
    
    # Simulación de test. En producción usaría pyserial: serial.Serial(port)
    import time
    time.sleep(0.5)
    
    if port.startswith("COM") or port.startswith("/dev/"):
        return {"status": "success", "message": f"Conectado exitosamente al puerto {port}"}
    else:
        raise HTTPException(status_code=400, detail=f"No se pudo conectar al puerto {port}")


# ─────────────────────────────────────────────────────────────────────
# Calibración del Sun Tracker (STR-22G/32G)
# ─────────────────────────────────────────────────────────────────────

@router.post("/tracker/calibrate", tags=["Sun Tracker"])
def tracker_calibrate(payload: dict):
    """
    Envía comandos de calibración al Sun Tracker vía RS-232C.
    
    Comandos soportados:
      - SYNC_TIME: Sincroniza el reloj RTC interno del tracker con la hora del servidor.
      - SET_LOCATION: Configura latitud, longitud y elevación del sitio de instalación.
      - JOG: Movimiento manual de los motores de azimut y cénit (en grados delta).
    
    En el entorno actual (simulado), los comandos se procesan localmente
    sin enviar tramas reales al puerto serial. En producción, cada comando
    se traduce a una trama binaria según el protocolo RS-232C del STR-22G/32G.
    """
    import time

    command = payload.get("command")
    if not command:
        raise HTTPException(status_code=400, detail="Se requiere el campo 'command'.")

    settings = _load_settings()
    tracker_cfg = settings.get("tracker", {})
    tracker_port = tracker_cfg.get("port", "N/A")
    tracker_enabled = tracker_cfg.get("enabled", False)

    if not tracker_enabled:
        raise HTTPException(
            status_code=409,
            detail="El Sun Tracker está deshabilitado en la configuración. Habilítelo primero."
        )

    # ── SYNC_TIME ────────────────────────────────────────────────────
    if command == "SYNC_TIME":
        time.sleep(0.4)  # Simula latencia RS-232
        server_time = datetime.now(timezone.utc).isoformat()
        logger.info(f"[Tracker] SYNC_TIME enviado a {tracker_port} → {server_time}")
        return {
            "status": "success",
            "command": "SYNC_TIME",
            "message": f"Reloj RTC sincronizado con el servidor ({server_time})",
            "port": tracker_port,
            "synced_utc": server_time,
        }

    # ── SET_LOCATION ─────────────────────────────────────────────────
    elif command == "SET_LOCATION":
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        elevation = payload.get("elevation", 0)

        if latitude is None or longitude is None:
            raise HTTPException(
                status_code=400,
                detail="Se requieren los campos 'latitude' y 'longitude'."
            )

        if not (-90 <= float(latitude) <= 90):
            raise HTTPException(status_code=400, detail="Latitud fuera de rango (-90 a 90).")
        if not (-180 <= float(longitude) <= 180):
            raise HTTPException(status_code=400, detail="Longitud fuera de rango (-180 a 180).")

        time.sleep(0.5)  # Simula escritura en EEPROM del tracker
        logger.info(
            f"[Tracker] SET_LOCATION → lat={latitude}, lon={longitude}, elev={elevation}m en {tracker_port}"
        )

        # Persistir la ubicación en settings.json para referencia futura
        settings["tracker_location"] = {
            "latitude": float(latitude),
            "longitude": float(longitude),
            "elevation": float(elevation),
        }
        _save_settings(settings)

        return {
            "status": "success",
            "command": "SET_LOCATION",
            "message": f"Ubicación configurada: {latitude}°, {longitude}° a {elevation}m s.n.m.",
            "port": tracker_port,
            "location": settings["tracker_location"],
        }

    # ── AUTO_ALIGN (Hill-Climbing) ───────────────────────────────────
    elif command == "AUTO_ALIGN":
        logger.info(f"[Tracker] Iniciando escaneo espiral de alineamiento en {tracker_port}...")
        time.sleep(3.0)  # Simula el escaneo espiral y lecturas del sensor
        logger.info(f"[Tracker] Pico de radiación detectado. Ejes bloqueados.")
        return {
            "status": "success",
            "command": "AUTO_ALIGN",
            "message": "Alineamiento completo. El sensor ha enganchado el disco solar con máxima precisión.",
            "port": tracker_port,
        }

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Comando '{command}' no reconocido. Use SYNC_TIME, SET_LOCATION o JOG."
        )


@router.get("/tracker/location", tags=["Sun Tracker"])
def get_tracker_location():
    """Devuelve la ubicación GPS configurada en el tracker (si existe)."""
    settings = _load_settings()
    location = settings.get("tracker_location")
    if not location:
        return {
            "status": "not_configured",
            "message": "No se ha configurado la ubicación del tracker.",
            "location": None,
        }
    return {
        "status": "configured",
        "location": location,
    }

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
                # Leer telemetría de los 4 instrumentos en paralelo
                results = await asyncio.gather(
                    adapter.read_instrument_status("MS-711_GLOBAL"),
                    adapter.read_instrument_status("MS-713_GLOBAL"),
                    adapter.read_instrument_status("MS-711_DIRECT"),
                    adapter.read_instrument_status("MS-713_DIRECT"),
                    return_exceptions=True,
                )
                sensor_keys = ["ms711_global", "ms713_global", "ms711_direct", "ms713_direct"]

                # Construir payload de telemetría
                instruments = {}
                for key, res in zip(sensor_keys, results):
                    instruments[key] = res if isinstance(res, dict) else {
                        "error": str(res), "connection": "Error"
                    }

                payload = {
                    "type": "telemetry",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "instruments": instruments,
                    # Retrocompatibilidad
                    "ms711": instruments.get("ms711_global", {}),
                    "ms713": instruments.get("ms713_global", {}),
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
    valid_ids = ["MS-711", "MS-713", "MS-711_GLOBAL", "MS-713_GLOBAL", "MS-711_DIRECT", "MS-713_DIRECT"]
    if sensor_id not in valid_ids:
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
        results = await asyncio.gather(
            adapter.read_instrument_status("MS-711_GLOBAL"),
            adapter.read_instrument_status("MS-713_GLOBAL"),
            adapter.read_instrument_status("MS-711_DIRECT"),
            adapter.read_instrument_status("MS-713_DIRECT"),
            return_exceptions=True,
        )
        sensor_keys = ["ms711_global", "ms713_global", "ms711_direct", "ms713_direct"]
        instruments = {}
        for key, res in zip(sensor_keys, results):
            instruments[key] = res if isinstance(res, dict) else {"error": str(res), "connection": "Error"}
        return {
            "status": "OK",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **instruments,
            # Retrocompatibilidad
            "ms711": instruments.get("ms711_global", {}),
            "ms713": instruments.get("ms713_global", {}),
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
        # ── 1. CONFIGURACIÓN Y ADQUISICIÓN POR GRUPO ──────────────
        global_spectrum = None
        direct_spectrum = None
        raw_spectra_map = {}
        exposure_map = {}

        async def _acquire_group(group_suffix: str):
            """Configura y adquiere espectros de un grupo (GLOBAL o DIRECT)."""
            ms711_id = f"MS-711_{group_suffix}"
            ms713_id = f"MS-713_{group_suffix}"
            
            # Configurar ambos sensores del grupo
            await asyncio.gather(
                adapter.configure_sensor(
                    SpectrometerConfig(sensor_id=ms711_id, exposure_time_ms=request.exposure_time_ms, auto_exposure=request.auto_exposure)
                ),
                adapter.configure_sensor(
                    SpectrometerConfig(sensor_id=ms713_id, exposure_time_ms=request.exposure_time_ms, auto_exposure=request.auto_exposure)
                ),
            )
            
            # Registrar exposiciones aplicadas
            exp_per_sensor = getattr(adapter, '_exposure_per_sensor', {})
            exposure_map[ms711_id] = exp_per_sensor.get(ms711_id, request.exposure_time_ms)
            exposure_map[ms713_id] = exp_per_sensor.get(ms713_id, request.exposure_time_ms)
            
            # Leer espectros en paralelo y fusionar
            ms711_data, ms713_data = await asyncio.gather(
                adapter.read_spectrum(ms711_id),
                adapter.read_spectrum(ms713_id),
            )
            raw_spectra_map[ms711_id] = ms711_data
            raw_spectra_map[ms713_id] = ms713_data
            return SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms713_data)

        if request.sensor_target in ["Global", "All"]:
            global_spectrum = await _acquire_group("GLOBAL")
        if request.sensor_target in ["Direct", "All"]:
            direct_spectrum = await _acquire_group("DIRECT")

        # El espectro principal para métricas es el Global (o el único disponible)
        interpolated = global_spectrum or direct_spectrum

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
        
        # Implementación recomendada por Qiao et al. (2023):
        # Usar la banda de 1370nm en atmósferas secas (PWV < 0.5 cm)
        if pwv != -1.0 and pwv < 0.5:
            pwv_1370 = SpectralProcessorUseCase.calculate_pwv(
                interpolated, air_mass, band='1370nm'
            )
            if pwv_1370 != -1.0:
                pwv = pwv_1370
        aod = SpectralProcessorUseCase.calculate_aod(
            interpolated, air_mass,
            pressure_hpa=solar.pressure_hpa,
            cr_factor=0.02,  # Corrección CSR para FOV 5° de los EKO
        )

        # ── 5. MÉTRICAS CRUZADAS (si ambos espectros disponibles) ──
        dni = None
        dhi = None
        clearness_index = None
        diffuse_fraction = None
        cross_metrics = None

        if direct_spectrum:
            dni = SpectralProcessorUseCase.calculate_total_irradiance(direct_spectrum)
        
        diffuse_spectrum = None
        if global_spectrum and direct_spectrum and solar_pos:
            import math
            import numpy as np
            sza_rad = math.radians(solar_pos.get('sza', 0))
            cos_sza = math.cos(sza_rad)
            if cos_sza > 0.01 and dni is not None:
                dhi = total_irradiance - dni * cos_sza
                if dhi < 0:
                    dhi = 0.0
                diffuse_fraction = dhi / total_irradiance if total_irradiance > 0 else None
            
            # Calcular Espectro Difuso (DHI): DHI(λ) = max(0, GHI(λ) - DNI(λ) * cos(SZA))
            if cos_sza > 0.01:
                wl_g = global_spectrum.wavelengths
                ir_g = np.array(global_spectrum.irradiance)
                ir_d = np.interp(wl_g, direct_spectrum.wavelengths, direct_spectrum.irradiance)
                dhi_ir = np.maximum(0.0, ir_g - ir_d * cos_sza)
                diffuse_spectrum = SpectralData(
                    wavelengths=wl_g,
                    irradiance=dhi_ir.tolist()
                )

            # Índice de claridad: GHI / E₀ (irradiancia extraterrestre ~1361 W/m²)
            E0 = 1361.0
            if cos_sza > 0.01:
                clearness_index = total_irradiance / (E0 * cos_sza)
            
            cross_metrics = {
                "dni": dni,
                "dhi": dhi,
                "clearness_index": clearness_index,
                "diffuse_fraction": diffuse_fraction,
            }

        # ── 6. ENSAMBLAJE DEL RESULTADO ────────────────────────────
        result = AnalysisResult(
            merged_spectrum=interpolated,
            global_spectrum=global_spectrum,
            direct_spectrum=direct_spectrum,
            diffuse_spectrum=diffuse_spectrum,
            par=par,
            ppfd=ppfd,
            illuminance=illuminance,
            total_irradiance=total_irradiance,
            dni=dni,
            dhi=dhi,
            clearness_index=clearness_index,
            diffuse_fraction=diffuse_fraction,
            applied_exposure_ms=list(exposure_map.values())[0] if exposure_map else request.exposure_time_ms,
            applied_exposure_per_sensor=exposure_map if exposure_map else None,
            raw_spectra=raw_spectra_map if raw_spectra_map else None,
            pwv_cm=pwv,
            aod_bands=aod,
            solar_geometry=solar_pos,
            cross_metrics=cross_metrics,
        )

        # ── 7. PERSISTENCIA + BROADCAST ────────────────────────────
        base_dump = result.model_dump()

        target_name = ""
        if request.sensor_target == "Global":
            target_name = "Espectro Global"
        elif request.sensor_target == "Direct":
            target_name = "Espectro Directo"
        else:
            target_name = "Adquisición Total"

        import math
        r_main = MeasurementRecord(
            sensor_target=target_name,
            exposure_time_ms=request.exposure_time_ms,
            measurement_mode=request.measurement_mode,
            par=par,
            ppfd=ppfd,
            illuminance=illuminance,
            total_irradiance=total_irradiance,
            pwv_cm=pwv if pwv is not None and not math.isnan(pwv) else None,
            aod_nm500=aod.get(500, 0.0) if aod and not math.isnan(aod.get(500, 0.0)) else None,
            sza=solar_pos.get('sza'),
            air_mass=air_mass
        )
        r_main.set_spectrum(base_dump)
        db.add(r_main)
        db.commit()
        db.refresh(r_main)

        # Broadcast asíncrono al frontend (no bloqueante)
        asyncio.create_task(ws_manager.broadcast_measurement({
            "id": r_main.id,
            "timestamp": r_main.timestamp.isoformat(),
            "measurement_mode": r_main.measurement_mode,
            "par": par if par is not None and not math.isnan(par) else None,
            "ppfd": ppfd if ppfd is not None and not math.isnan(ppfd) else None,
            "illuminance": illuminance if illuminance is not None and not math.isnan(illuminance) else None,
            "total_irradiance": total_irradiance if total_irradiance is not None and not math.isnan(total_irradiance) else None,
            "pwv_cm": pwv if pwv is not None and not math.isnan(pwv) else None,
            "aod_bands": {k: (v if not math.isnan(v) else None) for k, v in aod.items()} if aod else None,
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
def get_history(page: int = 1, limit: int = 50, db: Session = Depends(get_db)):
    """Obtiene el historial de mediciones recientes (paginado, sin el json pesado)."""
    total = db.query(MeasurementRecord).count()
    offset = (page - 1) * limit
    
    records = db.query(MeasurementRecord).order_by(MeasurementRecord.timestamp.desc()).offset(offset).limit(limit).all()
    
    items = [{
        "id": r.id,
        "timestamp": r.timestamp.isoformat(),
        "sensor_target": r.sensor_target,
        "exposure_time_ms": r.exposure_time_ms,
        "measurement_mode": r.measurement_mode,
        "par": r.par,
        "ppfd": r.ppfd,
        "illuminance": r.illuminance,
        "total_irradiance": r.total_irradiance,
        "pwv_cm": r.pwv_cm,
        "aod_nm500": r.aod_nm500,
        "sza": r.sza,
        "air_mass": r.air_mass
    } for r in records]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }

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
        spectrum_data = record.get_spectrum()
        if 'merged_spectrum' in spectrum_data:
            merged = spectrum_data.get('merged_spectrum')
            global_s = spectrum_data.get('global_spectrum')
            direct_s = spectrum_data.get('direct_spectrum')
            diffuse_s = spectrum_data.get('diffuse_spectrum')
            raw_spectra = spectrum_data.get('raw_spectra')
        else:
            merged = spectrum_data
            global_s = None
            direct_s = None
            diffuse_s = None
            raw_spectra = None
            
        results[record.id] = AnalysisResult(
            merged_spectrum=merged,
            global_spectrum=global_s,
            direct_spectrum=direct_s,
            diffuse_spectrum=diffuse_s,
            raw_spectra=raw_spectra,
            par=record.par,
            ppfd=record.ppfd,
            illuminance=record.illuminance,
            total_irradiance=record.total_irradiance,
            pwv_cm=record.pwv_cm,
            aod_bands={"500nm": record.aod_nm500} if record.aod_nm500 else None,
            solar_geometry={"sza": record.sza, "air_mass": record.air_mass} if record.sza else None
        )
    return results

@router.get("/history/timeseries", tags=["Datalogger"])
def get_history_timeseries(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene métricas radiométricas en un rango de fechas para graficar series de tiempo (Evolución Diaria).
    Además, calcula la integral matemática (Regla del Trapecio) para la irradiación solar acumulada (MJ/m²).
    """
    try:
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Fechas inválidas, use formato ISO 8601.")

    records = db.query(MeasurementRecord).filter(
        MeasurementRecord.timestamp >= start_dt,
        MeasurementRecord.timestamp <= end_dt
    ).order_by(MeasurementRecord.timestamp.asc()).all()

    points = []
    total_irradiation_mj = 0.0

    for i in range(len(records)):
        r = records[i]
        points.append({
            "timestamp": r.timestamp.isoformat(),
            "par": r.par,
            "pwv": r.pwv_cm,
            "aod": r.aod_nm500,
            "total_irradiance": r.total_irradiance,
            "sensor_target": r.sensor_target
        })

        if i > 0 and r.total_irradiance and records[i-1].total_irradiance:
            prev = records[i-1]
            dt_seconds = (r.timestamp - prev.timestamp).total_seconds()
            
            if dt_seconds > 0 and dt_seconds <= 3600: 
                avg_irradiance = (r.total_irradiance + prev.total_irradiance) / 2.0
                joules = avg_irradiance * dt_seconds
                total_irradiation_mj += joules / 1_000_000.0

    return {
        "points": points,
        "total_irradiation_mj": total_irradiation_mj
    }

@router.get("/history/{record_id}", response_model=AnalysisResult, tags=["Datalogger"])
def get_history_detail(record_id: int, db: Session = Depends(get_db)):
    """Obtiene un registro específico incluyendo su espectro completo para graficar."""
    record = db.query(MeasurementRecord).filter(MeasurementRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
        
    spectrum_data = record.get_spectrum()
    if 'merged_spectrum' in spectrum_data:
        merged = spectrum_data.get('merged_spectrum')
        global_s = spectrum_data.get('global_spectrum')
        direct_s = spectrum_data.get('direct_spectrum')
        diffuse_s = spectrum_data.get('diffuse_spectrum')
        raw_spectra = spectrum_data.get('raw_spectra')
    else:
        merged = spectrum_data
        global_s = None
        direct_s = None
        diffuse_s = None
        raw_spectra = None
        
    return AnalysisResult(
        merged_spectrum=merged,
        global_spectrum=global_s,
        direct_spectrum=direct_s,
        diffuse_spectrum=diffuse_s,
        raw_spectra=raw_spectra,
        par=record.par,
        ppfd=record.ppfd,
        illuminance=record.illuminance,
        total_irradiance=record.total_irradiance,
        pwv_cm=record.pwv_cm,
        aod_bands={"500nm": record.aod_nm500} if record.aod_nm500 else None,
        solar_geometry={"zenith": record.sza, "air_mass": record.air_mass} if record.sza else None
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
        MeasurementRecord.measurement_mode,
        MeasurementRecord.par,
        MeasurementRecord.ppfd,
        MeasurementRecord.illuminance,
        MeasurementRecord.total_irradiance,
        MeasurementRecord.pwv_cm,
        MeasurementRecord.aod_nm500,
        MeasurementRecord.sza,
        MeasurementRecord.air_mass
    ).order_by(MeasurementRecord.timestamp.asc())

    def iter_csv():
        # Escribimos las cabeceras
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Fecha/Hora (UTC)", "Sensor", "Exposicion (ms)", "Origen", "RFA (W/m2)", "DFFF (umol/m2/s)", "Iluminancia (lx)", "Irradiancia Total (W/m2)", "AP (cm)", "EOA (500nm)", "ACS (deg)", "Masa de Aire"])
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
                r.measurement_mode,
                f"{r.par:.4f}" if r.par else "N/A",
                f"{r.ppfd:.4f}" if r.ppfd else "N/A",
                f"{r.illuminance:.2f}" if r.illuminance else "N/A",
                f"{r.total_irradiance:.4f}" if r.total_irradiance else "N/A",
                f"{r.pwv_cm:.4f}" if r.pwv_cm else "N/A",
                f"{r.aod_nm500:.4f}" if r.aod_nm500 else "N/A",
                f"{r.sza:.2f}" if r.sza else "N/A",
                f"{r.air_mass:.2f}" if r.air_mass else "N/A"
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
        MeasurementRecord.measurement_mode,
        MeasurementRecord.par,
        MeasurementRecord.ppfd,
        MeasurementRecord.illuminance,
        MeasurementRecord.total_irradiance,
        MeasurementRecord.pwv_cm,
        MeasurementRecord.aod_nm500,
        MeasurementRecord.sza,
        MeasurementRecord.air_mass
    ).filter(MeasurementRecord.id.in_(id_list)).order_by(MeasurementRecord.timestamp.asc())

    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Fecha/Hora (UTC)", "Sensor", "Exposicion (ms)", "Origen", "RFA (W/m2)", "DFFF (umol/m2/s)", "Iluminancia (lx)", "Irradiancia Total (W/m2)", "AP (cm)", "EOA (500nm)", "ACS (deg)", "Masa de Aire"])
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)
        
        for r in query.yield_per(1000):
            writer.writerow([
                r.id,
                r.timestamp.isoformat(),
                r.sensor_target,
                r.exposure_time_ms,
                r.measurement_mode,
                f"{r.par:.4f}" if r.par else "N/A",
                f"{r.ppfd:.4f}" if r.ppfd else "N/A",
                f"{r.illuminance:.2f}" if r.illuminance else "N/A",
                f"{r.total_irradiance:.4f}" if r.total_irradiance else "N/A",
                f"{r.pwv_cm:.4f}" if r.pwv_cm else "N/A",
                f"{r.aod_nm500:.4f}" if r.aod_nm500 else "N/A",
                f"{r.sza:.2f}" if r.sza else "N/A",
                f"{r.air_mass:.2f}" if r.air_mass else "N/A"
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

    pdf.set_font("Helvetica", "B", 7)
    col_widths = [10, 30, 15, 12, 18, 18, 18, 18, 12, 12, 12, 12]
    headers = ["ID", "Fecha/Hora", "Sensor", "Exp(ms)", "RFA(W/m²)", "DFFF", "Ilumin(lx)", "Irr.Tot", "AP(cm)", "EOA", "ACS(°)", "MA"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border=1, align="C")
    pdf.ln()

    # Filas
    pdf.set_font("Helvetica", "", 7)
    for r in records:
        pdf.cell(col_widths[0], 7, str(r.id), border=1, align="C")
        ts = r.timestamp.strftime("%Y-%m-%d %H:%M") if r.timestamp else "N/A"
        pdf.cell(col_widths[1], 7, ts, border=1, align="C")
        pdf.cell(col_widths[2], 7, str(r.sensor_target), border=1, align="C")
        pdf.cell(col_widths[3], 7, str(r.exposure_time_ms), border=1, align="C")
        pdf.cell(col_widths[4], 7, f"{r.par:.4f}" if r.par else "N/A", border=1, align="C")
        pdf.cell(col_widths[5], 7, f"{r.ppfd:.4f}" if r.ppfd else "N/A", border=1, align="C")
        pdf.cell(col_widths[6], 7, f"{r.illuminance:.2f}" if r.illuminance else "N/A", border=1, align="C")
        pdf.cell(col_widths[7], 7, f"{r.total_irradiance:.4f}" if r.total_irradiance else "N/A", border=1, align="C")
        pdf.cell(col_widths[8], 7, f"{r.pwv_cm:.4f}" if r.pwv_cm else "N/A", border=1, align="C")
        pdf.cell(col_widths[9], 7, f"{r.aod_nm500:.4f}" if r.aod_nm500 else "N/A", border=1, align="C")
        pdf.cell(col_widths[10], 7, f"{r.sza:.2f}" if r.sza else "N/A", border=1, align="C")
        pdf.cell(col_widths[11], 7, f"{r.air_mass:.2f}" if r.air_mass else "N/A", border=1, align="C")
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
        pdf.cell(0, 7, f"  RFA (Radiación Fotosintéticamente Activa): {r.par:.4f} W/m²" if r.par else "  RFA: N/A", ln=True)
        pdf.cell(0, 7, f"  DFFF (Densidad de Flujo de Fotones Fotosintéticos): {r.ppfd:.4f} µmol/m²/s" if r.ppfd else "  DFFF: N/A", ln=True)
        pdf.cell(0, 7, f"  Iluminancia Fotópica: {r.illuminance:.2f} lux" if r.illuminance else "  Iluminancia: N/A", ln=True)
        pdf.cell(0, 7, f"  Irradiancia Total: {r.total_irradiance:.4f} W/m²" if r.total_irradiance else "  Irradiancia Total: N/A", ln=True)
        pdf.ln(3)
        pdf.cell(0, 8, "Atmósfera y Geometría Solar", ln=True)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, f"  AP (Agua Precipitable): {r.pwv_cm:.4f} cm" if r.pwv_cm else "  AP: N/A", ln=True)
        pdf.cell(0, 7, f"  EOA (Espesor Óptico de Aerosoles a 500nm): {r.aod_nm500:.4f}" if r.aod_nm500 else "  EOA: N/A", ln=True)
        pdf.cell(0, 7, f"  ACS (Ángulo Cenital Solar): {r.sza:.2f}°" if r.sza else "  ACS: N/A", ln=True)
        pdf.cell(0, 7, f"  MA (Masa de Aire): {r.air_mass:.2f}" if r.air_mass else "  MA: N/A", ln=True)
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
    )