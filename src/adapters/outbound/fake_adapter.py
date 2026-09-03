import asyncio
import numpy as np
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.models import SpectrometerConfig, SpectralData

class FakeSpectroradiometerAdapter(SpectroradiometerPort):
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
        if getattr(config, 'auto_exposure', False):
            # Simular cálculo dinámico (un barrido de 10ms + tiempo óptimo)
            import random
            ideal_exposure = random.randint(15, 300)
            self.exposure_time_ms = ideal_exposure
            # Emular el tiempo físico real del cálculo + toma
            await asyncio.sleep((10 + self.exposure_time_ms) / 1000.0)
        else:
            # Extrae el exposure_time_ms (cuyo rango válido es de 10 a 5000 milisegundos)
            if config.exposure_time_ms < 10 or config.exposure_time_ms > 5000:
                raise ValueError("El tiempo de exposición debe estar entre 10 y 5000 milisegundos.")
            
            self.exposure_time_ms = config.exposure_time_ms
            
            # Emular el tiempo físico real en el que el obturador permanece abierto
            await asyncio.sleep(self.exposure_time_ms / 1000.0)
        return True

    async def read_spectrum(self, sensor_id: str) -> SpectralData:
        # Límites Físicos de Longitud de Onda
        if sensor_id == "MS-711":
            wavelengths = np.arange(300.0, 1100.0, 0.5) 
        elif sensor_id == "MS-712":
            wavelengths = np.arange(900.0, 1700.0, 1.5)
        else:
            raise ValueError("Identificador de sensor desconocido.")

        # Generación de Espectros Crudos en unidades de irradiancia absoluta (W/m²/μm)
        # Curva de distribución gaussiana + ruido blanco (random noise)
        irradiance = 1000 * np.exp(-0.5 * ((wavelengths - 500) / 100)**2) 
        irradiance += np.random.normal(0, 2, len(wavelengths))

        return SpectralData(
            wavelengths=wavelengths.tolist(),
            irradiance=np.abs(irradiance).tolist()
        )