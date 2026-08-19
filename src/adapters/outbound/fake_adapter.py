import asyncio
import numpy as np
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.models import SpectrometerConfig, SpectralData

class FakeEkoAdapter(SpectroradiometerPort):
    """
    Simulador en memoria para los espectrorradiómetros.
    Ideal para tests unitarios y desarrollo del Frontend en React.
    """
    def __init__(self):
        self.connected = False
        self.exposure_time_ms = 10

    def connect(self, port_name: str) -> bool:
        self.connected = True
        return True

    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        # El equipo real acepta tiempos de exposición entre 10 y 5000 ms[cite: 1].
        self.exposure_time_ms = config.exposure_time_ms
        return True

    async def read_spectrum(self, sensor_id: str) -> SpectralData:
        # Simulamos el tiempo de bloqueo I/O del espectrómetro real
        await asyncio.sleep(self.exposure_time_ms / 1000.0)

        # Respetamos los rangos físicos y resoluciones de los equipos[cite: 1]
        if sensor_id == "MS-711":
            wavelengths = np.arange(300.0, 1100.0, 0.5) 
        elif sensor_id == "MS-712":
            wavelengths = np.arange(900.0, 1700.0, 1.5)
        else:
            raise ValueError("Identificador de sensor desconocido.")

        # Generamos una distribución sintética de irradiancia espectral con ruido gaussiano
        irradiance = 1000 * np.exp(-0.5 * ((wavelengths - 500) / 100)**2) 
        irradiance += np.random.normal(0, 2, len(wavelengths))

        return SpectralData(
            wavelengths=wavelengths.tolist(),
            irradiance=np.abs(irradiance).tolist()
        )