"""
fake_adapter.py

Simulador en memoria para los espectrorradiómetros EKO MS-711 y MS-713.
Ideal para tests unitarios y desarrollo del Frontend en React.
Implementa todos los métodos del puerto abstracto SpectroradiometerPort.
"""

import asyncio
import random
import numpy as np
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.models import SpectrometerConfig, SpectralData
from src.domain.exceptions import HardwareConnectionError


class FakeSpectroradiometerAdapter(SpectroradiometerPort):
    """
    Simulador que emula el comportamiento temporal y eléctrico de los
    espectrorradiómetros EKO MS-711 y MS-713 incluyendo telemetría de
    temperatura Peltier, voltajes de alimentación y espectros gaussianos.
    """

    def __init__(self):
        self.connected = False
        self.exposure_time_ms = 10
        # Estado interno de telemetría simulada (drift lento)
        self._ms711_temp = 24.5
        self._ms713_peltier = -20.0
        self._ms713_16v = 16.0
        self._ms713_5v = 5.0

    def connect(self, port_name: str) -> bool:
        self.connected = True
        return True

    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        if getattr(config, 'auto_exposure', False):
            # Simular cálculo dinámico (un barrido de 10ms + tiempo óptimo)
            ideal_exposure = random.randint(15, 300)
            self.exposure_time_ms = ideal_exposure
            # Emular el tiempo físico real del cálculo + toma
            await asyncio.sleep((10 + self.exposure_time_ms) / 1000.0)
        else:
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
        elif sensor_id == "MS-713":
            wavelengths = np.arange(900.0, 2500.0, 2.0)
        else:
            raise HardwareConnectionError(
                sensor_id=sensor_id,
                detail=f"Identificador de sensor desconocido: {sensor_id}"
            )

        # Generación de Espectros Crudos en unidades de irradiancia absoluta (W/m²/μm)
        # Curva de distribución gaussiana + ruido blanco (random noise)
        irradiance = 1000 * np.exp(-0.5 * ((wavelengths - 500) / 100) ** 2)
        irradiance += np.random.normal(0, 2, len(wavelengths))

        return SpectralData(
            wavelengths=wavelengths.tolist(),
            irradiance=np.abs(irradiance).tolist()
        )

    async def read_instrument_status(self, sensor_id: str) -> dict:
        """
        Simula la telemetría del instrumento con drift térmico realista.

        MS-711: Sensor a temperatura ambiente (~24.5°C), alimentación 12VDC.
        MS-713: Detector InGaAs enfriado por Peltier (TEC) a -20°C,
                fuente principal 16VDC, fuente lógica 5VDC.
        """
        if sensor_id == "MS-711":
            # Drift térmico lento ±0.3°C
            self._ms711_temp += random.uniform(-0.05, 0.05)
            self._ms711_temp = max(20.0, min(30.0, self._ms711_temp))

            return {
                "sensor_id": "MS-711",
                "sensor_temp_c": round(self._ms711_temp, 2),
                "supply_voltage_v": round(12.0 + random.uniform(-0.08, 0.08), 3),
                "connection": "Stable",
                "shutter_status": "Closed",
            }

        elif sensor_id == "MS-713":
            # Peltier estabilizado a -20°C con oscilación ±0.15°C (control PID)
            self._ms713_peltier += random.uniform(-0.03, 0.03)
            self._ms713_peltier = max(-21.0, min(-19.0, self._ms713_peltier))

            # Voltajes con ripple realista
            self._ms713_16v = 16.0 + random.uniform(-0.05, 0.05)
            self._ms713_5v = 5.0 + random.uniform(-0.02, 0.02)

            return {
                "sensor_id": "MS-713",
                "peltier_temp_c": round(self._ms713_peltier, 2),
                "supply_16v": round(self._ms713_16v, 3),
                "supply_5v": round(self._ms713_5v, 3),
                "connection": "Stable",
                "shutter_status": "Closed",
            }

        else:
            raise HardwareConnectionError(
                sensor_id=sensor_id,
                detail=f"Sensor desconocido para telemetría: {sensor_id}"
            )
