"""
feature_extractor.py

Extractor de características (features) para el modelo de clasificación
atmosférica. Convierte métricas radiométricas crudas en un vector
numérico normalizado apto para scikit-learn.

Features extraídas (9 dimensiones):
    1. GHI (Irradiancia Global Horizontal) [W/m²]
    2. DNI (Irradiancia Normal Directa) [W/m²]
    3. DHI (Irradiancia Difusa Horizontal) [W/m²]
    4. Kt  (Índice de Claridad) [adimensional, 0-1]
    5. Kd  (Fracción Difusa) [adimensional, 0-1]
    6. AOD@500nm (Espesor Óptico de Aerosoles)
    7. PWV (Vapor de Agua Precipitable) [cm]
    8. SZA (Ángulo Zenital Solar) [°]
    9. PAR (Radiación Fotosintéticamente Activa) [W/m²]
"""

import numpy as np
import logging
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

# Nombres canónicos de las features (orden estricto)
FEATURE_NAMES = [
    "ghi", "dni", "dhi", "clearness_index", "diffuse_fraction",
    "aod_500", "pwv_cm", "sza", "par"
]

# Etiquetas de clase para el clasificador
SKY_CLASSES = {
    0: "Cielo Despejado",
    1: "Nubosidad Parcial",
    2: "Cielo Nublado",
}

# Umbrales físicos para etiquetado automático basado en reglas
# Referencia: Long & Ackerman (2000), Min et al. (2008)
LABELING_RULES = {
    "clear":    {"kt_min": 0.65, "kd_max": 0.30},
    "partial":  {"kt_min": 0.35, "kt_max": 0.65},
    "overcast": {"kt_max": 0.35, "kd_min": 0.70},
}


class FeatureExtractor:
    """
    Transforma registros de medición en vectores de features para ML.
    
    Soporta dos modos:
      1. Desde un dict de AnalysisResult (tiempo real)
      2. Desde un registro de base de datos MeasurementRecord (entrenamiento)
    """

    @staticmethod
    def from_analysis_result(result: dict) -> Optional[np.ndarray]:
        """
        Extrae el vector de features desde un diccionario de AnalysisResult.
        Retorna None si los datos son insuficientes para clasificar.
        """
        try:
            cross = result.get("cross_metrics") or {}
            solar = result.get("solar_geometry") or {}
            aod = result.get("aod_bands") or {}

            ghi = result.get("total_irradiance")
            dni = cross.get("dni") or result.get("dni")
            dhi = cross.get("dhi") or result.get("dhi")
            kt = cross.get("clearness_index") or result.get("clearness_index")
            kd = cross.get("diffuse_fraction") or result.get("diffuse_fraction")
            aod_500 = aod.get(500, aod.get("500"))
            pwv = result.get("pwv_cm")
            sza = solar.get("sza")
            par = result.get("par")

            # Validar que tenemos las métricas mínimas necesarias
            if ghi is None or kt is None or sza is None:
                logger.debug("Features insuficientes para clasificación ML")
                return None

            features = np.array([
                _safe_float(ghi, 0.0),
                _safe_float(dni, 0.0),
                _safe_float(dhi, 0.0),
                _safe_float(kt, 0.0),
                _safe_float(kd, 0.0),
                _safe_float(aod_500, 0.1),
                _safe_float(pwv, 1.0),
                _safe_float(sza, 45.0),
                _safe_float(par, 0.0),
            ], dtype=np.float64)

            return features

        except Exception as e:
            logger.error(f"Error extrayendo features: {e}")
            return None

    @staticmethod
    def from_db_record(record) -> Optional[Tuple[np.ndarray, int]]:
        """
        Extrae features + etiqueta automática desde un MeasurementRecord.
        Retorna (features, label) o None si no es clasificable.
        
        El etiquetado se genera automáticamente usando reglas físicas
        basadas en el Índice de Claridad (Kt) y la Fracción Difusa (Kd).
        """
        try:
            spectrum_data = record.get_spectrum()
            if not spectrum_data:
                return None

            cross = spectrum_data.get("cross_metrics") or {}
            solar = spectrum_data.get("solar_geometry") or {}
            aod = spectrum_data.get("aod_bands") or {}

            ghi = record.total_irradiance or spectrum_data.get("total_irradiance")
            dni = cross.get("dni") or spectrum_data.get("dni")
            dhi = cross.get("dhi") or spectrum_data.get("dhi")
            kt = cross.get("clearness_index") or spectrum_data.get("clearness_index")
            kd = cross.get("diffuse_fraction") or spectrum_data.get("diffuse_fraction")
            aod_500 = aod.get(500, aod.get("500"))
            pwv = record.pwv_cm or spectrum_data.get("pwv_cm")
            sza = record.sza or solar.get("sza")
            par = record.par or spectrum_data.get("par")

            # Necesitamos al menos GHI, Kt y SZA para clasificar
            if ghi is None or kt is None or sza is None:
                return None
            
            # Filtrar mediciones nocturnas (SZA > 85°)
            if sza > 85.0:
                return None

            features = np.array([
                _safe_float(ghi, 0.0),
                _safe_float(dni, 0.0),
                _safe_float(dhi, 0.0),
                _safe_float(kt, 0.0),
                _safe_float(kd, 0.0),
                _safe_float(aod_500, 0.1),
                _safe_float(pwv, 1.0),
                _safe_float(sza, 45.0),
                _safe_float(par, 0.0),
            ], dtype=np.float64)

            # Etiquetado automático por reglas físicas
            label = FeatureExtractor.auto_label(kt, kd)

            return (features, label)

        except Exception as e:
            logger.error(f"Error extrayendo features de DB: {e}")
            return None

    @staticmethod
    def auto_label(kt: float, kd: Optional[float] = None) -> int:
        """
        Genera etiqueta de clase automáticamente usando reglas
        radiométricas establecidas en la literatura:
        
          - Kt >= 0.65 → Cielo Despejado (0)
          - 0.35 <= Kt < 0.65 → Nubosidad Parcial (1)
          - Kt < 0.35 → Cielo Nublado (2)
          
        Referencia: Long & Ackerman (2000), "Identification of clear 
        and cloudy periods from broadband radiometer data"
        """
        if kt is None:
            return 1  # Default: parcial
        
        kt = float(kt)
        if kt >= LABELING_RULES["clear"]["kt_min"]:
            return 0  # Despejado
        elif kt < LABELING_RULES["overcast"]["kt_max"]:
            return 2  # Nublado
        else:
            return 1  # Parcial

    @staticmethod
    def get_feature_names() -> List[str]:
        return FEATURE_NAMES.copy()

    @staticmethod
    def get_class_name(label: int) -> str:
        return SKY_CLASSES.get(label, "Desconocido")


def _safe_float(value, default: float = 0.0) -> float:
    """Convierte un valor a float de forma segura, reemplazando NaN/None."""
    if value is None:
        return default
    try:
        f = float(value)
        if np.isnan(f) or np.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default
