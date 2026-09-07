"""
solar_geometry.py

Módulo de Geometría Solar para cálculos astronómicos de alta precisión.
Calcula el Ángulo Cenital Solar (SZA), la Masa de Aire Óptica Relativa (AM)
y otros parámetros necesarios para la inversión atmosférica (PWV, AOD).

Utiliza la librería pvlib para posiciones solares astronómicas.
"""
import numpy as np
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

try:
    from pvlib.solarposition import get_solarposition
    from pvlib.atmosphere import get_relative_airmass, get_absolute_airmass
    _HAS_PVLIB = True
except ImportError:
    _HAS_PVLIB = False
    logger.warning("pvlib no instalado. Los cálculos de geometría solar usarán aproximaciones.")


# ─────────────────────────────────────────────────────────────────────
# Configuración de la estación (valores por defecto: Lima, Perú - UNMSM)
# ─────────────────────────────────────────────────────────────────────
DEFAULT_LATITUDE  = -12.0553   # Grados decimales (negativo = Sur)
DEFAULT_LONGITUDE = -77.0842   # Grados decimales (negativo = Oeste)
DEFAULT_ALTITUDE  = 150.0      # Metros sobre el nivel del mar
DEFAULT_PRESSURE  = 1013.25    # Presión atmosférica estándar en hPa (mbar)


class SolarGeometry:
    """
    Calcula parámetros de geometría solar para una ubicación geográfica fija.
    """

    def __init__(
        self,
        latitude: float = DEFAULT_LATITUDE,
        longitude: float = DEFAULT_LONGITUDE,
        altitude: float = DEFAULT_ALTITUDE,
        pressure_hpa: float = DEFAULT_PRESSURE,
    ):
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.pressure_hpa = pressure_hpa

    def get_solar_position(self, timestamp: datetime = None) -> dict:
        """
        Calcula la posición solar exacta para un instante dado.

        Args:
            timestamp: Momento de la medición (UTC recomendado). 
                       Si es None, usa la hora actual.

        Returns:
            dict con claves:
                - sza: Ángulo Cenital Solar (grados)
                - elevation: Elevación solar (grados)
                - azimuth: Azimut solar (grados)
                - air_mass: Masa de Aire Óptica Relativa (adimensional)
                - air_mass_absolute: Masa de Aire Absoluta corregida por presión
        """
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        if _HAS_PVLIB:
            return self._pvlib_position(timestamp)
        else:
            return self._fallback_position(timestamp)

    def _pvlib_position(self, timestamp: datetime) -> dict:
        """Cálculo preciso usando pvlib (algoritmo NREL SPA)."""
        import pandas as pd
        times = pd.DatetimeIndex([timestamp])

        sol = get_solarposition(
            times,
            self.latitude,
            self.longitude,
            altitude=self.altitude,
            pressure=self.pressure_hpa * 100,  # pvlib espera Pascales
        )

        elevation = float(sol['apparent_elevation'].iloc[0])
        sza = float(sol['apparent_zenith'].iloc[0])
        azimuth = float(sol['azimuth'].iloc[0])

        # Masa de aire relativa (Kasten & Young, 1989)
        am_relative = get_relative_airmass(sza, model='kastenyoung1989')

        # Masa de aire absoluta (corregida por presión local)
        am_absolute = get_absolute_airmass(am_relative, self.pressure_hpa)

        return {
            'sza': round(sza, 4),
            'elevation': round(elevation, 4),
            'azimuth': round(azimuth, 4),
            'air_mass': round(float(am_relative), 6) if am_relative is not None else None,
            'air_mass_absolute': round(float(am_absolute), 6) if am_absolute is not None else None,
        }

    def _fallback_position(self, timestamp: datetime) -> dict:
        """
        Aproximación simplificada cuando pvlib no está disponible.
        Usa la ecuación de declinación solar de Cooper (1969).
        """
        doy = timestamp.timetuple().tm_yday

        # Declinación solar (Cooper, 1969)
        declination = 23.45 * np.sin(np.radians(360 / 365 * (284 + doy)))
        dec_rad = np.radians(declination)

        hour = timestamp.hour + timestamp.minute / 60.0
        hour_angle = (hour - 12.0) * 15.0
        ha_rad = np.radians(hour_angle)
        lat_rad = np.radians(self.latitude)

        sin_elev = (np.sin(lat_rad) * np.sin(dec_rad) +
                    np.cos(lat_rad) * np.cos(dec_rad) * np.cos(ha_rad))
        elevation = np.degrees(np.arcsin(np.clip(sin_elev, -1, 1)))
        sza = 90.0 - elevation

        if elevation > 0:
            am = 1.0 / (np.sin(np.radians(elevation)) +
                        0.50572 * (6.07995 + elevation) ** (-1.6364))
        else:
            am = None

        am_abs = am * (self.pressure_hpa / 1013.25) if am else None

        return {
            'sza': round(sza, 4),
            'elevation': round(elevation, 4),
            'azimuth': 0.0,
            'air_mass': round(am, 6) if am else None,
            'air_mass_absolute': round(am_abs, 6) if am_abs else None,
        }
