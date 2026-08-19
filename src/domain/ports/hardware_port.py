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