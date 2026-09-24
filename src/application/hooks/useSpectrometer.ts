/**
 * useSpectrometer.ts
 *
 * Hooks de estado asíncrono para la capa de aplicación.
 * Encapsulan la comunicación con el backend a través de React Query,
 * manejando la latencia física del hardware (hasta 5000ms por el
 * tiempo de exposición del obturador).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type AnalysisResult,
  type SpectralData,
  type AnalysisRequest,
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
  /** Dispara la adquisición y configuración atómica (MS-711, MS-713 o fusión). */
  analyze: (request: AnalysisRequest) => void;
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
 * Hook para ejecutar de forma atómica la configuración y medición del espectrómetro.
 *
 * Internamente usa `useMutation` porque el análisis es una acción
 * imperativa disparada por el usuario (no un fetch reactivo), y
 * porque el backend realiza I/O con el hardware (side-effect).
 */
export function useAnalyzeSpectrum(): UseAnalyzeSpectrumReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation<AnalysisResult, ApiError, AnalysisRequest>({
    mutationKey: spectrometerKeys.analysis(),
    mutationFn: (request) => apiClient.analyzeSpectra(request),
    onSuccess: (data) => {
      queryClient.setQueryData(["lastAnalysis"], data);
      window.dispatchEvent(new Event("spectrometer:measurement_complete"));
    },
    // No reintentamos automáticamente: la latencia del hardware hace que
    // los reintentos sean costosos (hasta 10s por intento adicional).
    retry: false,
  });

  return {
    analyze: (request: AnalysisRequest) => mutation.mutate(request),
    data: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
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
 * @param sensorId — "MS-711" o "MS-713" (type-safe en compile-time).
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
