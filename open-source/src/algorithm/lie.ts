'use strict';

export type LieType =
  | 'fairway'
  | 'rough'
  | 'heavyRough'
  | 'fairwayBunker'
  | 'sand'
  | 'tee'
  | '';

export interface LieConfig {
  readonly ballSpeedMs: number;
  readonly launchSpinEfficiency: number;
  /** RK4 CD multiplier for this lie only (<1 slightly eases form drag on low-spin flights). */
  readonly carryDragFactor: number;
  readonly uncertaintyM: number;
  readonly rollFactor: number;
  readonly spinCheckCoupling: number;
  readonly spinBackCoupling: number;
}

export const LIE_CONFIG: Record<LieType, LieConfig> = {
fairway: {
    ballSpeedMs: 1.00,
    launchSpinEfficiency: 1.00,
    uncertaintyM: 1.8,
        carryDragFactor: 1.00,

    rollFactor: 1.00,
    spinCheckCoupling: 1.00,
    spinBackCoupling: 0.42,
  },

  /* Rough steals clubhead/smash vs fairway — lower launch speed together with spin loss */
  rough: {
    ballSpeedMs: 0.95,
    launchSpinEfficiency: 0.55,
    uncertaintyM: 6.5,
    rollFactor: 1.25,
    carryDragFactor: 1.00,
    // Trundle effect on landing
    spinCheckCoupling: 0.35,
    spinBackCoupling: 0.02,
  },

  /* TUNED FOR THE 'HACK': Slow speed, muffled flight */
  heavyRough: {
    ballSpeedMs: 0.92,            // Thick grass drags clubhead speed down
    launchSpinEfficiency: 0.40,   // Massive spin loss
    uncertaintyM: 11.5,
    rollFactor: 0.70,          
        carryDragFactor: 1.00,
   // Ground is too thick for long roll
    spinCheckCoupling: 0.20,
    spinBackCoupling: 0.00,
  },

  fairwayBunker: {
    ballSpeedMs: 0.98,
        carryDragFactor: 1.00,

    launchSpinEfficiency: 0.88,
    uncertaintyM: 2.4,
    rollFactor: 0.85,
    spinCheckCoupling: 0.90,
    spinBackCoupling: 0.12,
  },

  tee: {
    ballSpeedMs: 1.08,
    launchSpinEfficiency: 1.03,
    uncertaintyM: 0.8,
    rollFactor: 1.05,
        carryDragFactor: 1.00,

    spinCheckCoupling: 0.98,
    spinBackCoupling: 0.46,
  },

  '': {
    ballSpeedMs: 1.00,
    launchSpinEfficiency: 1.00,
    uncertaintyM: 1.8,
        carryDragFactor: 1.00,

    rollFactor: 1.00,
    spinCheckCoupling: 1.00,
    spinBackCoupling: 0.48,
  },
  sand: {
    ballSpeedMs: 1.00,
    launchSpinEfficiency: 0.78,
    carryDragFactor: 1.00,
    uncertaintyM: 3.8,
    rollFactor: 0.08,
    spinCheckCoupling: 0.90,
    spinBackCoupling: 0.18,
  },
};

const LAUNCH_SPIN_RPM_MAX = 16_000;

/** Effective launch RPM after lie efficiency η. Preserves sign (side spin). */
export function lieAdjustedLaunchRPM(baseRpm: number, eta: number): number {
  const mag = Math.min(Math.abs(baseRpm) * eta, LAUNCH_SPIN_RPM_MAX);
  return baseRpm >= 0 ? mag : -mag;
}

/** Same scaling used for context RK4 legs (see `calculateShot`). */
export function launchRPMWithLie(baseRpm: number, lie?: LieType): number {
  const eta = LIE_CONFIG[lie ?? ''].launchSpinEfficiency;
  return lieAdjustedLaunchRPM(baseRpm, eta);
}

/** @deprecated Carry offsets removed — lie carry comes from RK4 η scaling. */
export const LIE_CARRY_DELTA_M: Record<LieType, number> = Object.fromEntries(
  Object.keys(LIE_CONFIG).map((k) => [k, 0]),
) as Record<LieType, number>;