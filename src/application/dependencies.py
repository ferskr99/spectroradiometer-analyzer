import os
# ERROR CORREGIDO: Se eliminó 'from fastapi import Depends'
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.adapters.outbound.fake_adapter import FakeEkoAdapter
from src.adapters.outbound.serial_adapter import EkoSerialAdapter

# MEJORA: Tipado estricto forzando la interfaz abstracta (Liskov Substitution Principle)
_fake_adapter: SpectroradiometerPort = FakeEkoAdapter()
_serial_adapter: SpectroradiometerPort = EkoSerialAdapter(baudrate=9600, timeout=2)

def get_hardware_adapter() -> SpectroradiometerPort:
    """
    Inyector de dependencias. 
    Evalúa si el sistema está en modo simulación o conectado al hardware real.
    """
    use_simulator = os.getenv("USE_SIMULATOR", "True").lower() in ("true", "1", "yes")
    
    if use_simulator:
        return _fake_adapter
    else:
        # FÍSICA Y HARDWARE: Conexión RS-232C hacia la fuente de alimentación[cite: 1].
        # MEJORA: Chequeo explícito de existencia y estado del puerto para evitar bloqueos
        if _serial_adapter.connection is None or not _serial_adapter.connection.is_open:
            com_port = os.getenv("EKO_COM_PORT", "COM1")
            _serial_adapter.connect(com_port)
            
        return _serial_adapter