"""
sky_classifier.py

Clasificador inteligente de condiciones atmosféricas basado en
Random Forest (scikit-learn).

Ciclo de vida del modelo:
    1. REGLAS FÍSICAS (bootstrap): Cuando hay < 50 mediciones, el sistema
       clasifica usando umbrales determinísticos de Kt y Kd.
    2. ENTRENAMIENTO AUTOMÁTICO: Cuando se acumulan >= 50 mediciones en la
       base de datos, el sistema entrena automáticamente un Random Forest
       usando las features extraídas y las etiquetas generadas por reglas.
    3. PREDICCIÓN ML: Una vez entrenado, el modelo reemplaza las reglas
       con predicciones probabilísticas más precisas.

Persistencia:
    El modelo entrenado se serializa a disco con joblib para sobrevivir
    reinicios del servidor. Se guarda en 'ml_models/sky_classifier.joblib'.

Referencia científica:
    - Long & Ackerman (2000): Umbrales de Kt para clasificación de cielo.
    - Duchon & O'Malley (1999): Fracción difusa como discriminante.
"""

import os
import json
import logging
import numpy as np
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple, List

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from .feature_extractor import FeatureExtractor, SKY_CLASSES, FEATURE_NAMES

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# Configuración del modelo
# ─────────────────────────────────────────────────────────────────────

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "ml_models")
MODEL_PATH = os.path.join(MODEL_DIR, "sky_classifier.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "sky_classifier_meta.json")
MIN_SAMPLES_TO_TRAIN = 15  # Mínimo de muestras para entrenar el modelo ML


class SkyClassifier:
    """
    Clasificador híbrido de condiciones atmosféricas.
    
    Combina reglas físicas determinísticas con un modelo de
    Random Forest que se entrena automáticamente conforme
    se acumulan mediciones.
    
    Atributos:
        pipeline: Pipeline de scikit-learn (Scaler + RandomForest)
        is_trained: True si el modelo ML está entrenado y listo
        metadata: Métricas del último entrenamiento
    """

    def __init__(self):
        self.pipeline: Optional[Pipeline] = None
        self.is_trained: bool = False
        self.metadata: Dict = {}
        self._load_model()

    # ─── PREDICCIÓN ────────────────────────────────────────────────

    def predict(self, analysis_result: dict) -> Optional[Dict]:
        """
        Clasifica las condiciones atmosféricas de una medición.
        
        Retorna un diccionario con:
            - class_id: 0, 1 o 2
            - class_name: "Cielo Despejado", "Nubosidad Parcial", "Cielo Nublado"
            - confidence: Probabilidad de la clase predicha (0-1)
            - method: "ml" o "rules" (indica si usó el modelo o reglas físicas)
            - probabilities: Dict con probabilidad de cada clase
        """
        features = FeatureExtractor.from_analysis_result(analysis_result)
        if features is None:
            return None

        if self.is_trained and self.pipeline is not None:
            return self._predict_ml(features)
        else:
            return self._predict_rules(features)

    def _predict_ml(self, features: np.ndarray) -> Dict:
        """Predicción usando el modelo Random Forest entrenado."""
        try:
            X = features.reshape(1, -1)
            class_id = int(self.pipeline.predict(X)[0])
            probabilities = self.pipeline.predict_proba(X)[0]

            prob_dict = {}
            for i, prob in enumerate(probabilities):
                prob_dict[SKY_CLASSES.get(i, f"Clase {i}")] = round(float(prob), 4)

            return {
                "class_id": class_id,
                "class_name": FeatureExtractor.get_class_name(class_id),
                "confidence": round(float(max(probabilities)), 4),
                "method": "ml",
                "model_accuracy": self.metadata.get("accuracy"),
                "probabilities": prob_dict,
            }
        except Exception as e:
            logger.error(f"Error en predicción ML, cayendo a reglas: {e}")
            return self._predict_rules(features)

    def _predict_rules(self, features: np.ndarray) -> Dict:
        """Predicción usando reglas físicas determinísticas (fallback)."""
        kt = features[3]  # clearness_index
        kd = features[4]  # diffuse_fraction

        class_id = FeatureExtractor.auto_label(kt, kd)
        
        # Calcular pseudo-confianza basada en distancia al umbral
        if class_id == 0:  # Despejado
            confidence = min(1.0, 0.7 + (kt - 0.65) * 2.0)
        elif class_id == 2:  # Nublado
            confidence = min(1.0, 0.7 + (0.35 - kt) * 2.0)
        else:  # Parcial
            distance_to_center = abs(kt - 0.50) / 0.15
            confidence = max(0.5, 0.8 - distance_to_center * 0.3)

        return {
            "class_id": class_id,
            "class_name": FeatureExtractor.get_class_name(class_id),
            "confidence": round(float(confidence), 4),
            "method": "rules",
            "model_accuracy": None,
            "probabilities": {
                SKY_CLASSES[0]: round(1.0 if class_id == 0 else 0.0, 4),
                SKY_CLASSES[1]: round(1.0 if class_id == 1 else 0.0, 4),
                SKY_CLASSES[2]: round(1.0 if class_id == 2 else 0.0, 4),
            },
        }

    # ─── ENTRENAMIENTO ─────────────────────────────────────────────

    def train(self, db_session) -> Dict:
        """
        Entrena el modelo Random Forest con todas las mediciones
        disponibles en la base de datos.
        
        Pipeline de entrenamiento:
            1. Extrae features + etiquetas de todos los registros
            2. Filtra mediciones nocturnas (SZA > 85°)
            3. Normaliza features con StandardScaler
            4. Entrena RandomForest con validación cruzada (5-fold)
            5. Serializa el modelo a disco
            
        Returns:
            Dict con métricas del entrenamiento
        """
        from src.infrastructure.db.models import MeasurementRecord

        # 1. Obtener todos los registros
        records = db_session.query(MeasurementRecord).all()
        logger.info(f"ML: Iniciando entrenamiento con {len(records)} registros totales")

        # 2. Extraer features y etiquetas
        X_list = []
        y_list = []
        skipped = 0

        for record in records:
            result = FeatureExtractor.from_db_record(record)
            if result is not None:
                features, label = result
                X_list.append(features)
                y_list.append(label)
            else:
                skipped += 1

        n_samples = len(X_list)
        logger.info(f"ML: {n_samples} muestras válidas extraídas ({skipped} descartadas)")

        if n_samples < MIN_SAMPLES_TO_TRAIN:
            return {
                "status": "insufficient_data",
                "message": f"Se necesitan al menos {MIN_SAMPLES_TO_TRAIN} mediciones. "
                           f"Actualmente hay {n_samples} válidas.",
                "samples_available": n_samples,
                "samples_required": MIN_SAMPLES_TO_TRAIN,
            }

        X = np.array(X_list)
        y = np.array(y_list)

        # 3. Verificar distribución de clases
        unique, counts = np.unique(y, return_counts=True)
        class_distribution = {
            FeatureExtractor.get_class_name(int(c)): int(n) 
            for c, n in zip(unique, counts)
        }
        logger.info(f"ML: Distribución de clases: {class_distribution}")

        # Necesitamos al menos 2 clases para entrenar
        if len(unique) < 2:
            return {
                "status": "insufficient_classes",
                "message": "Se necesitan al menos 2 clases diferentes para entrenar. "
                           "Recolecte datos bajo diferentes condiciones atmosféricas.",
                "class_distribution": class_distribution,
            }

        # 4. Construir y entrenar el pipeline
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", RandomForestClassifier(
                n_estimators=100,
                max_depth=8,
                min_samples_split=5,
                min_samples_leaf=2,
                class_weight="balanced",  # Maneja clases desbalanceadas
                random_state=42,
                n_jobs=-1,
            ))
        ])

        # 5. Validación cruzada (5-fold)
        n_splits = min(5, min(counts))  # No más folds que la clase más pequeña
        if n_splits >= 2:
            cv_scores = cross_val_score(self.pipeline, X, y, cv=n_splits, scoring="accuracy")
            accuracy = float(cv_scores.mean())
            accuracy_std = float(cv_scores.std())
            logger.info(f"ML: Accuracy CV({n_splits}-fold): {accuracy:.4f} ± {accuracy_std:.4f}")
        else:
            accuracy = None
            accuracy_std = None

        # 6. Entrenar con todos los datos
        self.pipeline.fit(X, y)
        self.is_trained = True

        # 7. Importancia de features
        rf = self.pipeline.named_steps["classifier"]
        importances = rf.feature_importances_
        feature_importance = {
            name: round(float(imp), 4) 
            for name, imp in sorted(
                zip(FEATURE_NAMES, importances), 
                key=lambda x: x[1], 
                reverse=True
            )
        }

        # 8. Persistir modelo y metadatos
        self.metadata = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_samples": n_samples,
            "n_features": len(FEATURE_NAMES),
            "accuracy": accuracy,
            "accuracy_std": accuracy_std,
            "cv_folds": n_splits if n_splits >= 2 else None,
            "class_distribution": class_distribution,
            "feature_importance": feature_importance,
            "model_type": "RandomForestClassifier",
            "n_estimators": 100,
        }
        self._save_model()

        return {
            "status": "trained",
            "message": f"Modelo entrenado exitosamente con {n_samples} muestras.",
            **self.metadata,
        }

    # ─── PERSISTENCIA ──────────────────────────────────────────────

    def _save_model(self):
        """Serializa el modelo y metadatos a disco."""
        try:
            os.makedirs(MODEL_DIR, exist_ok=True)
            joblib.dump(self.pipeline, MODEL_PATH)
            with open(METADATA_PATH, "w") as f:
                json.dump(self.metadata, f, indent=2, default=str)
            logger.info(f"ML: Modelo guardado en {MODEL_PATH}")
        except Exception as e:
            logger.error(f"ML: Error guardando modelo: {e}")

    def _load_model(self):
        """Carga el modelo desde disco si existe."""
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(METADATA_PATH):
                self.pipeline = joblib.load(MODEL_PATH)
                with open(METADATA_PATH, "r") as f:
                    self.metadata = json.load(f)
                self.is_trained = True
                logger.info(
                    f"ML: Modelo cargado desde disco. "
                    f"Accuracy: {self.metadata.get('accuracy', 'N/A')}. "
                    f"Entrenado con {self.metadata.get('n_samples', '?')} muestras."
                )
            else:
                logger.info("ML: No se encontró modelo previo. Usando reglas físicas.")
        except Exception as e:
            logger.warning(f"ML: Error cargando modelo, usando reglas: {e}")
            self.is_trained = False

    # ─── INFO ──────────────────────────────────────────────────────

    def get_status(self) -> Dict:
        """Retorna el estado actual del clasificador."""
        return {
            "is_trained": self.is_trained,
            "method": "ml" if self.is_trained else "rules",
            "model_type": self.metadata.get("model_type", "N/A"),
            "accuracy": self.metadata.get("accuracy"),
            "n_samples": self.metadata.get("n_samples", 0),
            "trained_at": self.metadata.get("trained_at"),
            "feature_importance": self.metadata.get("feature_importance"),
            "class_distribution": self.metadata.get("class_distribution"),
            "min_samples_required": MIN_SAMPLES_TO_TRAIN,
        }


# ─── Instancia global (Singleton) ─────────────────────────────────
sky_classifier = SkyClassifier()
