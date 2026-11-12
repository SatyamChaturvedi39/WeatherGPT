import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PlatformSettings } from '../types';
import type { CrowdReportType } from '../types/extra';

export function useCurrentWeather(lat: number, lon: number) {
  return useQuery({
    queryKey: ['weather', 'current', lat, lon],
    queryFn: () => api.getCurrentWeather(lat, lon),
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

export function useForecast(lat: number, lon: number, horizon: number = 72) {
  return useQuery({
    queryKey: ['weather', 'forecast', lat, lon, horizon],
    queryFn: () => api.getForecast(lat, lon, horizon),
    staleTime: 1000 * 60 * 10,
  });
}

export function useForecastExplain(lat: number, lon: number, variable: string = 'temperature_2m', horizon: number = 24) {
  return useQuery({
    queryKey: ['weather', 'explain', lat, lon, variable, horizon],
    queryFn: () => api.getExplainForecast(lat, lon, variable, horizon),
    staleTime: 1000 * 60 * 15,
  });
}

export function useRiskAlerts(lat: number, lon: number, activity: string = 'running') {
  return useQuery({
    queryKey: ['weather', 'alerts', lat, lon, activity],
    queryFn: () => api.getAlerts(lat, lon, activity),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlatformSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  });

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<PlatformSettings>) => api.updateSettings(newSettings),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  return { ...query, updateSettings: mutation.mutateAsync, isUpdating: mutation.isPending };
}

export function useAdminStatus() {
  return useQuery({
    queryKey: ['admin', 'status'],
    queryFn: () => api.getAdminStatus(),
    refetchInterval: 15000, // refresh admin health every 15s
  });
}

// ─── Feats-branch feature hooks ──────────────────────────────────────────────
export function useRouteDepartures(origin: string, destination: string, mode: string) {
  return useQuery({
    queryKey: ['route-departures', origin, destination, mode],
    queryFn: () => api.getRouteDepartures(origin, destination, mode),
    enabled: origin.trim().length > 1 && destination.trim().length > 1,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useRouteForecast(origin: string, destination: string, mode: string, enabled: boolean) {
  return useQuery({
    queryKey: ['route', origin, destination, mode],
    queryFn: () => api.getRoute(origin, destination, mode),
    enabled: enabled && origin.trim().length > 1 && destination.trim().length > 1,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useMicroclimates() {
  return useQuery({ queryKey: ['microclimates'], queryFn: api.getMicroclimates, staleTime: 1000 * 60 * 10 });
}

export function useFloodTwin(hours = 6, scenarioMm = 0) {
  return useQuery({
    queryKey: ['flood-twin', hours, scenarioMm],
    queryFn: () => api.getFloodTwin(hours, scenarioMm),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

export function useFloodReports() {
  return useQuery({ queryKey: ['flood-reports'], queryFn: api.getFloodReports, refetchInterval: 1000 * 60 });
}

export function useSubmitFloodReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, where }: { type: CrowdReportType; where: { zoneId: string } | { lat: number; lon: number } }) =>
      api.submitFloodReport(type, where),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flood-reports'] });
      queryClient.invalidateQueries({ queryKey: ['flood-twin'] });
    },
  });
}

export function useAlertsCenter(lat: number, lon: number) {
  return useQuery({ queryKey: ['alerts-center', lat, lon], queryFn: () => api.getAlertsCenter(lat, lon), staleTime: 1000 * 60 * 5 });
}

export function useAlertHistory(lat: number, lon: number, days = 7) {
  return useQuery({ queryKey: ['alert-history', lat, lon, days], queryFn: () => api.getAlertHistory(lat, lon, days), staleTime: 1000 * 60 * 30 });
}

export function useAirQuality(lat: number, lon: number) {
  return useQuery({ queryKey: ['aqi', lat, lon], queryFn: () => api.getAirQuality(lat, lon), staleTime: 1000 * 60 * 15 });
}

export function useMlPrediction(lat: number, lon: number) {
  return useQuery({ queryKey: ['ml-prediction', lat, lon], queryFn: () => api.getMlPrediction(lat, lon), staleTime: 1000 * 60 * 15, retry: false });
}

export function useForecastVerification(days = 30) {
  return useQuery({
    queryKey: ['admin', 'verification', days],
    queryFn: () => api.getForecastVerification(days),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useBenchmarks() {
  return useQuery({ queryKey: ['benchmarks'], queryFn: api.getBenchmarks, staleTime: Infinity });
}
