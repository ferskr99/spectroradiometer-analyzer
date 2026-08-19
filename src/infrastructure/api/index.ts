/**
 * Barrel export para la capa de infraestructura API.
 * 
 * Uso desde otras capas del frontend:
 * ```ts
 * import { apiClient, type SpectralData, type AnalysisResult } from "../../infrastructure/api";
 * ```
 */

// Tipos del dominio y cliente
export type {
  SensorId,
  SpectralData,
  AnalysisRequest,
  AnalysisResult,
  HTTPValidationError,
} from "./api_client";

export type { components } from "./api-types";

// Cliente HTTP y tipos de configuración/error
export {
  SpectroradiometerApiClient,
  ApiError,
  apiClient,
} from "./api_client";

export type { ApiClientOptions } from "./api_client";
