import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PlatformSettings } from '../types';

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
