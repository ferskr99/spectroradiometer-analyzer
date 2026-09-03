import serial
import asyncio
from concurrent.futures import ThreadPoolExecutor
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.domain.models import SpectrometerConfig, SpectralData

class EkoSerialAdapter(SpectroradiometerPort):
    """
    Adaptador concreto para la comunicación RS-232C con las fuentes 
    de los espectrorradiómetros MS-711 y MS-713.
    """
    def __init__(self, baudrate: int = 9600, timeout: int = 2):
        self.baudrate = baudrate
        self.timeout = timeout
        self._executor = ThreadPoolExecutor(max_workers=2)
        self.connection = None

    def connect(self, port_name: str) -> bool:
        try:
            self.connection = serial.Serial(
                port=port_name,
                baudrate=self.baudrate,
                timeout=self.timeout
            )
            return self.connection.is_open
        except serial.SerialException as e:
            # Aquí implementaremos logs estructurados posteriormente
            return False

    async def configure_sensor(self, config: SpectrometerConfig) -> bool:
        # Ejecutamos llamadas bloqueantes de I/O en un pool de hilos
        loop = asyncio.get_running_loop()
        command = f"SET_EXP {config.exposure_time_ms}\r\n".encode('ascii')
        
        def _send_command():
            if self.connection and self.connection.is_open:
                self.connection.write(command)
                return True
            return False
            
        return await loop.run_in_executor(self._executor, _send_command)

    async def read_spectrum(self, sensor_id: str) -> SpectralData:
        # Implementación pendiente: parseo de la trama binaria WSD
        pass