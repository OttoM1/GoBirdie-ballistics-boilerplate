//  roll estimate for the demo UI.

'use strict';

import type { LieConfig } from './lie';
import { ROLL_K } from './physicsConstants';
import type { RainConfig } from './rain';
import type { GroundRollDetail, GroundRollRegime } from './shotModel';

export function estimateGroundRollModel(
  terminalV: readonly [number, number, number],
  _terminalOmega: readonly [number, number, number],
  _launchAngleDeg: number,
  _apexHeightM: number,
  _windAlongShotMs: number,
  lieConfig: LieConfig,
  rainConfig: RainConfig,
  _landingAngleDegCatalog?: number,
): { rollM: number; ground: GroundRollDetail } {
  const u = Math.hypot(Math.max(terminalV[0], 0), terminalV[2]);
  const rollM = ROLL_K * u * lieConfig.rollFactor * rainConfig.rollFactor * 0.35;
  const regime: GroundRollRegime = rollM > 2 ? 'forward_release' : 'checked';

  return {
    rollM,
    ground: {
      regime,
      backspinRpmLanding: 0,
      landingAngleDeg: 45,
      spinSpeedRatio: 0,
      checkFraction: 0,
      spinBackM: 0,
      windAlongShotMs: 0,
      nominalRollM: rollM,
    },
  };
}
