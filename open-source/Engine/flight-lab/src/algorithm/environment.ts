//simplified atmosphere + ball defaults 


'use strict';

import { BALL, BALL_SURFACE, PHYSICS, THERMO } from './physicsConstants';
import { clamp, finiteOrDefault } from './math';

export interface AirState {
  readonly rho: number;
  readonly mu: number;
  readonly soundSpeedMs: number;
}

export interface BallFlightCondition {
  readonly dimpleTurbulence?: number;
  readonly surfaceWear?: number;
  readonly eccentricity?: number;
  readonly eccentricityAxisDeg?: number;
  readonly lutClMultiplier?: number;
  readonly lutCdMultiplier?: number;
}

export interface ResolvedBallFlightCondition {
  readonly lutClMultiplier: number;
  readonly lutCdMultiplier: number;
  readonly carryDragFactor: number;
}

export function getEnvironment(
  tempC: number,
  rhPct: number,
  pressurePa: number = PHYSICS.P_DEFAULT,
): AirState {
  const T_K = tempC + THERMO.T_0;
  const e_sat = 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const e = (Math.max(0, Math.min(rhPct, 100)) / 100) * e_sat;
  const w = THERMO.EPSILON * (e / Math.max(pressurePa - e, 1e-3));
  const T_v = T_K * (1 + 0.61 * w);
  const rho = pressurePa / (PHYSICS.R_DRY * T_v);
  const mu = THERMO.MU_0
    * Math.pow(T_K / THERMO.T_0, 1.5)
    * ((THERMO.T_0 + THERMO.S_MU) / (T_K + THERMO.S_MU));
  const soundSpeedMs = 331.3 + 0.606 * tempC;
  return { rho, mu, soundSpeedMs };
}

export function resolveBallFlightCondition(
  condition: BallFlightCondition | undefined,
): ResolvedBallFlightCondition {
  const wear = clamp(finiteOrDefault(condition?.surfaceWear, BALL_SURFACE.DEFAULT_SURFACE_WEAR), 0, 1);
  return {
    lutClMultiplier: Math.max(1e-3, finiteOrDefault(condition?.lutClMultiplier, 1)),
    lutCdMultiplier: Math.max(1e-3, finiteOrDefault(condition?.lutCdMultiplier, 1)) * (1 + 0.05 * wear),
    carryDragFactor: 1,
  };
}
