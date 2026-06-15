'use strict';

import type { BallFlightCondition } from './environment';
import { finiteOrDefault } from './math';
import { PHYSICS } from './physicsConstants';
import type { RainType } from './rain';
import type { LieType } from './lie';
import type { ShotCalculationMode } from './shotModel';

const P_PRESSURE_TOLERANCE_PA = 2;

function defaultBall(b?: BallFlightCondition): boolean {
  if (b === undefined) return true;
  return (
    Math.abs(finiteOrDefault(b.dimpleTurbulence, 1) - 1) < 1e-6
    && Math.abs(finiteOrDefault(b.surfaceWear, 0)) < 1e-6
    && Math.abs(finiteOrDefault(b.lutClMultiplier, 1) - 1) < 1e-6
    && Math.abs(finiteOrDefault(b.lutCdMultiplier, 1) - 1) < 1e-6
  );
}




export function neutralStockEnvironmentalInputs(args: {
  readonly env: {
    readonly tempC: number;
    readonly humidityPct: number;
    readonly pressurePa?: number;
    readonly windSpeedMs: number;
    readonly headComponent: number;
    readonly crossComponent: number;
  };
  readonly lie?: LieType;
  readonly rain?: RainType;
  readonly fairwaySlopeDeg?: number;
  readonly ball?: BallFlightCondition;
  readonly mode?: ShotCalculationMode;
}): boolean {
  if (args.mode === 'physics') return false;

  const e = args.env;
  if (Math.abs(e.tempC - PHYSICS.REF_TEMP_C) > 1e-6) return false;
  if (Math.abs(e.humidityPct - PHYSICS.REF_HUMIDITY_PCT) > 1e-6) return false;
  const pp = finiteOrDefault(e.pressurePa, PHYSICS.P_DEFAULT);
  if (Math.abs(pp - PHYSICS.P_DEFAULT) > P_PRESSURE_TOLERANCE_PA) return false;
  if (Math.abs(e.windSpeedMs) > 1e-9) return false;

  const lie = args.lie ?? '';
  if (lie !== '' && lie !== 'fairway') return false;
  if ((args.rain ?? 'none') !== 'none') return false;
  if (Math.abs(finiteOrDefault(args.fairwaySlopeDeg, 0)) > 1e-9) return false;

  return defaultBall(args.ball);
}
