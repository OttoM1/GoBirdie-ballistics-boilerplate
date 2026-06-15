
'use strict';


import type { BallFlightCondition } from './environment';
import type { LieType } from './lie';
import type { RainType } from './rain';


export interface ShotEnvironment {
 readonly tempC: number;
 readonly humidityPct: number;
 readonly pressurePa?: number;
 readonly windSpeedMs: number;
 readonly headComponent: number;
 readonly crossComponent: number;
 readonly windZ0M?: number;
 readonly windRefHeightM?: number;
}


export type ShotCalculationMode = 'anchored' | 'physics';


export interface TrackmanLaunch {
 readonly ballSpeedMs: number;
 readonly launchAngleDeg: number;
 readonly spinRPM: number;

  readonly sideSpinRPM?: number;

  readonly launchDirectionDeg?: number;
  readonly effectiveMassKg?: number;
  
 readonly maxHeightM?: number;

  readonly landingAngleDeg?: number;
}


export type LieTyp = LieType;
export type MissBias = 'long' | 'short' | 'none' | 'left' | 'right';


export type GroundRollRegime = 'forward_release' | 'checked' | 'spin_back';


export interface GroundRollDetail {
 regime: GroundRollRegime;
 backspinRpmLanding: number;
 landingAngleDeg: number;
 spinSpeedRatio: number;
 checkFraction: number;
 spinBackM: number;
 windAlongShotMs: number;
 nominalRollM: number;
}


export interface ShotInputs {
 readonly anchorCarryM: number;
 readonly trackman: TrackmanLaunch;
 readonly env: ShotEnvironment;
 readonly lie?: LieType;
 readonly rain?: RainType;
 readonly ball?: BallFlightCondition;
 readonly mode?: ShotCalculationMode;
 readonly physicsCarryCalibration?: number;
 readonly fairwaySlopeDeg?: number;
 readonly landingGroundYM?: number;
 readonly anchorRk4ReplaceMaxDeviationFrac?: number;
 readonly windSensitivityOverride?: number;
 readonly lateralSensitivityOverride?: number;
}


export interface ShotResult {
 carryM: number;
 physicsCarryM: number;
 anchorCarryM: number;
 apexHeightM: number;
 flightTimeS: number;
 lateralM: number;
 rollM: number;
 totalDistanceM: number;
 uncertaintyM: number;
 appliedAeroDelta: number;
 calculationMode: ShotCalculationMode;
 details: {
   weatherDeltaPct: number;
   windCarryDeltaPct: number;
   airDensityKgM3: number;
   referenceCarryM: number;
   weatherCarryM: number;
   actualCarryM: number;
   v0AfterCorMs: number;

   impactBallSpeedMs: number;

   impactLaunchAngleDeg: number;

   impactBackspinRpm: number;
   ballModel: {
     readonly dimpleTurbulence: number;
     readonly surfaceWear: number;
     readonly eccentricity: number;
     readonly spinDecayRateRefS: number;
   };
   groundRoll: GroundRollDetail;

   baselineCarryM: number;
   baselineApexM: number;
   baselineLandingAngleDeg: number;

   contextApexM: number;
   contextLandingAngleDeg: number;

   apexPhysicsRatio: number;

   landingAngleTrust: number;
 };
 calibrationVersion: number;
}



