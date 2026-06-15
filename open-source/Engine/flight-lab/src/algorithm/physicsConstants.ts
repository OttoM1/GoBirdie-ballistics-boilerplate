// physics constants; coarse integrator, not production tuned

'use strict';

export const CALIBRATION_VERSION = 0;

export const PHYSICS = {
  R_DRY: 287.058,
  G: 9.80665,
  P_DEFAULT: 101325,
  REF_TEMP_C: 20.0,
  REF_HUMIDITY_PCT: 50,

  DT: 0.025,
  MAX_STEPS: 800,
  EVENT_BISECT_ITERS: 12,
} as const;

export const THERMO = {
  EPSILON: 0.622,
  MU_0: 1.716e-5,
  T_0: 273.15,
  S_MU: 111,
} as const;

export const BALL = {
  mass: 0.04560,
  diameter: 0.04267,
  radius: 0.021335,
  area: Math.PI * 0.021335 ** 2,
  cor_base: 0.781,
  d_cor_dT: 0.001,
  S_MAX: 0.65,
  SPIN_DECAY_RATE: 0.018,
  STALL_VELOCITY: 10.0,
  VREL_SPIN_FLOOR_MS: 5.0,
} as const;

export const BALL_SURFACE = {
  DEFAULT_DIMPLE_TURBULENCE: 1,
  DEFAULT_SURFACE_WEAR: 0,
  DEFAULT_ECCENTRICITY: 0,
  DEFAULT_ECCENTRICITY_AXIS_DEG: 0,
} as const;

export const WIND_LOG_LAW = {
  z0: 0.04,
  zRef: 10.0,
} as const;

export const ROLL_K = 1.1;
