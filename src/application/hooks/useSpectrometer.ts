/**
 * useSpectrometer.ts
 *
 * Hooks de estado asíncrono para la capa de aplicación.
 * Encapsulan la comunicación con el backend a través de React Query,
 * manejando la latencia física del hardware (hasta 5000ms por el
 * tiempo de exposición del obturador).
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  apiClient,
  type AnalysisResult,
  type SpectralData,
  type SpectrometerConfig,
  type SensorId,
  ApiError,
} from "../../infrastructure/api";

// ─────────────────────────────────────────────────────────────────────
// Keys de React Query (centralizadas para invalidación consistente)
// ─────────────────────────────────────────────────────────────────────

export const spectrometerKeys = {
  all: ["spectrometer"] as const,
  spectrum: (sensorId: SensorId) =>
    [...spectrometerKeys.all, "spectrum", sensorId] as const,
  analysis: () => [...spectrometerKeys.all, "analysis"] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// useAnalyzeSpectrum — Mutation para el análisis espectral completo
// ─────────────────────────────────────────────────────────────────────

/**
 * Resultado extendido del hook de análisis.
 * Expone los estados de React Query junto con helpers tipados.
 */
export interface UseAnalyzeSpectrumReturn {
  /** Dispara la adquisición + análisis (MS-711 + MS-712 → fusión → PPFD + lux). */
  analyze: () => void;
  /** Resultado tipado del análisis (disponible cuando isSuccess=true). */
  data: AnalysisResult | undefined;
  /** `true` mientras el hardware está procesando (hasta 5s de latencia física). */
  isPending: boolean;
  /** `true` si la última medición falló. */
  isError: boolean;
  /** Objeto de error tipado (ApiError con detalles de validación FastAPI). */
  error: ApiError | null;
  /** `true` si al menos una medición fue exitosa. */
  isSuccess: boolean;
  /** Reinicia el estado del mutation (limpia data, error, etc.). */
  reset: () => void;
}

/**
 * Hook para ejecutar el pipeline completo de análisis espectral.
 *
 * Internamente usa `useMutation` porque el análisis es una acción
 * imperativa disparada por el usuario (no un fetch reactivo), y
 * porque el backend realiza I/O con el hardware (side-effect).
 *
 * React Query maneja automáticamente:
 * - `isPending`: ideal para mostrar un spinner durante los ~5s de latencia.
 * - `isError` + `error`: errores de red, timeout, o validación 422.
 * - `data`: resultado `AnalysisResult` fuertemente tipado.
 *
 * @example
 * ```tsx
 * function AnalysisPanel() {
 *   const { analyze, data, isPending, isError, error } = useAnalyzeSpectrum();
 *
 *   return (
 *     <>
 *       <button onClick={analyze} disabled={isPending}>
 *         {isPending ? "Midiendo..." : "Iniciar Análisis"}
 *       </button>
 *       {data && <SpectralGraph data={data.merged_spectrum} isLoading={false} />}
 *       {isError && <p>Error: {error?.message}</p>}
 *     </>
 *   );
 * }
 * ```
 */
export function useAnalyzeSpectrum(): UseAnalyzeSpectrumReturn {
  const mutation = useMutation<AnalysisResult, ApiError>({
    mutationKey: spectrometerKeys.analysis(),
    mutationFn: () => apiClient.analyzeSpectra(),
    // No reintentamos automáticamente: la latencia del hardware hace que
    // los reintentos sean costosos (hasta 10s por intento adicional).
    retry: false,
  });

  return {
    analyze: () => mutation.mutate(),
    data: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ─────────────────────────────────────────────────────────────────────
// useConfigureSensor — Mutation para configurar el equipo
// ─────────────────────────────────────────────────────────────────────

/**
 * Hook para enviar configuración al espectrorradiómetro.
 *
 * @example
 * ```tsx
 * const { configure, isPending } = useConfigureSensor();
 * configure({ sensor_id: "MS-711", exposure_time_ms: 500 });
 * ```
 */
export function useConfigureSensor() {
  const mutation = useMutation<boolean, ApiError, SpectrometerConfig>({
    mutationFn: (config) => apiClient.configureSensor(config),
    retry: false,
  });

  return {
    configure: (config: SpectrometerConfig) => mutation.mutate(config),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ─────────────────────────────────────────────────────────────────────
// useSpectrum — Query para lectura individual de un sensor
// ─────────────────────────────────────────────────────────────────────

/**
 * Hook reactivo para obtener el espectro de un sensor individual.
 * Se activa solo cuando `enabled=true`.
 *
 * @param sensorId — "MS-711" o "MS-712" (type-safe en compile-time).
 * @param enabled — Controla si la query se ejecuta automáticamente.
 */
export function useSpectrum(sensorId: SensorId, enabled = false) {
  return useQuery<SpectralData, ApiError>({
    queryKey: spectrometerKeys.spectrum(sensorId),
    queryFn: () => apiClient.getSpectrum(sensorId),
    enabled,
    // No revalidar automáticamente: los datos del hardware son puntuales
    staleTime: Infinity,
    retry: false,
  });
}
