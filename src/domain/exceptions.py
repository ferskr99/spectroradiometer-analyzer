"""
exceptions.py

Excepciones tipadas del dominio para el sistema SCADA.
Cada excepción transporta contexto estructurado (sensor_id, operación, detalle)
que los adaptadores de entrada traducen a códigos HTTP/WS específicos.
"""


class SCADABaseError(Exception):
    """Clase base para todas las excepciones del dominio SCADA."""

    def __init__(self, detail: str, sensor_id: str = None):
        self.detail = detail
        self.sensor_id = sensor_id
        super().__init__(detail)

    def to_dict(self) -> dict:
        """Serializa la excepción para payloads JSON de respuesta."""
        return {
            "error_type": self.__class__.__name__,
            "sensor_id": self.sensor_id,
            "detail": self.detail,
        }


class HardwareConnectionError(SCADABaseError):
    """
    El sensor no responde o el puerto serial está cerrado/desconectado.
    Mapeado a HTTP 503 / WebSocket Close 1011 (Internal Error).
    """

    def __init__(self, sensor_id: str, detail: str = "Sensor no responde"):
        super().__init__(detail=detail, sensor_id=sensor_id)


class HardwareTimeoutError(SCADABaseError):
    """
    El obturador no completó la exposición dentro del tiempo esperado.
    Mapeado a HTTP 504 / WebSocket Close 1013 (Try Again Later).
    """

    def __init__(self, sensor_id: str, timeout_ms: int):
        self.timeout_ms = timeout_ms
        super().__init__(
            detail=f"Timeout de exposición: {timeout_ms}ms excedido",
            sensor_id=sensor_id,
        )

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["timeout_ms"] = self.timeout_ms
        return d


class SpectralProcessingError(SCADABaseError):
    """
    Error en el motor de procesamiento espectral (fusión, interpolación,
    broadcasting de NumPy, etc.).
    Mapeado a HTTP 422 Unprocessable Entity.
    """

    def __init__(self, operation: str, detail: str):
        self.operation = operation
        super().__init__(detail=f"[{operation}] {detail}")

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["operation"] = self.operation
        return d


class CalibrationError(SCADABaseError):
    """
    Datos de calibración inválidos, vencidos o incompatibles.
    Mapeado a HTTP 422 Unprocessable Entity.
    """

    def __init__(self, sensor_id: str, detail: str = "Calibración inválida o vencida"):
        super().__init__(detail=detail, sensor_id=sensor_id)
