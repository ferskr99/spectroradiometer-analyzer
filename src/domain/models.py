# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Dict

class SpectralData(BaseModel):
    wavelengths: List[float] = Field(..., description="Array de longitudes de onda (nm)")
    irradiance: List[float] = Field(..., description="Irradiancia espectral (W/m2/um)")
    
    @field_validator('wavelengths', 'irradiance')
    def check_arrays_length(cls, v, info):
        if 'wavelengths' in info.data and len(v) != len(info.data['wavelengths']):
            raise ValueError("Los arrays de longitud de onda e irradiancia deben tener la misma longitud.")
        return v

class SpectrometerConfig(BaseModel):
    sensor_id: str = Field(..., description="Identificador del sensor (ej. MS-711_GLOBAL, MS-713_DIRECT)")
    # El tiempo de exposición debe estar entre 10ms y 5000ms.
    exposure_time_ms: int = Field(default=10, ge=10, le=5000)
    auto_exposure: bool = Field(default=False, description="Activar auto-exposición dinámica")

class AnalysisRequest(BaseModel):
    """Payload para iniciar una configuración y lectura atómica."""
    sensor_target: Literal["Global", "Direct", "All"] = Field(
        ..., description="Grupo de sensores: 'Global' (GHI), 'Direct' (DNI), o 'All' (ambos)."
    )
    exposure_time_ms: int = Field(
        default=10, ge=10, le=5000, description="Tiempo de exposición para la lectura (10-5000ms)."
    )
    auto_exposure: bool = Field(
        default=False, description="Activar cálculo de exposición automática iterativa."
    )
    measurement_mode: str = Field(
        default="Manual", description="Origen de la medición (ej. Manual, Continua (Programada))."
    )

class AnalysisResult(BaseModel):
    """Resultado del análisis espectral combinado (Global y/o Directo)."""
    # Espectros fusionados
    global_spectrum: Optional[SpectralData] = Field(
        None, description="Espectro fusionado del grupo Global (GHI)"
    )
    direct_spectrum: Optional[SpectralData] = Field(
        None, description="Espectro fusionado del grupo Directo (DNI)"
    )
    diffuse_spectrum: Optional[SpectralData] = Field(
        None, description="Espectro difuso horizontal derivado DHI(λ) = GHI(λ) - DNI(λ)*cos(SZA)"
    )
    raw_spectra: Optional[Dict[str, SpectralData]] = Field(
        None, description="Espectros individuales crudos sin interpolar (ej. MS-711_GLOBAL)"
    )
    # Retrocompatibilidad: merged_spectrum apunta al espectro principal
    merged_spectrum: Optional[SpectralData] = Field(
        None, description="Espectro fusionado principal (alias del global o único disponible)"
    )
    # Métricas radiométricas (calculadas desde Global)
    par: Optional[float] = Field(default=None, description="Radiación Fotosintéticamente Activa (W/m²), integrada de 400 a 700nm"
    )
    ppfd: Optional[float] = Field(default=None, description="Densidad de Flujo de Fotones Fotosintéticos (µmol/m²/s)"
    )
    illuminance: Optional[float] = Field(default=None, description="Iluminancia fotópica (lux)"
    )
    total_irradiance: Optional[float] = Field(default=None, description="GHI - Irradiancia Global Horizontal integrada (W/m²)"
    )
    # Nuevas métricas derivadas (requieren espectro directo)
    dni: Optional[float] = Field(
        None, description="DNI - Irradiancia Normal Directa integrada (W/m²)"
    )
    dhi: Optional[float] = Field(
        None, description="DHI - Irradiancia Difusa Horizontal (W/m²) = GHI - DNI*cos(SZA)"
    )
    clearness_index: Optional[float] = Field(
        None, description="Índice de Claridad k_t = GHI / E₀"
    )
    diffuse_fraction: Optional[float] = Field(
        None, description="Fracción Difusa k_d = DHI / GHI"
    )
    # Exposición aplicada (ahora por sensor)
    applied_exposure_ms: Optional[int] = Field(
        None, description="El tiempo de exposición real usado en ms (legacy)"
    )
    applied_exposure_per_sensor: Optional[Dict[str, int]] = Field(
        None, description="Exposición aplicada por sensor: {'MS-711_GLOBAL': 120, ...}"
    )
    # Inversión atmosférica (calculados desde espectro directo si disponible)
    pwv_cm: Optional[float] = Field(
        None, description="Vapor de Agua Precipitable (cm) calculado por inversión empírica"
    )
    aod_bands: Optional[dict] = Field(
        None, description="Espesor Óptico de Aerosoles (AOD) por longitud de onda {nm: valor}"
    )
    solar_geometry: Optional[dict] = Field(
        None, description="Parámetros de geometría solar (SZA, elevación, masa de aire)"
    )
    # Métricas cruzadas (stub para futuro)
    cross_metrics: Optional[dict] = Field(
        None, description="Métricas cruzadas GHI/DNI (reservado para futuras versiones)"
    )

# ─── Configuración de Hardware ─────────────────────────────────────
class SensorPortConfig(BaseModel):
    """Configuración de un solo sensor."""
    port: str = Field(..., description="Puerto COM o dispositivo serial (ej. COM3, /dev/ttyUSB0)")
    enabled: bool = Field(default=True, description="Si el sensor está habilitado")

class SensorGroupConfig(BaseModel):
    """Par de sensores para un tipo de medición."""
    ms711: SensorPortConfig
    ms713: SensorPortConfig

class HardwareSettings(BaseModel):
    """Configuración completa de hardware persistida en settings.json."""
    sensors: dict  # {"global": SensorGroupConfig, "direct": SensorGroupConfig}
    tracker: Optional[SensorPortConfig] = None
