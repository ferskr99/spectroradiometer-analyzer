import asyncio
import logging
from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
import httpx
from pydantic import BaseModel
from typing import Optional
from src.application.emergency_protocol import EmergencyProtocol

logger = logging.getLogger(__name__)

class SchedulerConfig(BaseModel):
    start_time: datetime
    end_time: datetime
    interval_minutes: int
    sensor_target: str
    exposure_time_ms: int
    auto_exposure: bool = False

class AdvancedScheduler:
    _config: Optional[SchedulerConfig] = None
    _is_running: bool = False
    _task: Optional[asyncio.Task] = None
    _last_exposure_ms: Optional[int] = None
    
    @classmethod
    def start(cls, config: SchedulerConfig):
        if cls._is_running:
            return False
        
        cls._config = config
        cls._is_running = True
        cls._task = asyncio.create_task(cls._loop())
        logger.info(f"AdvancedScheduler iniciado. Ventana: {config.start_time} a {config.end_time}")
        return True

    @classmethod
    def stop(cls):
        if not cls._is_running:
            return False
            
        cls._is_running = False
        if cls._task:
            cls._task.cancel()
            cls._task = None
        logger.info("AdvancedScheduler detenido.")
        return True

    @classmethod
    def status(cls):
        return {
            "is_running": cls._is_running,
            "config": cls._config.model_dump() if cls._config else None,
            "last_exposure_ms": cls._last_exposure_ms
        }

    @classmethod
    async def _loop(cls):
        while cls._is_running:
            try:
                now = datetime.now(timezone.utc)
                
                if cls._config.end_time and now > cls._config.end_time:
                    logger.info("AdvancedScheduler: El tiempo final ha sido alcanzado. Terminando medición continua.")
                    cls.stop()
                    break
                    
                if cls._config.start_time and now < cls._config.start_time:
                    # Aún no empieza la ventana. Revisar en 5 segundos.
                    await asyncio.sleep(5)
                    continue
                    
                # Estamos dentro de la ventana de medición
                logger.info("AdvancedScheduler: Ejecutando medición programada...")
                
                # Realizar la medición llamando al endpoint interno de manera aislada
                async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
                    resp = await client.post("/api/v1/sensors/analyze", json={
                        "sensor_target": cls._config.sensor_target,
                        "exposure_time_ms": cls._config.exposure_time_ms,
                        "auto_exposure": cls._config.auto_exposure
                    }, timeout=60.0)
                    
                    if resp.status_code != 200:
                        raise Exception(f"HTTP {resp.status_code}: {resp.text}")
                        
                    data = resp.json()
                    cls._last_exposure_ms = data.get("applied_exposure_ms") or getattr(cls._config, 'exposure_time_ms', None)

                logger.info(f"AdvancedScheduler: Medición exitosa. Exposición aplicada: {cls._last_exposure_ms}ms")
                
                # Esperar el intervalo programado antes de la próxima medición
                await asyncio.sleep(cls._config.interval_minutes * 60)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"AdvancedScheduler: Falló la medición continua: {e}")
                # ¡GATILLAR PROTOCOLO DE EMERGENCIA!
                EmergencyProtocol.trigger_emergency_backup(str(e))
                
                # Decisión de negocio: Seguiremos intentando medir en el próximo intervalo
                # en lugar de abortar permanentemente, por si el sensor vuelve a conectarse.
                try:
                    await asyncio.sleep(cls._config.interval_minutes * 60)
                except asyncio.CancelledError:
                    break
