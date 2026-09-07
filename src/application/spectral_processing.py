"""
Caso de uso: Procesamiento espectral científico.

Implementa la fusión de datos MS-711 (300-1100nm) y MS-713 (900-2500nm),
el cálculo de PPFD (400-700nm) y la iluminancia fotópica (380-780nm).

Referencias físicas:
- PPFD: McCree (1972), rango PAR 400-700nm.
- Iluminancia: CIE 1931, curva de eficiencia luminosa fotópica V(λ).
- Constantes: h = 6.626e-34 J·s, c = 2.998e8 m/s, Km = 683 lm/W.
"""

import numpy as np
from scipy.interpolate import interp1d
from scipy.integrate import trapezoid

from src.domain.models import SpectralData


# ─────────────────────────────────────────────────────────────────────
# Constantes físicas
# ─────────────────────────────────────────────────────────────────────
_PLANCK_H = 6.62607015e-34   # Constante de Planck (J·s)
_SPEED_C  = 2.99792458e8     # Velocidad de la luz (m/s)
_AVOGADRO = 6.02214076e23    # Número de Avogadro (mol⁻¹)
_KM       = 683.0            # Eficacia luminosa máxima fotópica (lm/W)


# ─────────────────────────────────────────────────────────────────────
# Curva V(λ) — CIE 1931 Photopic Luminosity Function
# Tabulada cada 10nm de 380 a 780nm (valores estándar CIE).
# ─────────────────────────────────────────────────────────────────────
_V_LAMBDA_WL = np.arange(380, 790, 10, dtype=np.float64)  # 380, 390, ..., 780
_V_LAMBDA_VALUES = np.array([
    0.0000, 0.0001, 0.0004, 0.0012, 0.0040,   # 380-420
    0.0116, 0.0230, 0.0380, 0.0600, 0.0910,   # 430-470
    0.1390, 0.2080, 0.3230, 0.5030, 0.7100,   # 480-520
    0.8620, 0.9540, 0.9950, 0.9950, 0.9520,   # 530-570
    0.8700, 0.7570, 0.6310, 0.5030, 0.3810,   # 580-620
    0.2650, 0.1750, 0.1070, 0.0610, 0.0320,   # 630-670
    0.0170, 0.0082, 0.0041, 0.0021, 0.0010,   # 680-720
    0.0005, 0.0003, 0.0001, 0.0001, 0.0000,   # 730-770
    0.0000,                                     # 780
], dtype=np.float64)

# Interpolar V(λ) a 1nm de resolución para uso interno
_v_lambda_interp = interp1d(
    _V_LAMBDA_WL, _V_LAMBDA_VALUES,
    kind='linear', bounds_error=False, fill_value=0.0
)


class SpectralProcessorUseCase:
    """
    Caso de uso estático para el procesamiento de datos espectrales.
    No mantiene estado; cada método opera sobre los datos de entrada.
    """

    @staticmethod
    def merge_and_interpolate(
        ms711_data: SpectralData,
        ms713_data: SpectralData,
    ) -> SpectralData:
        """
        Fusiona los espectros del MS-711 (300-1100nm) y MS-713 (900-2500nm),
        eliminando la zona de superposición (900-1100nm) mediante promediado
        ponderado, e interpola el resultado a intervalos de exactamente 1nm.

        Estrategia para la zona de superposición:
        - Se interpolan ambos espectros a 1nm en la zona común.
        - Se promedian las irradiancias de ambos sensores en la superposición.
        - Fuera de la superposición, cada sensor aporta sus datos directamente.

        Args:
            ms711_data: Espectro del MS-711 (UV-VIS-NIR corto).
            ms713_data: Espectro del MS-713 (NIR largo).

        Returns:
            SpectralData con el espectro fusionado a resolución de 1nm.
        """
        wl_711 = np.array(ms711_data.wavelengths)
        ir_711 = np.array(ms711_data.irradiance)
        wl_712 = np.array(ms713_data.wavelengths)
        ir_712 = np.array(ms713_data.irradiance)

        # Rango global: desde el mínimo del MS-711 hasta el máximo del MS-713
        wl_start = int(np.ceil(wl_711.min()))
        wl_end   = int(np.floor(wl_712.max()))
        merged_wl = np.arange(wl_start, wl_end + 1, 1.0)

        # Interpoladores individuales
        interp_711 = interp1d(wl_711, ir_711, kind='linear',
                              bounds_error=False, fill_value=0.0)
        interp_712 = interp1d(wl_712, ir_712, kind='linear',
                              bounds_error=False, fill_value=0.0)

        # Zona de superposición: donde ambos sensores tienen datos
        overlap_min = max(wl_711.min(), wl_712.min())
        overlap_max = min(wl_711.max(), wl_712.max())

        merged_ir = np.empty_like(merged_wl)

        for i, wl in enumerate(merged_wl):
            if overlap_min <= wl <= overlap_max:
                # Promedio ponderado en la zona de superposición
                merged_ir[i] = 0.5 * (interp_711(wl) + interp_712(wl))
            elif wl < overlap_min:
                # Solo MS-711 tiene datos en esta zona
                merged_ir[i] = interp_711(wl)
            else:
                # Solo MS-713 tiene datos en esta zona
                merged_ir[i] = interp_712(wl)

        return SpectralData(
            wavelengths=merged_wl.tolist(),
            irradiance=merged_ir.tolist(),
        )

    @staticmethod
    def calculate_ppfd(spectrum: SpectralData) -> float:
        """
        Calcula la Densidad de Flujo de Fotones Fotosintéticos (PPFD).

        Rango PAR: 400nm a 700nm (McCree, 1972).

        Fórmula:
            PPFD = ∫[400,700] E(λ) · λ / (h·c·Nₐ) dλ

        Donde E(λ) está en W/m²/µm y λ en nm. Se convierte a µmol/m²/s.

        Args:
            spectrum: Datos espectrales (puede ser fusionado o de un solo sensor).

        Returns:
            PPFD en µmol/m²/s (micromoles de fotones por metro cuadrado por segundo).
        """
        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        # Filtrar al rango PAR: 400-700nm
        mask = (wl >= 400.0) & (wl <= 700.0)
        wl_par = wl[mask]
        ir_par = ir[mask]

        if len(wl_par) < 2:
            return 0.0

        # Conversión de unidades:
        # λ (nm → m): ×1e-9
        # E(λ) (W/m²/µm → W/m²/nm): ×1e-3  (1 µm = 1000 nm)
        # Factor de conversión de fotones a µmol: ÷ Nₐ × 1e6
        #
        # PPFD = ∫ E(λ)·λ·1e-9·1e-3 / (h·c) dλ  × (1e6 / Nₐ)
        #      = ∫ E(λ)·λ / (h·c) dλ  × 1e-12 × 1e6 / Nₐ
        #      = ∫ E(λ)·λ / (h·c) dλ  × 1e-6 / Nₐ

        # Integrando: E(λ) × λ(nm)
        integrand = ir_par * wl_par

        # Integral numérica (trapezoidal) sobre λ en nm
        integral = trapezoid(integrand, wl_par)

        # Aplicar constantes: convertir a µmol/m²/s
        ppfd = integral * 1e-6 / (_PLANCK_H * _SPEED_C * _AVOGADRO)

        return round(float(ppfd), 4)

    @staticmethod
    def calculate_illuminance(spectrum: SpectralData) -> float:
        """
        Calcula la iluminancia fotópica integrando la irradiancia espectral
        ponderada por la curva de eficiencia luminosa fotópica V(λ) de la CIE 1931.

        Rango: 380nm a 780nm.

        Fórmula:
            Ev = Km · ∫[380,780] E(λ) · V(λ) dλ

        Donde Km = 683 lm/W (eficacia luminosa máxima).

        Args:
            spectrum: Datos espectrales.

        Returns:
            Iluminancia en lux (lm/m²).
        """
        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        # Filtrar al rango fotópico: 380-780nm
        mask = (wl >= 380.0) & (wl <= 780.0)
        wl_vis = wl[mask]
        ir_vis = ir[mask]

        if len(wl_vis) < 2:
            return 0.0

        # Evaluar V(λ) en las longitudes de onda del espectro
        v_lambda = _v_lambda_interp(wl_vis)

        # Integrando: E(λ) × V(λ)
        # E(λ) en W/m²/µm, integración sobre nm → factor ×1e-3
        integrand = ir_vis * v_lambda

        # Integral numérica
        integral = trapezoid(integrand, wl_vis)

        # Iluminancia: Km × integral × 1e-3 (conversión µm → nm)
        illuminance = _KM * integral * 1e-3

        return round(float(illuminance), 2)

    @staticmethod
    def calculate_par(spectrum: SpectralData) -> float:
        """
        Calcula la Radiación Fotosintéticamente Activa (PAR).

        Integra numéricamente la irradiancia espectral entre 400nm y 700nm
        para obtener la potencia radiante en el rango PAR.

        Fórmula:
            PAR = ∫[400,700] E(λ) dλ

        Donde E(λ) está en W/m²/µm y la integración es sobre nm.

        Args:
            spectrum: Datos espectrales.

        Returns:
            PAR en W/m².
        """
        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        mask = (wl >= 400.0) & (wl <= 700.0)
        wl_par = wl[mask]
        ir_par = ir[mask]

        if len(wl_par) < 2:
            return 0.0

        # Integral numérica: E(λ) en W/m²/µm, integrado sobre nm
        # Factor ×1e-3 convierte nm → µm para obtener W/m²
        integral = trapezoid(ir_par, wl_par)

        return round(float(integral * 1e-3), 4)

    @staticmethod
    def calculate_total_irradiance(spectrum: SpectralData) -> float:
        """
        Calcula la irradiancia total integrada sobre todo el rango espectral.

        Fórmula:
            E_total = ∫[λ_min, λ_max] E(λ) dλ

        Args:
            spectrum: Datos espectrales (fusionados o individuales).

        Returns:
            Irradiancia total en W/m².
        """
        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        if len(wl) < 2:
            return 0.0

        # Integral sobre todo el rango, con conversión nm → µm
        integral = trapezoid(ir, wl)

        return round(float(integral * 1e-3), 4)

    # ─────────────────────────────────────────────────────────────────
    # CÁLCULOS ATMOSFÉRICOS AVANZADOS (PWV y AOD)
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def calculate_pwv(
        spectrum: SpectralData,
        air_mass: float,
        band: str = '940nm',
    ) -> float:
        """
        Calcula el Vapor de Agua Precipitable (PWV) a partir de la
        transmitancia en la banda de absorción de H₂O.

        Método: Inversión empírica de Ingold et al. (2000).
        Se construye una línea base (baseline) interpolando linealmente
        entre los extremos de la banda de absorción. La transmitancia
        del vapor de agua T_w se obtiene como:

            T_w = I_measured(λ_center) / I_baseline(λ_center)

        Luego se invierte la relación empírica:

            ln(T_w) = -a × (m × PWV)^b

        Para obtener:

            PWV = ( -ln(T_w) / a )^(1/b) / m

        Args:
            spectrum: Espectro fusionado (debe cubrir la banda elegida).
            air_mass: Masa de aire óptica relativa en el momento de la medición.
            band: Banda de absorción a usar ('940nm' o '1370nm').

        Returns:
            PWV en centímetros de agua precipitable.
        """
        from src.domain.reference_spectra import PWV_BANDS

        if band not in PWV_BANDS:
            return -1.0

        params = PWV_BANDS[band]
        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        # Extraer irradiancia en los puntos de anclaje de la línea base
        left_wl = params['baseline_left']
        right_wl = params['baseline_right']
        center_wl = params['center']

        # Interpolador del espectro medido
        interp_fn = interp1d(wl, ir, kind='linear', bounds_error=False, fill_value=0.0)

        I_left = float(interp_fn(left_wl))
        I_right = float(interp_fn(right_wl))
        I_center = float(interp_fn(center_wl))

        # Línea base: interpolación lineal entre los extremos
        if right_wl == left_wl:
            return -1.0
        I_baseline_center = I_left + (I_right - I_left) * (center_wl - left_wl) / (right_wl - left_wl)

        # Transmitancia del vapor de agua
        if I_baseline_center <= 0 or I_center <= 0:
            return -1.0
        T_w = I_center / I_baseline_center

        if T_w >= 1.0:
            return 0.0  # Sin absorción detectable

        # Inversión empírica: PWV = ( -ln(T_w) / a )^(1/b) / m
        a = params['a']
        b = params['b']

        if air_mass is None or air_mass <= 0:
            return -1.0

        try:
            ln_Tw = np.log(T_w)
            pwv = ((-ln_Tw) / a) ** (1.0 / b) / air_mass
            return round(float(pwv), 4)
        except (ValueError, ZeroDivisionError):
            return -1.0

    @staticmethod
    def calculate_aod(
        spectrum: SpectralData,
        air_mass: float,
        pressure_hpa: float = 1013.25,
        wavelengths: list = None,
    ) -> dict:
        """
        Calcula el Espesor Óptico de Aerosoles (AOD) mediante la
        Ley de Bouguer-Lambert-Beer.

        Para cada longitud de onda λ:

            I(λ) = I₀(λ) × exp( -m × [τ_a(λ) + τ_r(λ) + τ_gas(λ)] )

        Despejando el AOD:

            τ_a(λ) = [ ln(I₀(λ)) - ln(I(λ)) ] / m  -  τ_r(λ)  -  τ_gas(λ)

        Args:
            spectrum: Espectro fusionado a 1nm de resolución.
            air_mass: Masa de aire óptica relativa.
            pressure_hpa: Presión atmosférica local en hPa.
            wavelengths: Lista de longitudes de onda para calcular AOD.
                         Si es None, usa las bandas AERONET estándar.

        Returns:
            dict con formato {wavelength_nm: aod_value}.
            Valores negativos indican error o saturación.
        """
        from src.domain.reference_spectra import (
            EXTRATERRESTRIAL_SPECTRUM,
            GAS_ABSORPTION_OD,
            AOD_WAVELENGTHS,
            rayleigh_optical_depth,
        )

        if wavelengths is None:
            wavelengths = AOD_WAVELENGTHS

        if air_mass is None or air_mass <= 0:
            return {wl: -1.0 for wl in wavelengths}

        wl = np.array(spectrum.wavelengths)
        ir = np.array(spectrum.irradiance)

        # Interpolador del espectro medido
        interp_fn = interp1d(wl, ir, kind='linear', bounds_error=False, fill_value=0.0)

        aod_results = {}

        for target_wl in wavelengths:
            # Irradiancia medida a nivel del suelo
            I_measured = float(interp_fn(target_wl))

            # Irradiancia extraterrestre I₀
            I0 = EXTRATERRESTRIAL_SPECTRUM.get(target_wl)
            if I0 is None or I0 <= 0 or I_measured <= 0:
                aod_results[target_wl] = -1.0
                continue

            # Profundidad óptica de Rayleigh
            tau_r = rayleigh_optical_depth(target_wl, pressure_hpa)

            # Absorción gaseosa (O₃, NO₂, etc.)
            tau_gas = GAS_ABSORPTION_OD.get(target_wl, 0.0)

            # Ley de Bouguer-Lambert-Beer invertida
            try:
                tau_total = (np.log(I0) - np.log(I_measured)) / air_mass
                tau_a = tau_total - tau_r - tau_gas

                # Clamp: AOD no debería ser negativo en condiciones normales
                aod_results[target_wl] = round(max(float(tau_a), 0.0), 6)
            except (ValueError, ZeroDivisionError):
                aod_results[target_wl] = -1.0

        return aod_results
