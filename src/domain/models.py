# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal

class SpectralData(BaseModel):
    wavelengths: List[float] = Field(..., description="Array de longitudes de onda (nm)")
    irradiance: List[float] = Field(..., description="Irradiancia espectral (W/m2/um)")
    
    @field_validator('wavelengths', 'irradiance')
    def check_arrays_length(cls, v, info):
        if 'wavelengths' in info.data and len(v) != len(info.data['wavelengths']):
            raise ValueError("Los arrays de longitud de onda e irradiancia deben tener la misma longitud.")
        return v

class SpectrometerConfig(BaseModel):
    sensor_id: str = Field(..., pattern="^(MS-711|MS-713)$")
    # El tiempo de exposición debe estar entre 10ms y 5000ms.
    exposure_time_ms: int = Field(default=10, ge=10, le=5000)

class AnalysisRequest(BaseModel):
    """Payload para iniciar una configuración y lectura atómica."""
    sensor_target: Literal["MS-711", "MS-713", "Merge"] = Field(
        ..., description="Sensor a leer, o 'Merge' para adquirir y fusionar ambos."
    )
    exposure_time_ms: int = Field(
        default=10, ge=10, le=5000, description="Tiempo de exposición para la lectura (10-5000ms)."
    )
    auto_exposure: bool = Field(
        default=False, description="Simular cálculo de exposición automática."
    )
    measurement_mode: str = Field(
        default="Manual", description="Origen de la medición (ej. Manual, Continua (Programada))."
    )

class AnalysisResult(BaseModel):
    """Resultado del análisis espectral combinado MS-711 + MS-713."""
    merged_spectrum: Optional[SpectralData] = Field(
        None, description="Espectro fusionado e interpolado a 1nm de resolución"
    )
    par: float = Field(
        ..., description="Radiación Fotosintéticamente Activa (W/m²), integrada de 400 a 700nm"
    )
    ppfd: float = Field(
        ..., description="Densidad de Flujo de Fotones Fotosintéticos (µmol/m²/s)"
    )
    illuminance: float = Field(
        ..., description="Iluminancia fotópica (lux)"
    )
    total_irradiance: float = Field(
        ..., description="Irradiancia total integrada sobre el rango completo (W/m²)"
    )
    applied_exposure_ms: Optional[int] = Field(
        None, description="El tiempo de exposición real usado en ms"
    )
    pwv_cm: Optional[float] = Field(
        None, description="Vapor de Agua Precipitable (cm) calculado por inversión empírica"
    )
    aod_bands: Optional[dict] = Field(
        None, description="Espesor Óptico de Aerosoles (AOD) por longitud de onda {nm: valor}"
    )
    solar_geometry: Optional[dict] = Field(
        None, description="Parámetros de geometría solar (SZA, elevación, masa de aire)"
    )