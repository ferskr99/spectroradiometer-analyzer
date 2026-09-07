"""
reference_spectra.py

Tablas de referencia física para inversión atmosférica.
Contiene el Espectro Solar Extraterrestre I₀(λ) y coeficientes
para el cálculo de PWV y AOD.

Fuentes:
    - Espectro Extraterrestre: ASTM E490 / Kurucz (1994), valores representativos
      interpolados a 1nm en puntos clave para AOD.
    - Dispersión de Rayleigh: Bodhaine et al. (1999).
    - Coeficientes PWV: Ingold et al. (2000).
"""
import numpy as np

# ─────────────────────────────────────────────────────────────────────
# 1. ESPECTRO SOLAR EXTRATERRESTRE I₀(λ) [W/m²/µm]
#    Valores de referencia ASTM E490 para longitudes de onda clave
#    usadas en cálculos de AOD (bandas AERONET/CIMEL CE-318).
# ─────────────────────────────────────────────────────────────────────
# Formato: {wavelength_nm: I0 en W/m²/µm}
EXTRATERRESTRIAL_SPECTRUM = {
    340: 1122.0,
    380: 1143.0,
    440: 1891.0,
    500: 1953.0,
    675: 1517.0,
    870: 953.0,
    940: 887.0,
    1020: 711.0,
    1370: 294.0,
    1640: 172.0,
}

# ─────────────────────────────────────────────────────────────────────
# 2. COEFICIENTES DE ABSORCIÓN GASEOSA τ_gas(λ)
#    Correcciones menores por O₃, NO₂, etc. para bandas AOD.
#    Fuente: WMO/GAW recomendaciones, valores típicos tropicales.
# ─────────────────────────────────────────────────────────────────────
GAS_ABSORPTION_OD = {
    340: 0.0000,   # Sin absorción significativa
    380: 0.0030,   # Leve absorción por O₃ (Huggins)
    440: 0.0030,   # O₃ Chappuis (débil)
    500: 0.0120,   # O₃ Chappuis (pico)
    675: 0.0200,   # O₃ Chappuis (fuerte)
    870: 0.0000,   # Ventana atmosférica limpia
    1020: 0.0000,  # Ventana atmosférica limpia
    1640: 0.0000,  # Ventana atmosférica limpia
}


# ─────────────────────────────────────────────────────────────────────
# 3. DISPERSIÓN DE RAYLEIGH τ_r(λ, p)
#    Fórmula de Bodhaine et al. (1999):
#      τ_r(λ) = (p / p₀) × A × λ^(-B)
#    Donde A ≈ 0.00879, B ≈ 4.09 (ajuste empírico preciso)
#    y λ está en micrómetros.
# ─────────────────────────────────────────────────────────────────────
def rayleigh_optical_depth(wavelength_nm: float, pressure_hpa: float = 1013.25) -> float:
    """
    Calcula la profundidad óptica de Rayleigh para una longitud de onda dada.
    
    Args:
        wavelength_nm: Longitud de onda en nm.
        pressure_hpa: Presión atmosférica local en hPa.
        
    Returns:
        Profundidad óptica de Rayleigh (adimensional).
    """
    wl_um = wavelength_nm / 1000.0  # nm → µm
    p_ratio = pressure_hpa / 1013.25
    return p_ratio * 0.00879 * wl_um ** (-4.09)


# ─────────────────────────────────────────────────────────────────────
# 4. BANDAS DE ABSORCIÓN DE VAPOR DE AGUA (PWV)
#    Definición de las ventanas espectrales para la inversión del PWV.
#    
#    Banda ρ (940nm): Absorción fuerte por H₂O. Usada en atmósferas
#    húmedas (PWV > 0.5 cm). Cubierta por MS-711 (300-1100nm).
#    
#    Banda Φ (1370nm): Absorción muy fuerte por H₂O. Más sensible
#    para atmósferas secas (PWV < 0.5 cm). Cubierta por MS-713 (900-2500nm).
# ─────────────────────────────────────────────────────────────────────
PWV_BANDS = {
    '940nm': {
        'center': 940,          # nm
        'window_start': 880,    # nm — inicio de la línea base
        'window_end': 1000,     # nm — fin de la línea base
        'baseline_left': 880,   # nm — punto de anclaje izquierdo (fuera de absorción)
        'baseline_right': 1000, # nm — punto de anclaje derecho (fuera de absorción)
        # Coeficientes empíricos (Ingold et al., 2000) para T_w → PWV:
        #   ln(T_w) = -a × (m × PWV)^b
        #   PWV = ( -ln(T_w) / a )^(1/b) / m
        'a': 0.6733,
        'b': 0.5765,
    },
    '1370nm': {
        'center': 1370,
        'window_start': 1300,
        'window_end': 1450,
        'baseline_left': 1300,
        'baseline_right': 1450,
        'a': 1.0680,
        'b': 0.5920,
    },
}


# ─────────────────────────────────────────────────────────────────────
# 5. LONGITUDES DE ONDA ESTÁNDAR PARA AOD (AERONET/CIMEL CE-318)
# ─────────────────────────────────────────────────────────────────────
AOD_WAVELENGTHS = [340, 380, 440, 500, 675, 870, 1020, 1640]
