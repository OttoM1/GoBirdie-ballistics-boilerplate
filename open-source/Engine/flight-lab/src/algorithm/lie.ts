// lie coefficients, production values are proprietary

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


  rough: {
    ballSpeedMs: 0.95,
    launchSpinEfficiency: 0.55,
    uncertaintyM: 6.5,
    rollFactor: 1.25,
    carryDragFactor: 1.00,

    spinCheckCoupling: 0.35,
    spinBackCoupling: 0.02,
  },


  heavyRough: {
    ballSpeedMs: 0.92,            
    
    launchSpinEfficiency: 0.40,  
    uncertaintyM: 11.5,
    rollFactor: 0.70,          
        carryDragFactor: 1.00,

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


export function lieAdjustedLaunchRPM(baseRpm: number, eta: number): number {
  const mag = Math.min(Math.abs(baseRpm) * eta, LAUNCH_SPIN_RPM_MAX);
  return baseRpm >= 0 ? mag : -mag;
}


export function launchRPMWithLie(baseRpm: number, lie?: LieType): number {
  const eta = LIE_CONFIG[lie ?? ''].launchSpinEfficiency;
  return lieAdjustedLaunchRPM(baseRpm, eta);
}

/** @deprecated carry offsets disabled  */
export const LIE_CARRY_DELTA_M: Record<LieType, number> = Object.fromEntries(
  Object.keys(LIE_CONFIG).map((k) => [k, 0]),
) as Record<LieType, number>;