# pyrefly: ignore [missing-import]
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.adapters.inbound.api_routes import router as sensors_router

app = FastAPI(
    title="Spectroradiometer Analyzer API",
    description="API para análisis de espectros combinados MS-711 y MS-712",
    version="1.0.0"
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
