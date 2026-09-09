from abc import ABC, abstractmethod
from src.domain.models import SpectrometerConfig, SpectralData


class SpectroradiometerPort(ABC):
    """
    Puerto de salida (Outbound) para la comunicación abstracta con el hardware.
    La implementación concreta usará PySerial para la interfaz RS-232C.
    """

    @abstractmethod
    def connect(self, port_name: str) -> bool:
        pass

    @abstractmethod
    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        pass

    @abstractmethod
    async def read_spectrum(self, sensor_id: str) -> SpectralData:
        pass

    @abstractmethod
    async def read_instrument_status(self, sensor_id: str) -> dict:
        """
        Lee el estado operativo del instrumento (telemetría).

        Para el MS-711:
            - sensor_temp_c: Temperatura del sensor (°C)
            - supply_voltage_v: Voltaje de alimentación (V)

        Para el MS-713:
            - peltier_temp_c: Temperatura del detector InGaAs estabilizado por TEC (°C)
            - supply_16v: Voltaje de la fuente principal (VDC)
            - supply_5v: Voltaje de la fuente lógica (VDC)

        Args:
            sensor_id: Identificador del sensor ("MS-711" o "MS-713").

        Returns:
            dict con las métricas de telemetría del instrumento.

        Raises:
            HardwareConnectionError: Si el sensor no responde.
        """
        pass
