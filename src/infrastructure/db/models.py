# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from .database import Base
import json

class MeasurementRecord(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    sensor_target = Column(String, index=True)
    exposure_time_ms = Column(Integer)
    
    # Métricas físicas
    par = Column(Float)
    ppfd = Column(Float)
    illuminance = Column(Float)
    total_irradiance = Column(Float)
    
    # Espectro completo (Guardado como JSON string)
    spectrum_json = Column(Text)

    def set_spectrum(self, spectrum_data: dict):
        self.spectrum_json = json.dumps(spectrum_data)

    def get_spectrum(self) -> dict:
        if self.spectrum_json:
            return json.loads(self.spectrum_json)
        return {}
