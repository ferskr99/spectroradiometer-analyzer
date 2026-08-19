# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class SpectralData(BaseModel):
    wavelengths: List[float] = Field(..., description="Array de longitudes de onda (nm)")
    irradiance: List[float] = Field(..., description="Irradiancia espectral (W/m2/um)")
    
    @field_validator('wavelengths', 'irradiance')
    def check_arrays_length(cls, v, info):
        if 'wavelengths' in info.data and len(v) != len(info.data['wavelengths']):
            raise ValueError("Los arrays de longitud de onda e irradiancia deben tener la misma longitud.")
        return v

class SpectrometerConfig(BaseModel):
    sensor_id: str = Field(..., pattern="^(MS-711|MS-712)$")
    # El tiempo de exposición debe estar entre 10ms y 5000ms.
    exposure_time_ms: int = Field(default=10, ge=10, le=5000)

class AnalysisResult(BaseModel):
    """Resultado del análisis espectral combinado MS-711 + MS-712."""
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