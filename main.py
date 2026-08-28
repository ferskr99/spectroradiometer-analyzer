import asyncio
import logging
from contextlib import asynccontextmanager
# pyrefly: ignore [missing-import]
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.adapters.inbound.api_routes import router as sensors_router
from src.infrastructure.db.database import engine, Base
import src.infrastructure.db.models  # Import to register models
from src.application.backup_service import BackupService
from src.application.scheduler_service import SchedulerService
from src.infrastructure.db.database import SessionLocal
from src.application.dependencies import get_hardware_adapter

logging.basicConfig(level=logging.INFO)

# Crear tablas de la base de datos
Base.metadata.create_all(bind=engine)

async def auto_backup_loop():
    while True:
        await asyncio.sleep(5) 
        BackupService.perform_backup()
        await asyncio.sleep(86400) 

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup Scheduler
    adapter = get_hardware_adapter()
    SchedulerService.setup(adapter, SessionLocal)

    # Iniciar la tarea en segundo plano al arrancar
    task = asyncio.create_task(auto_backup_loop())
    yield
    # Limpiar al apagar
    task.cancel()
    SchedulerService.stop()

app = FastAPI(
    title="Spectroradiometer Analyzer API",
    description="API para análisis de espectros combinados MS-711 y MS-712",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS para permitir que el frontend React consuma la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, restringir a la URL del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir las rutas (el prefix ya está definido en api_routes.py)
app.include_router(sensors_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
