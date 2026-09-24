import asyncio
import random
import math
import numpy as np

from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.models import SpectrometerConfig, SpectralData


class EkoFakeAdapter(SpectroradiometerPort):
    """
    Adaptador simulado para los 4 espectrorradiómetros EKO (2x MS-711 y 2x MS-713).

    Modelos de hardware soportados:
      - MS-711_GLOBAL: Medición GHI UV-VIS-NIR corto (300 - 1100 nm). Exp 10-5000ms.
      - MS-713_GLOBAL: Medición GHI SWIR (900 - 2500 nm). Exp 1-30ms.
      - MS-711_DIRECT: Medición DNI con seguidor solar y colimador 5°. Exp 10-5000ms.
      - MS-713_DIRECT: Medición DNI con seguidor solar y colimador 5°. Exp 1-30ms.
    """

    def __init__(self):
        self.exposure_time_ms: int = 100
        self._exposure_per_sensor: dict = {
            "MS-711_GLOBAL": 120,
            "MS-713_GLOBAL": 8,
            "MS-711_DIRECT": 250,
            "MS-713_DIRECT": 12,
        }
        self._telemetry: dict = {}

    def connect(self, port_name: str = "SIMULATED") -> bool:
        """Simula la conexión exitosa con los instrumentos."""
        return True

    def _resolve_sensor_id(self, sensor_id: str) -> str:
        """Normaliza aliases legacy a IDs unívocos de los 4 instrumentos."""
        if sensor_id == "MS-711":
            return "MS-711_GLOBAL"
        elif sensor_id == "MS-713":
            return "MS-713_GLOBAL"
        return sensor_id

    def _get_base_model(self, sensor_id: str) -> str:
        """Obtiene el modelo base (MS-711 o MS-713)."""
        resolved = self._resolve_sensor_id(sensor_id)
        return "MS-711" if "MS-711" in resolved else "MS-713"

    def _is_direct(self, sensor_id: str) -> bool:
        """Determina si el sensor pertenece al grupo de medición directa (DNI)."""
        return "DIRECT" in self._resolve_sensor_id(sensor_id)

    # ─── AUTO-EXPOSICIÓN ITERATIVA CIENTÍFICA ───────────────────────

    async def calculate_optimal_exposure(self, sensor_id: str) -> int:
        """
        Algoritmo de auto-exposición iterativa con convergencia por modelo de hardware.

        - MS-711: Rango hardware 10ms – 5000ms.
        - MS-713 (InGaAs SWIR): Rango hardware 1ms – 30ms.

        Busca el punto óptimo (~80% de saturación, ~52,000 ADU en 16-bit).
        """
        resolved = self._resolve_sensor_id(sensor_id)
        base_model = self._get_base_model(resolved)
        is_direct = self._is_direct(resolved)

        if base_model == "MS-713":
            min_exp, max_exp = 1, 30
            target_exp = 10 if is_direct else 8
        else:
            min_exp, max_exp = 10, 5000
            target_exp = 250 if is_direct else 120

        # Simula pequeña fluctuación solar según nubosidad
        cloud_factor = random.uniform(0.90, 1.10)
        optimal = int(target_exp * cloud_factor)
        return max(min_exp, min(max_exp, optimal))

    # ─── CONFIGURACIÓN ─────────────────────────────────────────────

    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        resolved_id = self._resolve_sensor_id(config.sensor_id)
        base_model = self._get_base_model(resolved_id)

        if getattr(config, 'auto_exposure', False):
            optimal = await self.calculate_optimal_exposure(resolved_id)
            self._exposure_per_sensor[resolved_id] = optimal
            self.exposure_time_ms = optimal
            await asyncio.sleep(0.02)
        else:
            req_exp = config.exposure_time_ms
            if base_model == "MS-713":
                exp = max(1, min(30, req_exp))
            else:
                exp = max(10, min(5000, req_exp))
            self._exposure_per_sensor[resolved_id] = exp
            self.exposure_time_ms = exp
            await asyncio.sleep(0.01)
        return True

    # ─── LECTURA DE ESPECTROS ──────────────────────────────────────

    async def _read_spectrum_raw(self, sensor_id: str, exposure_ms: int = 100) -> SpectralData:
        """
        Genera irradiancia espectral calibrada (W/m²/µm).
        """
        resolved = self._resolve_sensor_id(sensor_id)
        base_model = self._get_base_model(resolved)
        is_direct = self._is_direct(resolved)

        if base_model == "MS-711":
            wavelengths = np.arange(300.0, 1100.0, 0.5)
        else:
            wavelengths = np.arange(900.0, 2500.0, 2.0)

        irradiance = 1250 * np.exp(-0.5 * ((wavelengths - 480) / 170) ** 2) +                      520 * np.exp(-0.5 * ((wavelengths - 850) / 480) ** 2)

        irradiance *= (1.0 - 0.45 * np.exp(-0.5 * ((wavelengths - 762) / 6) ** 2))
        irradiance *= (1.0 - 0.75 * np.exp(-0.5 * ((wavelengths - 940) / 22) ** 2))
        irradiance *= (1.0 - 0.85 * np.exp(-0.5 * ((wavelengths - 1140) / 30) ** 2))
        irradiance *= (1.0 - 0.96 * np.exp(-0.5 * ((wavelengths - 1380) / 40) ** 2))
        irradiance *= (1.0 - 0.96 * np.exp(-0.5 * ((wavelengths - 1870) / 60) ** 2))

        if is_direct:
            direct_factor = 0.82
            irradiance *= direct_factor
            rayleigh = np.exp(-0.00015 * (wavelengths - 300) ** 0.85)
            irradiance *= rayleigh

        optimal_exp = 10 if base_model == "MS-713" else 150
        noise_level = 0.5 + 2.0 * abs(exposure_ms - optimal_exp) / float(optimal_exp)
        irradiance += np.random.normal(0, min(3.0, noise_level), len(wavelengths))
        irradiance = np.clip(irradiance, 0, None)

        return SpectralData(
            wavelengths=wavelengths.tolist(),
            irradiance=irradiance.tolist()
        )

    async def read_spectrum(self, sensor_id: str) -> SpectralData:
        resolved = self._resolve_sensor_id(sensor_id)
        exp = self._exposure_per_sensor.get(resolved, 100)
        return await self._read_spectrum_raw(resolved, exposure_ms=exp)

    # ─── TELEMETRÍA ────────────────────────────────────────────────

    async def read_instrument_status(self, sensor_id: str) -> dict:
        resolved = self._resolve_sensor_id(sensor_id)
        base_model = self._get_base_model(resolved)

        if resolved not in self._telemetry:
            if base_model == "MS-711":
                self._telemetry[resolved] = {"temp": 24.5}
            else:
                self._telemetry[resolved] = {"peltier": -20.0, "v16": 16.0, "v5": 5.0}

        state = self._telemetry[resolved]

        if base_model == "MS-711":
            state["temp"] += random.uniform(-0.05, 0.05)
            state["temp"] = max(20.0, min(30.0, state["temp"]))
            return {
                "sensor_id": resolved,
                "sensor_temp_c": round(state["temp"], 2),
                "supply_voltage_v": round(12.0 + random.uniform(-0.08, 0.08), 3),
                "connection": "Stable",
                "shutter_status": "Closed",
                "last_exposure_ms": self._exposure_per_sensor.get(resolved),
            }
        else:
            state["peltier"] += random.uniform(-0.03, 0.03)
            state["peltier"] = max(-21.0, min(-19.0, state["peltier"]))
            state["v16"] = 16.0 + random.uniform(-0.05, 0.05)
            state["v5"] = 5.0 + random.uniform(-0.02, 0.02)
            return {
                "sensor_id": resolved,
                "peltier_temp_c": round(state["peltier"], 2),
                "supply_16v": round(state["v16"], 3),
                "supply_5v": round(state["v5"], 3),
                "connection": "Stable",
                "shutter_status": "Closed",
                "last_exposure_ms": self._exposure_per_sensor.get(resolved),
            }

# Alias para retrocompatibilidad
FakeSpectroradiometerAdapter = EkoFakeAdapter
