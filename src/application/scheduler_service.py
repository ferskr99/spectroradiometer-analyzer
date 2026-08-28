import asyncio
import logging
from src.domain.models import AnalysisRequest

logger = logging.getLogger(__name__)

class SchedulerService:
    _is_running = False
    _interval_minutes = 10
    _task: asyncio.Task | None = None
    _adapter = None
    _db_session_factory = None

    @classmethod
    def setup(cls, adapter, db_session_factory):
        cls._adapter = adapter
        cls._db_session_factory = db_session_factory

    @classmethod
    async def _loop(cls):
        logger.info(f"Scheduler iniciado. Midiendo cada {cls._interval_minutes} minutos.")
        while cls._is_running:
            try:
                logger.info("Scheduler: Ejecutando medición automática...")
                # Importamos aquí para evitar ciclos circulares
                from src.application.spectral_processing import SpectralProcessorUseCase
                from src.infrastructure.db.models import MeasurementRecord
                from src.domain.models import SpectrometerConfig

                # Configuración por defecto para scheduler
                request = AnalysisRequest(sensor_target="Merge", exposure_time_ms=10)

                # 1. Simular / Adquirir datos
                ms711_data = await cls._adapter.read_spectrum("MS-711")
                ms712_data = await cls._adapter.read_spectrum("MS-712")
                interpolated = SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms712_data)

                # 2. Cálculos
                par = SpectralProcessorUseCase.calculate_par(interpolated)
                ppfd = SpectralProcessorUseCase.calculate_ppfd(interpolated)
                ill = SpectralProcessorUseCase.calculate_illuminance(interpolated)
                irr = SpectralProcessorUseCase.calculate_total_irradiance(interpolated)

                # 3. Guardar en DB
                db = cls._db_session_factory()
                try:
                    record = MeasurementRecord(
                        sensor_target=request.sensor_target,
                        exposure_time_ms=request.exposure_time_ms,
                        par=par,
                        ppfd=ppfd,
                        illuminance=ill,
                        total_irradiance=irr
                    )
                    record.set_spectrum(interpolated.model_dump())
                    db.add(record)
                    db.commit()
                    logger.info(f"Scheduler: Medición #{record.id} guardada exitosamente.")
                finally:
                    db.close()

            except Exception as e:
                logger.error(f"Scheduler Error: {e}")

            # Dormir el intervalo especificado
            await asyncio.sleep(cls._interval_minutes * 60)

    @classmethod
    def start(cls, interval_minutes: int):
        if cls._is_running:
            return False
        
        cls._interval_minutes = interval_minutes
        cls._is_running = True
        cls._task = asyncio.create_task(cls._loop())
        return True

    @classmethod
    def stop(cls):
        if not cls._is_running:
            return False
        
        cls._is_running = False
        if cls._task:
            cls._task.cancel()
            cls._task = None
        logger.info("Scheduler detenido.")
        return True

    @classmethod
    def status(cls):
        return {
            "is_running": cls._is_running,
            "interval_minutes": cls._interval_minutes
        }
