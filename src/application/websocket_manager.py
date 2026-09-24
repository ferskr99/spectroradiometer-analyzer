"""
websocket_manager.py

Gestor centralizado de conexiones WebSocket para el sistema SCADA.
Soporta broadcast de telemetría de instrumentos y alertas de error.
"""

from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging
import asyncio
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Administra las conexiones WebSocket activas y proporciona métodos
    especializados para telemetría SCADA y alertas de error.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(
            f"Cliente WebSocket conectado. Total activos: {len(self.active_connections)}"
        )

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(
            f"Cliente WebSocket desconectado. Total activos: {len(self.active_connections)}"
        )

    async def _send_safe(self, connection: WebSocket, message_str: str) -> bool:
        """Envía un mensaje a una conexión individual. Retorna False si falló."""
        try:
            await connection.send_text(message_str)
            return True
        except Exception:
            return False

    async def broadcast(self, message: dict):
        """Broadcast genérico a todos los clientes conectados."""
        if not self.active_connections:
            return

        message_str = json.dumps(message, default=str)
        dead_connections = []

        for connection in self.active_connections:
            if not await self._send_safe(connection, message_str):
                dead_connections.append(connection)

        # Limpiar conexiones muertas
        for connection in dead_connections:
            await self.disconnect(connection)

    async def broadcast_telemetry(self, status: Dict[str, Any]):
        """
        Broadcast especializado para telemetría de instrumentos.
        Inyecta automáticamente el tipo de mensaje y timestamp UTC.
        """
        payload = {
            "type": "telemetry",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": status,
        }
        await self.broadcast(payload)

    async def broadcast_measurement(self, result: dict):
        """
        Broadcast de resultado de medición en tiempo real.
        Empuja métricas radiométricas y atmosféricas al frontend.
        """
        payload = {
            "type": "measurement",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": result,
        }
        await self.broadcast(payload)

    async def broadcast_error(self, error_type: str, detail: str, sensor_id: str = None):
        """
        Broadcast de alerta SCADA crítica a todos los clientes.
        El frontend renderiza estas alertas como notificaciones visuales.
        """
        payload = {
            "type": "scada_error",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "error_type": error_type,
                "sensor_id": sensor_id,
                "detail": detail,
                "severity": "critical",
            },
        }
        await self.broadcast(payload)
        logger.warning(f"SCADA Alert broadcast: [{error_type}] {detail}")


# Instancia global (Singleton)
ws_manager = ConnectionManager()
