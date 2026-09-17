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

    async def _calculate_optimal_exposure(self, sensor_id: str) -> int:
        """
        Algoritmo de auto-exposición dinámica:
        1. Disparo de prueba a 10ms
        2. Evalúa pico máximo
        3. Calcula tiempo óptimo buscando 80% de saturación
        4. Acota entre 10ms y 5000ms
        """
        TEST_EXPOSURE = 10
        await asyncio.sleep(TEST_EXPOSURE / 1000.0)
        
        # Obtenemos el espectro de prueba
        test_data = await self.read_spectrum(sensor_id)
        peak_signal = max(test_data.irradiance)
        
        if peak_signal <= 0:
            return 5000

        # Límite de saturación teórico del sensor
        MAX_SATURATION = 2000.0
        TARGET_SIGNAL = MAX_SATURATION * 0.80  # Apuntamos al 80%
        
        # Regla de tres simple asumiendo linealidad del ADC
        optimal = int(TEST_EXPOSURE * (TARGET_SIGNAL / peak_signal))
        
        return max(10, min(5000, optimal))

    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        if getattr(config, 'auto_exposure', False):
            # Algoritmo de Auto-Exposición
            target = getattr(config, 'sensor_target', 'MS-711')
            if target == "Merge":
                target = "MS-711"  # Usamos el 711 de referencia
                
            optimal = await self._calculate_optimal_exposure(target)
            self.exposure_time_ms = optimal
            await asyncio.sleep(self.exposure_time_ms / 1000.0)
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

        # Generación de Espectros Crudos (W/m²/μm)
        # 1. Forma base asimétrica imitando el cuerpo negro solar (pico en visible, cola larga en NIR)
        irradiance = 1200 * np.exp(-0.5 * ((wavelengths - 480) / 180) ** 2) + \
                     500 * np.exp(-0.5 * ((wavelengths - 850) / 500) ** 2)

        # 2. Bandas de absorción atmosférica reales (hace que la gráfica luzca 100% realista)
        irradiance *= (1.0 - 0.5 * np.exp(-0.5 * ((wavelengths - 762) / 6) ** 2))    # Banda O-A (Oxígeno)
        irradiance *= (1.0 - 0.8 * np.exp(-0.5 * ((wavelengths - 940) / 20) ** 2))   # Vapor de agua (PWV)
        irradiance *= (1.0 - 0.85 * np.exp(-0.5 * ((wavelengths - 1140) / 30) ** 2)) # Vapor de agua
        irradiance *= (1.0 - 0.95 * np.exp(-0.5 * ((wavelengths - 1380) / 40) ** 2)) # Vapor de agua fuerte
        irradiance *= (1.0 - 0.95 * np.exp(-0.5 * ((wavelengths - 1870) / 60) ** 2)) # Vapor de agua profundo

        # 3. Ruido blanco térmico del sensor
        irradiance += np.random.normal(0, 4, len(wavelengths))
        
        # Recortar valores negativos físicamente imposibles
        irradiance = np.clip(irradiance, 0, None)

        return SpectralData(
            wavelengths=wavelengths.tolist(),
            irradiance=irradiance.tolist()
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
