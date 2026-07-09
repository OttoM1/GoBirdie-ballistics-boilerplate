
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
 /** Derived from spin axis when resolved from a profile; used by RK4. */
 readonly sideSpinRPM?: number;
 /** Horizontal launch angle off target line (°); 0 = straight. */
 readonly launchDirectionDeg?: number;
 readonly effectiveMassKg?: number;
 /**
  * Peak height above launch (m); monitor reference. In anchored mode, reported
  * apex = this × smoothed RK4 ratio (full context vs stock baseline at ref air),
  * not a simple carry stretch (see `calculateShot`).
  */
 readonly maxHeightM?: number;
 /** Landing descent angle below horizontal (°); monitor reference — ignored by RK4. */
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
   /** Speed into RK4 after COR/temperature and lie smash (m/s). */
   impactBallSpeedMs: number;
   /** Launch elevation used by the integrator (°). */
   impactLaunchAngleDeg: number;
   /** Backspin into RK4 after lie efficiency (rpm). */
   impactBackspinRpm: number;
   ballModel: {
     readonly dimpleTurbulence: number;
     readonly surfaceWear: number;
     readonly eccentricity: number;
     readonly spinDecayRateRefS: number;
   };
   groundRoll: GroundRollDetail;
   /** Stock flight at ref air, no wind, fairway spin — anchor launch, same ball model. */
   baselineCarryM: number;
   baselineApexM: number;
   baselineLandingAngleDeg: number;
   /** Full-context RK4 apex before Monitor scaling. */
   contextApexM: number;
   contextLandingAngleDeg: number;
   /** `contextApexM / baselineApexM` after clamp/smoothing used for Monitor apex. */
   apexPhysicsRatio: number;
   /** 1 = in-band landing angle; lower → anchored carry blended toward physics carry. */
   landingAngleTrust: number;
 };
 calibrationVersion: number;
}



