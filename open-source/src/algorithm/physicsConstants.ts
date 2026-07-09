'use strict';

export const CALIBRATION_VERSION = 23;

export const PHYSICS = {
  R_DRY: 287.058,
  G: 9.80665,
  P_DEFAULT: 101325,
  REF_TEMP_C: 20.0,
  REF_HUMIDITY_PCT: 50,
  DT: 0.01,
  // Reduced to prevent rare hover/float loops in extreme conditions.
  MAX_STEPS: 2000,
  EVENT_BISECT_ITERS: 30,
} as const;

export const THERMO = {
  EPSILON: 0.622,
  MU_0: 1.716e-5,
  T_0: 273.15,
  S_MU: 111,
} as const;

export const BALL = {
  AERO_DENSITY_FACTOR_LONG: 0.38,
  AERO_DENSITY_FACTOR_MID: 0.37,
  AERO_DENSITY_FACTOR_SHORT: 0.27,
  mass: 0.04560,
  diameter: 0.04267,
  radius: 0.021335,
  area: Math.PI * 0.021335 ** 2,
  cor_base: 0.781,
  d_cor_dT: 0.001,
  AERO_LUT_N_RE: 24,
  AERO_LUT_N_S: 28,
  S_MAX: 0.65,
  MACH_DRAG_ONSET: 0.19,
  MACH_DRAG_COEFF: 0.42,
  SPIN_DECAY_RATE: 0.022,
  /**
   * Anchored-mode RK4 carry-delta gain when the wind component opposes the shot
   * (headwind → RK4 carry < calm carry). Pure Galilean RK4 over-magnifies the
   * headwind penalty for spin-heavy irons because (a) the LUT does not yet model
   * the post-drag-crisis CL drop at very high Re, (b) the log-law wind aloft is
   * stronger than the wind a real ball averages while inside the boundary layer,
   * and (c) the Q∝v_rel² coupling stacks on iron-class Magnus lift to produce a
   * larger balloon than Trackman field data shows. Calibrated against `claude.md`
   * 7-iron @ 20 m/s head (≈ -38 m vs stock).
   */
  WIND_SENSITIVITY_CARRY_HEAD: 0.45,
  /**
   * Anchored-mode RK4 carry-delta gain when the wind component aids the shot.
   * Tailwind effect is closer to RK4 magnitude, but the iron-class boost band
   * widening (`BALL.IRON_CL_BOOST_S_HI = 0.6`) recovers tail apex/lift in a
   * way that shrinks the bare RK4 carry delta. The scale lands the anchored
   * tail carry back on `claude.md` 7-iron @ 20 m/s tail (≈ +15 m vs stock).
   */
  WIND_SENSITIVITY_CARRY_TAIL: 1.85,
  /** Lateral wind delta gain (anchored mode). Pure RK4 lateral handled directly elsewhere. */
  WIND_SENSITIVITY_LATERAL: 1.0,
  /**
   * Symmetric blend factor for anchored-mode apex: apex_report = catalog_apex +
   * (rk4_context_apex − rk4_baseline_apex) × this. ≈ 0.55 reproduces `claude.md`
   * 7-iron head/tail apex with a single value because Galilean RK4 over- and
   * under-shoots apex by similar fractions in head vs tail.
   */
  WIND_SENSITIVITY_APEX: 0.55,
  /** Headwind blend factor for anchored-mode RK4 landing-angle delta vs catalog. */
  WIND_SENSITIVITY_LANDING_HEAD: 0.38,
  /** Tailwind blend factor for anchored-mode RK4 landing-angle delta vs catalog. */
  WIND_SENSITIVITY_LANDING_TAIL: 0.92,
  STALL_VELOCITY: 8.0,
  /** Floor on |v_rel| when forming spin parameter S (avoids divide-by-near-zero). */
  VREL_SPIN_FLOOR_MS: 4.0,
  /**
   * Lower / upper edges of spin parameter S where the Trackman-class iron Magnus
   * amplification is active. The upper edge is widened past the original 0.4
   * cutoff so the boost still applies into a tailwind, where |v_rel| drops and
   * S climbs into the 0.4–0.6 range — without this extension the late-tail flight
   * loses too much lift and the apex collapses (see `claude.md` 7-iron tail apex).
   */
  IRON_CL_BOOST_S_LO: 0.2,
  IRON_CL_BOOST_S_HI: 0.6,
  /**
   * Peak fractional lift increase at band center (mid-iron S). Half-sine taper
   * across [IRON_CL_BOOST_S_LO, IRON_CL_BOOST_S_HI].
   */
  IRON_CL_BOOST_MAX_DELTA: 0.18,
  /**
   * Global CD trim matched to LUT + CL boost so carry does not collapse from excess form drag.
   */
  TRACKMAN_CD_CALIBRATION_SCALE: 0.96,
} as const;

export const BALL_SURFACE = {
  RE_REF: 150_000,
  RE_MIN: 50_000,
  RE_MAX: 300_000,
  DEFAULT_DIMPLE_TURBULENCE: 1,
  DEFAULT_SURFACE_WEAR: 0,
  DEFAULT_ECCENTRICITY: 0,
  DEFAULT_ECCENTRICITY_AXIS_DEG: 0,
  ECCENTRIC_FORCE_COEFF_MAX: 0.035,
} as const;

export const WIND_LOG_LAW = {
  z0: 0.04,
  zRef: 10.0,
} as const;

export const ROLL_K = 1.50;
