import { z } from 'zod';
import {
  CurrentWeatherSchema,
  ForecastIntervalSchema,
  ForecastResponseSchema,
  FeatureContributionSchema,
  ExplainForecastResponseSchema,
  AlertRiskResponseSchema,
  SavedLocationSchema,
  PlatformSettingsSchema,
  AdminStatusSchema,
  ChatResponseSchema,
} from '../lib/schemas';

export type CurrentWeather = z.infer<typeof CurrentWeatherSchema>;
export type ForecastInterval = z.infer<typeof ForecastIntervalSchema>;
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;
export type FeatureContribution = z.infer<typeof FeatureContributionSchema>;
export type ExplainForecastResponse = z.infer<typeof ExplainForecastResponseSchema>;
export type AlertRiskResponse = z.infer<typeof AlertRiskResponseSchema>;
export type SavedLocation = z.infer<typeof SavedLocationSchema>;
export type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;
export type AdminStatus = z.infer<typeof AdminStatusSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: string[];
  confidence?: number;
  timestamp: string;
}
