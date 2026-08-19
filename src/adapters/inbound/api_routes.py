from fastapi import APIRouter, Depends, HTTPException
from src.domain.models import SpectrometerConfig, SpectralData, AnalysisResult
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.application.dependencies import get_hardware_adapter
from src.application.spectral_processing import SpectralProcessorUseCase

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

@router.post("/config", response_model=bool)
async def configure_equipment(
    config: SpectrometerConfig, 
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    return await adapter.configure_sensor(config)

@router.get("/{sensor_id}/spectrum", response_model=SpectralData)
async def get_spectrum(
    sensor_id: str, 
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    if sensor_id not in ["MS-711", "MS-712"]:
        raise HTTPException(status_code=422, detail="Modelo de sensor no soportado.")
    
    return await adapter.read_spectrum(sensor_id)

@router.post("/analyze", response_model=AnalysisResult, tags=["Análisis"])
async def analyze_spectra(
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    """
    Adquiere espectros de ambos sensores (MS-711 y MS-712), los fusiona,
    y calcula PPFD e iluminancia. Toda la lógica matemática reside en
    SpectralProcessorUseCase (capa de aplicación).
    """
    # 1. Adquisición de datos crudos desde el hardware (o simulador)
    ms711_data = await adapter.read_spectrum("MS-711")
    ms712_data = await adapter.read_spectrum("MS-712")

    # 2. Fusión e interpolación a 1nm (delegado al caso de uso)
    merged = SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms712_data)

    # 3. Cálculos radiométricos (delegados al caso de uso)
    par = SpectralProcessorUseCase.calculate_par(merged)
    ppfd = SpectralProcessorUseCase.calculate_ppfd(merged)
    illuminance = SpectralProcessorUseCase.calculate_illuminance(merged)
    total_irradiance = SpectralProcessorUseCase.calculate_total_irradiance(merged)

    return AnalysisResult(
        merged_spectrum=merged,
        par=par,
        ppfd=ppfd,
        illuminance=illuminance,
        total_irradiance=total_irradiance
    )