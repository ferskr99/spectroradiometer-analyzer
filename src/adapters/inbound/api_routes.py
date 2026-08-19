from fastapi import APIRouter, Depends, HTTPException
from src.domain.models import SpectrometerConfig, SpectralData, AnalysisResult, AnalysisRequest
from src.domain.ports.hardware_port import SpectroradiometerPort
from src.application.dependencies import get_hardware_adapter
from src.application.spectral_processing import SpectralProcessorUseCase

router = APIRouter(prefix="/api/v1/sensors", tags=["Hardware"])

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
    request: AnalysisRequest,
    adapter: SpectroradiometerPort = Depends(get_hardware_adapter)
):
    """
    Configura de forma atómica y adquiere los datos de los sensores solicitados.
    """
    # 1. Configurar ambos equipos (si es Merge) o solo el seleccionado con el exposure_time solicitado
    if request.sensor_target in ["MS-711", "Merge"]:
        await adapter.configure_sensor(SpectrometerConfig(sensor_id="MS-711", exposure_time_ms=request.exposure_time_ms))
    if request.sensor_target in ["MS-712", "Merge"]:
        await adapter.configure_sensor(SpectrometerConfig(sensor_id="MS-712", exposure_time_ms=request.exposure_time_ms))

    # 2. Adquirir y procesar datos crudos
    if request.sensor_target == "MS-711":
        data = await adapter.read_spectrum("MS-711")
        interpolated = data
    elif request.sensor_target == "MS-712":
        data = await adapter.read_spectrum("MS-712")
        interpolated = data
    else:
        ms711_data = await adapter.read_spectrum("MS-711")
        ms712_data = await adapter.read_spectrum("MS-712")
        interpolated = SpectralProcessorUseCase.merge_and_interpolate(ms711_data, ms712_data)

    # 3. Cálculos radiométricos deterministas
    par = SpectralProcessorUseCase.calculate_par(interpolated)
    ppfd = SpectralProcessorUseCase.calculate_ppfd(interpolated)
    illuminance = SpectralProcessorUseCase.calculate_illuminance(interpolated)
    total_irradiance = SpectralProcessorUseCase.calculate_total_irradiance(interpolated)

    return AnalysisResult(
        merged_spectrum=interpolated,
        par=par,
        ppfd=ppfd,
        illuminance=illuminance,
        total_irradiance=total_irradiance
    )