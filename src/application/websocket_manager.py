from fastapi import WebSocket
from typing import List
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Nuevo cliente WebSocket conectado. Total activos: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Cliente WebSocket desconectado. Total activos: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
            
        message_str = json.dumps(message)
        dead_connections = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error enviando mensaje WebSocket a cliente: {e}")
                dead_connections.append(connection)
                
        # Limpiar conexiones muertas
        for connection in dead_connections:
            self.disconnect(connection)

ws_manager = ConnectionManager()
