//  demo rain coefficients: these are generic multipliers, not production version scaled values

'use strict';

export type RainType = 'none' | 'light' | 'moderate' | 'heavy';

export interface RainConfig {
  readonly carryFactor: number;
  readonly rollFactor: number;
  readonly uncertaintyM: number;
}

export const RAIN_CONFIG: Record<RainType, RainConfig> = {
  none: { carryFactor: 1.000, rollFactor: 1.00, uncertaintyM: 0 },
  light: { carryFactor: 0.970, rollFactor: 0.75, uncertaintyM: 1.8 },
  moderate: { carryFactor: 0.950, rollFactor: 0.55, uncertaintyM: 2.7 },
  heavy: { carryFactor: 0.920, rollFactor: 0.35, uncertaintyM: 4.6 },
};
