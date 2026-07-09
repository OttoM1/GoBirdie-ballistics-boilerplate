'use strict';

import { BALL } from './physicsConstants';
import { smoothstep01 } from './math';

/**
 * Smooth density sensitivity vs anchor carry (replaces hard breakpoints at 120 m / 180 m).
 */
export function aeroDensityFactorFromAnchor(anchorCarryM: number): number {
  const lo = BALL.AERO_DENSITY_FACTOR_SHORT;
  const mid = BALL.AERO_DENSITY_FACTOR_MID;
  const hi = BALL.AERO_DENSITY_FACTOR_LONG;
  if (anchorCarryM <= 0) return lo;
  if (anchorCarryM < 120) {
    const t = smoothstep01(anchorCarryM / 120);
    return lo + t * (mid - lo);
  }
  if (anchorCarryM < 180) {
    const t = smoothstep01((anchorCarryM - 120) / 60);
    return mid + t * (hi - mid);
  }
  return hi;
}
