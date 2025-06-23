import { z } from 'zod';

// TrailSettings Zodスキーマ
export const TrailSettingsSchema = z.object({
  enabled: z.boolean(),
  trailType: z.enum(['percentage', 'pip', 'price']),
  trailValue: z.number().positive(),
  activationThreshold: z.number().optional(),
  maxLoss: z.number().optional(),
  timeBasedSettings: z.object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    timezone: z.string(),
  }).optional(),
  conditions: z.object({
    minProfit: z.number(),
    maxDrawdown: z.number(),
    volatilityThreshold: z.number(),
  }).optional(),
});

// HedgeSettings Zodスキーマ
export const HedgeSettingsSchema = z.object({
  strategy: z.enum(['cross_account', 'single_account', 'correlation_based']),
  ratio: z.number().min(0).max(1),
  correlationPairs: z.array(z.object({
    primary: z.string(),
    hedge: z.string(),
    correlation: z.number().min(-1).max(1),
  })),
  rebalanceRules: z.object({
    threshold: z.number().positive(),
    frequency: z.enum(['real_time', 'hourly', 'daily']),
    maxPositionSize: z.number().positive(),
  }).optional(),
  riskLimits: z.object({
    maxExposure: z.number().positive(),
    maxLoss: z.number().positive(),
    correlationThreshold: z.number().min(0).max(1),
  }),
});

// 型推論
export type TrailSettings = z.infer<typeof TrailSettingsSchema>;
export type HedgeSettings = z.infer<typeof HedgeSettingsSchema>;