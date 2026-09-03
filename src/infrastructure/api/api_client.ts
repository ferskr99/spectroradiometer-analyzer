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
export type AnalysisResult = components["schemas"]["AnalysisResult"];
export type HTTPValidationError = components["schemas"]["HTTPValidationError"];

export interface AnalysisRequest {
  sensor_target: "MS-711" | "MS-712" | "Merge" | string;
  exposure_time_ms: number;
  auto_exposure?: boolean;
}

export interface SchedulerConfig {
  start_time: string; // ISO format
  end_time: string;   // ISO format
  interval_minutes: number;
  sensor_target: string;
  exposure_time_ms: number;
  auto_exposure?: boolean;
}

export interface SchedulerStatusResponse {
  is_running: boolean;
  config: SchedulerConfig | null;
  last_exposure_ms?: number | null;
}

export interface MeasurementRecord {
  id: number;
  timestamp: string;
  sensor_target: string;
  exposure_time_ms: number;
  par: number;
  ppfd: number;
  illuminance: number;
  total_irradiance: number;
}

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
   * Ejecuta el pipeline de análisis de forma atómica. Configura el hardware, 
   * adquiere espectros y calcula PPFD e iluminancia.
   *
   * @param request - Parámetros de configuración y objetivo de medición.
   * @returns Resultado con espectro fusionado y cálculos radiométricos.
   */
  async analyzeSpectra(request: AnalysisRequest): Promise<AnalysisResult> {
    return this.request<AnalysisResult>("/api/v1/sensors/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * GET /api/v1/sensors/history/list
   *
   * Obtiene el historial de mediciones.
   */
  async getHistory(limit: number = 50): Promise<MeasurementRecord[]> {
    return this.request<MeasurementRecord[]>(
      `/api/v1/sensors/history/list?limit=${limit}`,
      { method: "GET" },
    );
  }

  /**
   * GET /api/v1/sensors/history/{record_id}
   *
   * Obtiene el detalle de una medición histórica, incluyendo su espectro completo.
   */
  async getHistoryDetail(recordId: number): Promise<AnalysisResult> {
    return this.request<AnalysisResult>(
      `/api/v1/sensors/history/${recordId}`,
      { method: "GET" },
    );
  }

  /**
   * GET /api/v1/sensors/history/batch?ids=...
   *
   * Obtiene el detalle de múltiples mediciones de una sola vez.
   * Retorna un diccionario donde la llave es el ID del registro y el valor es el AnalysisResult.
   */
  async getHistoryBatch(recordIds: number[]): Promise<Record<string, AnalysisResult>> {
    const idsParam = recordIds.join(",");
    return this.request<Record<string, AnalysisResult>>(
      `/api/v1/sensors/history/batch?ids=${idsParam}`,
      { method: "GET" },
    );
  }

  /**
   * GET /api/v1/sensors/health
   *
   * Obtiene la telemetría de salud de los sensores (temperaturas, voltajes).
   */
  async getHealth(): Promise<any> {
    return this.request<any>(
      `/api/v1/sensors/health`,
      { method: "GET" },
    );
  }


  /**
   * GET /api/v1/sensors/history/export/csv
   *
   * Obtiene la URL absoluta para descargar el CSV del historial.
   */
  getHistoryCsvUrl(): string {
    return `${this.baseUrl}/api/v1/sensors/history/export/csv`;
  }

  /**
   * GET /api/v1/sensors/history/export/batch/csv
   *
   * Obtiene la URL absoluta para descargar el CSV de una selección de registros.
   */
  getHistoryBatchCsvUrl(recordIds: number[]): string {
    const idsParam = recordIds.join(",");
    return `${this.baseUrl}/api/v1/sensors/history/export/batch/csv?ids=${idsParam}`;
  }

  // ─── Calibración ──────────────────────────────────────────────────

  /**
   * GET /api/v1/sensors/calibration
   *
   * Obtiene el estado de calibración de ambos sensores.
   */
  async getCalibrationStatus(): Promise<any> {
    return this.request<any>(
      `/api/v1/sensors/calibration`,
      { method: "GET" },
    );
  }

  // ─── Scheduler Avanzado ──────────────────────────────────────────

  /**
   * GET /api/v1/sensors/scheduler/status
   */
  async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
    return this.request<SchedulerStatusResponse>(
      `/api/v1/sensors/scheduler/status`,
      { method: "GET" }
    );
  }

  /**
   * POST /api/v1/sensors/scheduler/start
   */
  async startScheduler(config: SchedulerConfig): Promise<any> {
    return this.request<any>(
      `/api/v1/sensors/scheduler/start`,
      { 
        method: "POST",
        body: JSON.stringify(config),
      }
    );
  }

  /**
   * POST /api/v1/sensors/scheduler/stop
   */
  async stopScheduler(): Promise<any> {
    return this.request<any>(
      `/api/v1/sensors/scheduler/stop`,
      { method: "POST" }
    );
  }

  // ─── Exportación de Datos ─────────────────────────────────────────────────────

  /**
   * POST /api/v1/sensors/reports/generate
   *
   * Genera un informe PDF y retorna la URL del blob para descarga.
   */
  async generateReport(payload: { ids: number[]; title: string; author: string; notes: string }): Promise<Blob> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/sensors/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(
          `API error ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      return await response.blob();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        0,
      );
    } finally {
      clearTimeout(timer);
    }
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
