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
  /** Multiply interpolated LUT lift coefficient (before stall / dimple / iron-band stacking). Default 1. */
  readonly lutClMultiplier?: number;
  /** Multiply interpolated LUT drag coefficient (before stall / dimple stacking). Default 1. */
  readonly lutCdMultiplier?: number;
  /**
   * Peak fractional CL bell on S ∈ [IRON_CL_BOOST_S_LO, HI] (half-sine). Default = engine BALL constant.
   */
  readonly ironBandClBoostMaxDelta?: number;
  /** Multiply CD together with lie `carryDragFactor` after LUT + dimples. Default = engine BALL constant. */
  readonly baselineCdCalibrationScale?: number;
}

export interface ResolvedBallFlightCondition {
  readonly dimpleTurbulence: number;
  readonly surfaceWear: number;
  readonly eccentricity: number;
  readonly eccentricityAxisRad: number;
  readonly spinDecayMultiplier: number;
  readonly eccentricForceCoeff: number;
  readonly lutClMultiplier: number;
  readonly lutCdMultiplier: number;
  readonly ironBandClBoostMaxDelta: number;
  readonly baselineCdCalibrationScale: number;
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

export const REF_DYNAMIC_VISCOSITY = getEnvironment(
  PHYSICS.REF_TEMP_C, PHYSICS.REF_HUMIDITY_PCT, PHYSICS.P_DEFAULT,
).mu;

export function resolveBallFlightCondition(
  condition: BallFlightCondition | undefined,
): ResolvedBallFlightCondition {
  const dimpleTurbulence = clamp(
    finiteOrDefault(condition?.dimpleTurbulence, BALL_SURFACE.DEFAULT_DIMPLE_TURBULENCE),
    0,
    1,
  );
  const surfaceWear = clamp(
    finiteOrDefault(condition?.surfaceWear, BALL_SURFACE.DEFAULT_SURFACE_WEAR),
    0,
    1,
  );
  const eccentricity = clamp(
    finiteOrDefault(condition?.eccentricity, BALL_SURFACE.DEFAULT_ECCENTRICITY),
    0,
    1,
  );
  const eccentricityAxisDeg = finiteOrDefault(
    condition?.eccentricityAxisDeg,
    BALL_SURFACE.DEFAULT_ECCENTRICITY_AXIS_DEG,
  );

  const lutClMultiplier = Math.max(
    1e-3,
    finiteOrDefault(condition?.lutClMultiplier, 1),
  );
  const lutCdMultiplier = Math.max(
    1e-3,
    finiteOrDefault(condition?.lutCdMultiplier, 1),
  );
  const ironBandClBoostMaxDelta = clamp(
    finiteOrDefault(condition?.ironBandClBoostMaxDelta, BALL.IRON_CL_BOOST_MAX_DELTA),
    0,
    3,
  );
  const baselineCdCalibrationScale = clamp(
    finiteOrDefault(condition?.baselineCdCalibrationScale, BALL.TRACKMAN_CD_CALIBRATION_SCALE),
    1e-3,
    3,
  );

  return {
    dimpleTurbulence,
    surfaceWear,
    eccentricity,
    eccentricityAxisRad: (eccentricityAxisDeg * Math.PI) / 180,
    spinDecayMultiplier: 1
      + 0.25 * surfaceWear
      + 0.10 * (1 - dimpleTurbulence)
      + 0.08 * eccentricity,
    eccentricForceCoeff: BALL_SURFACE.ECCENTRIC_FORCE_COEFF_MAX * eccentricity,
    lutClMultiplier,
    lutCdMultiplier,
    ironBandClBoostMaxDelta,
    baselineCdCalibrationScale,
  };
}
