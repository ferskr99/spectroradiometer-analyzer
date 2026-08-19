/**
 * api_client.ts
 *
 * Cliente HTTP tipado para la API del Spectroradiometer Analyzer.
 * Adaptador de salida (Outbound) en la Arquitectura Hexagonal del frontend:
 * esta capa es la ÚNICA que interactúa con la red.
 *
 * Usa `fetch` nativo con tipado estricto derivado de api-types.ts.
 * No expone detalles de transporte al resto de la aplicación.
 */

import type { components } from "./api-types";

export type SensorId = "MS-711" | "MS-712";
export type SpectralData = components["schemas"]["SpectralData"];
export type SpectrometerConfig = components["schemas"]["SpectrometerConfig"];
export type AnalysisResult = components["schemas"]["AnalysisResult"];
export type HTTPValidationError = components["schemas"]["HTTPValidationError"];

// ─────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "http://localhost:8000";

/** Opciones de inicialización del cliente. */
export interface ApiClientOptions {
  /** URL base del servidor FastAPI (sin trailing slash). */
  baseUrl?: string;
  /** Headers adicionales para cada petición (e.g. Authorization). */
  defaultHeaders?: Record<string, string>;
  /** Timeout en milisegundos (por defecto 30000). */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Errores tipados
// ─────────────────────────────────────────────────────────────────────

/**
 * Error específico de la API que preserva el status HTTP
 * y el cuerpo de validación de FastAPI.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly validationErrors?: HTTPValidationError,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Cliente
// ─────────────────────────────────────────────────────────────────────

/**
 * Cliente HTTP type-safe para el backend del espectrorradiómetro.
 *
 * Ejemplo de uso:
 * ```ts
 * const client = new SpectroradiometerApiClient({ baseUrl: "http://localhost:8000" });
 *
 * // Configurar sensor — solo acepta "MS-711" | "MS-712" en compile-time
 * await client.configureSensor({ sensor_id: "MS-711", exposure_time_ms: 100 });
 *
 * // Obtener espectro
 * const spectrum = await client.getSpectrum("MS-712");
 *
 * // Análisis completo (fusión + PPFD + iluminancia)
 * const result = await client.analyzeSpectra();
 * console.log(result.ppfd, result.illuminance);
 * ```
 */
export class SpectroradiometerApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.defaultHeaders,
    };
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  // ─── Métodos privados ────────────────────────────────────────────

  /**
   * Wrapper central de `fetch` con timeout, headers por defecto y
   * parseo de errores de validación de FastAPI.
   */
  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...this.defaultHeaders,
          ...(init.headers as Record<string, string> | undefined),
        },
      });

      if (!response.ok) {
        let validationErrors: HTTPValidationError | undefined;

        if (response.status === 422) {
          try {
            validationErrors = (await response.json()) as HTTPValidationError;
          } catch {
            // El cuerpo no es JSON parseable, ignorar
          }
        }

        throw new ApiError(
          `API error ${response.status}: ${response.statusText}`,
          response.status,
          validationErrors,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(
          `Request timeout after ${this.timeoutMs}ms: ${path}`,
          408,
        );
      }

      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Endpoints públicos (type-safe) ──────────────────────────────

  /**
   * POST /api/v1/sensors/config
   *
   * Configura un espectrorradiómetro. El payload es estrictamente tipado:
   * - `sensor_id` solo acepta `"MS-711"` o `"MS-712"` (compile-time).
   * - `exposure_time_ms` debe estar en [10, 5000] (runtime vía backend).
   *
   * @param config — Configuración del sensor.
   * @returns `true` si el equipo aceptó la configuración.
   * @throws {ApiError} si el backend rechaza la configuración (422).
   */
  async configureSensor(config: SpectrometerConfig): Promise<boolean> {
    return this.request<boolean>("/api/v1/sensors/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  /**
   * GET /api/v1/sensors/{sensor_id}/spectrum
   *
   * Adquiere el espectro crudo de un sensor específico.
   * El parámetro `sensorId` está restringido a `"MS-711" | "MS-712"`
   * en compile-time gracias al tipo `SensorId`.
   *
   * @param sensorId — Identificador del sensor.
   * @returns Datos espectrales (wavelengths + irradiance).
   * @throws {ApiError} si el sensor_id no es válido (422).
   */
  async getSpectrum(sensorId: SensorId): Promise<SpectralData> {
    return this.request<SpectralData>(
      `/api/v1/sensors/${encodeURIComponent(sensorId)}/spectrum`,
      { method: "GET" },
    );
  }

  /**
   * POST /api/v1/sensors/analyze
   *
   * Ejecuta el pipeline completo de análisis:
   * 1. Adquiere espectros de MS-711 y MS-712.
   * 2. Fusiona e interpola a 1nm.
   * 3. Calcula PPFD (400-700nm) e iluminancia (380-780nm).
   *
   * @returns Resultado con espectro fusionado, PPFD (µmol/m²/s), e iluminancia (lux).
   */
  async analyzeSpectra(): Promise<AnalysisResult> {
    return this.request<AnalysisResult>("/api/v1/sensors/analyze", {
      method: "POST",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Instancia singleton por conveniencia (patrón común en apps React)
// ─────────────────────────────────────────────────────────────────────

/**
 * Instancia pre-configurada del cliente API.
 * Usa `VITE_API_BASE_URL` o `REACT_APP_API_BASE_URL` como variable de entorno,
 * con fallback a `http://localhost:8000`.
 */
export const apiClient = new SpectroradiometerApiClient({
  baseUrl:
    (typeof import.meta !== "undefined" && (import.meta as Record<string, any>).env?.VITE_API_BASE_URL) ||
    (typeof globalThis !== "undefined" && (globalThis as Record<string, any>).process?.env?.REACT_APP_API_BASE_URL) ||
    DEFAULT_BASE_URL,
});
