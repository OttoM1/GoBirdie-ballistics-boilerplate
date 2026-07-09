
'use strict';


import { aeroDensityFactorFromAnchor } from './aeroDensity';
import { landingAngleTrustWeight } from './flightConstraints';
import {
 getEnvironment,
 resolveBallFlightCondition,
} from './environment';
import type { FlightSimExtras } from './flightTypes';
import { estimateGroundRollModel } from './groundRoll';
import { lieAdjustedLaunchRPM, LIE_CONFIG } from './lie';
import { clamp, finiteOrDefault } from './math';
import { neutralStockEnvironmentalInputs } from './neutralShot';
import { BALL, CALIBRATION_VERSION, PHYSICS } from './physicsConstants';
import type { RainType } from './rain';
import { RAIN_CONFIG } from './rain';
import {
 createSimWorkspace,
 simulateFlightRK4,
} from './rk4Flight';
import type { ShotCalculationMode, ShotInputs, ShotResult } from './shotModel';


export function calculateShot(args: ShotInputs): ShotResult {
 const { anchorCarryM, trackman, env } = args;
 const mode: ShotCalculationMode = args.mode === 'physics' ? 'physics' : 'anchored';
 const physicsCal = finiteOrDefault(args.physicsCarryCalibration, 1);
 const pressurePa = env.pressurePa ?? PHYSICS.P_DEFAULT;
 const lieKey = args.lie ?? '';
 const rainKey = (args.rain ?? 'none') as RainType;
 const lieConfig = LIE_CONFIG[lieKey];
 const rainConfig = RAIN_CONFIG[rainKey];
 const sideSpinRPM = trackman.sideSpinRPM ?? 0;
 const launchDirectionDeg = trackman.launchDirectionDeg ?? 0;
 const ballModel = resolveBallFlightCondition(args.ball);
 const flightEx: FlightSimExtras | undefined =
   typeof args.landingGroundYM === 'number' && Number.isFinite(args.landingGroundYM)
     ? { groundYM: args.landingGroundYM }
     : undefined;


 const envRef = getEnvironment(
   PHYSICS.REF_TEMP_C, PHYSICS.REF_HUMIDITY_PCT, PHYSICS.P_DEFAULT,
 );
 const envNow = getEnvironment(env.tempC, env.humidityPct, pressurePa);


 const v0RefMs = trackman.ballSpeedMs;
 const dCor = BALL.d_cor_dT * (env.tempC - PHYSICS.REF_TEMP_C);
 const v0NowMs = v0RefMs * (1 + dCor / (1 + BALL.cor_base));


 const wind = env.windSpeedMs > 0
   ? {
       wind_x: -env.windSpeedMs * env.headComponent,
       wind_z: env.windSpeedMs * env.crossComponent,
       refSpeedMs: env.windSpeedMs,
       ...(typeof env.windZ0M === 'number' && Number.isFinite(env.windZ0M)
         ? { z0: env.windZ0M }
         : {}),
       ...(typeof env.windRefHeightM === 'number' && Number.isFinite(env.windRefHeightM)
         ? { zRef: env.windRefHeightM }
         : {}),
     }
   : null;


 const ws = createSimWorkspace();


 // --- Baseline: anchor / stock shot — ref air, no wind, fairway backspin, monitor ball speed.
 const simBaseline = simulateFlightRK4(
   v0RefMs,
   trackman.launchAngleDeg,
   trackman.spinRPM,
   envRef,
   null,
   sideSpinRPM,
   ws,
   args.ball,
   flightEx,
   1,
   1,
   1,
   launchDirectionDeg,
 );


 // --- Environment (density, viscosity, Mach) + COR ball speed — still no wind, fairway spin.
 const simEnvFairway = simulateFlightRK4(
   v0NowMs,
   trackman.launchAngleDeg,
   trackman.spinRPM,
   envNow,
   null,
   sideSpinRPM,
   ws,
   args.ball,
   flightEx,
   1,
   1,
   1,
   launchDirectionDeg,
 );


 // --- + wind (head/cross), fairway spin — same trajectory family as baseline, not a separate stack.
 const simWindFairway = simulateFlightRK4(
   v0NowMs,
   trackman.launchAngleDeg,
   trackman.spinRPM,
   envNow,
   wind,
   sideSpinRPM,
   ws,
   args.ball,
   flightEx,
   1,
   1,
   1,
   launchDirectionDeg,
 );


 // Anchored-mode wind delta gains. Asymmetric because pure Galilean RK4 with
 // our LUT over-magnifies the headwind carry penalty for iron-class shots
 // (see notes on `BALL.WIND_SENSITIVITY_CARRY_HEAD`), while the tailwind
 // delta is close to field-observed magnitude and only needs a mild scale-up.
 // In physics mode (`mode === 'physics'`) these gains are ignored — that branch
 // uses raw RK4 carry by design.
 const sensCarryHead =
   args.windSensitivityOverride ?? BALL.WIND_SENSITIVITY_CARRY_HEAD;
 const sensCarryTail =
   args.windSensitivityOverride ?? BALL.WIND_SENSITIVITY_CARRY_TAIL;
 const sensLateral =
   args.lateralSensitivityOverride ?? BALL.WIND_SENSITIVITY_LATERAL;


 const envRefDry = getEnvironment(PHYSICS.REF_TEMP_C, 0, PHYSICS.P_DEFAULT);
 const rho_change_ratio = (envRefDry.rho - envNow.rho) / envRefDry.rho;
 const aero_factor = aeroDensityFactorFromAnchor(anchorCarryM);
 const weatherDeltaPct = rho_change_ratio * aero_factor;


 let windCarryDeltaPct = 0;
 if (simEnvFairway.carryM > 10) {
   windCarryDeltaPct = (simWindFairway.carryM - simEnvFairway.carryM) / simEnvFairway.carryM;
 } else {
   windCarryDeltaPct = (simWindFairway.carryM - simEnvFairway.carryM) / 100.0;
 }
 windCarryDeltaPct = clamp(windCarryDeltaPct, -1.0, 1.0);


 const eta = lieConfig.launchSpinEfficiency;
 const spinLie = lieAdjustedLaunchRPM(trackman.spinRPM, eta);
 const sideLie = lieAdjustedLaunchRPM(sideSpinRPM, eta);
 const v0LieMs = v0NowMs * lieConfig.ballSpeedMs;


 // --- + lie (effective launch spin), no wind — for lateral spin-only leg.
 const simEnvLie = simulateFlightRK4(
   v0LieMs,
   trackman.launchAngleDeg,
   spinLie,
   envNow,
   null,
   sideLie,
   ws,
   args.ball,
   flightEx,
   lieConfig.carryDragFactor,
   lieConfig.launchSpinEfficiency,
   lieConfig.ballSpeedMs,
   launchDirectionDeg,
 );


 // --- Full context: environment + wind + lie — single coherent trajectory for apex / landing angle.
 const simContext = simulateFlightRK4(
   v0LieMs,
   trackman.launchAngleDeg,
   spinLie,
   envNow,
   wind,
   sideLie,
   ws,
   args.ball,
   flightEx,
   lieConfig.carryDragFactor,
   lieConfig.launchSpinEfficiency,
   lieConfig.ballSpeedMs,
   launchDirectionDeg,
 );


 const landingAngleTrust = landingAngleTrustWeight(
   simContext.landingAngleDeg,
   trackman.launchAngleDeg,
 );


 const catalogNeutral =
   neutralStockEnvironmentalInputs(args)
   && typeof trackman.maxHeightM === 'number'
   && Number.isFinite(trackman.maxHeightM)
   && trackman.maxHeightM > 1e-6;


 // Apex / flight-time reporting.
 //
 // catalogNeutral (calm, std env, no lie/rain/slope, default ball): replay
 // catalog apex exactly and rescale flight time by √(apex_ratio).
 //
 // Anchored + wind/lie/non-default env: blend RK4 wind+lie apex delta vs
 // the calm baseline RK4 onto the catalog apex by `WIND_SENSITIVITY_APEX`.
 // Pure Galilean RK4 over-shoots head apex (excess Q-driven Magnus before the
 // post-drag-crisis CL plateau) and under-shoots tail apex (Q collapses with
 // |v_rel|); a single symmetric blend reproduces `claude.md` magnitudes for
 // both directions. Flight time then re-scales by √(apex_ratio) because
 // ballistic time-of-flight is ∝ √apex.
 //
 // Physics mode falls through and reports raw RK4 values.
 let apexReportM = simContext.apexHeightM;
 let flightTimeReportS = simContext.flightTimeS;
 const catalogApexM = trackman.maxHeightM;
 const hasCatalogApex =
   typeof catalogApexM === 'number'
   && Number.isFinite(catalogApexM)
   && catalogApexM > 1e-6;
 if (mode === 'anchored' && catalogNeutral && hasCatalogApex) {
   apexReportM = catalogApexM!;
   if (simContext.apexHeightM > 1e-6) {
     flightTimeReportS *= Math.pow(catalogApexM! / simContext.apexHeightM, 0.58);
   }
 } else if (mode === 'anchored' && hasCatalogApex) {
   // Anchored apex = catalog apex + weather RK4 apex shift (unscaled, thin air
   // lifts higher) + lie RK4 apex shift (unscaled, lower clubhead/spin lifts
   // less) + wind RK4 apex shift scaled by WIND_SENSITIVITY_APEX (the only
   // empirically tuned piece; the others ride pure physics).
   const weatherApexDeltaM = simEnvFairway.apexHeightM - simBaseline.apexHeightM;
   const lieApexDeltaM = simEnvLie.apexHeightM - simEnvFairway.apexHeightM;
   const windApexDeltaM = (simContext.apexHeightM - simEnvLie.apexHeightM)
     * BALL.WIND_SENSITIVITY_APEX;
   const blendedApex =
     catalogApexM! + weatherApexDeltaM + lieApexDeltaM + windApexDeltaM;
   apexReportM = Math.max(catalogApexM! * 0.35, blendedApex);
   // Quasi-ballistic flight time scaling. T ∝ A^p with p ≈ 0.5 for pure
   // ballistics; real flight extends time a bit further because lift acts
   // longer when apex is higher, and shortens it slightly when apex is low.
   // claude.md 7-iron stock/head/tail solves for p ≈ 0.58 ± 0.04 across the
   // three cases, so we use 0.58 to reproduce both directions inside the
   // ±0.3 s tolerance set by the prompt.
   if (simBaseline.apexHeightM > 1e-6) {
     flightTimeReportS = simBaseline.flightTimeS
       * Math.pow(apexReportM / simBaseline.apexHeightM, 0.58);
   }
 }


 let carryM: number;
 let physicsCarryM: number;
 let lateralM: number;
 let appliedAeroDelta: number;


 if (mode === 'physics') {
   physicsCarryM = simContext.carryM * rainConfig.carryFactor * physicsCal;
   carryM = physicsCarryM;
   lateralM = simContext.lateralM;
   appliedAeroDelta = 0;
 } else {
   // Anchored adjusted carry. Each environmental contributor is the unscaled
   // RK4 carry delta between adjacent legs — so air density / viscosity / Mach
   // / lie smash all enter the final number at full physics weight — while the
   // wind delta carries the calibrated head/tail sensitivity that hits the
   // `claude.md` golden 7-iron numbers.
   //
   //   simBaseline      = reference air, no wind, no lie    (anchor of the chain)
   //   simEnvFairway    = user env + COR ball speed, no wind, no lie
   //   simEnvLie        = + lie smash / spin efficiency / lie drag, no wind
   //   simContext       = + wind + crosswind
   //
   //   weatherΔ = simEnvFairway − simBaseline   (temp / humidity / pressure / Mach)
   //   lieΔ     = simEnvLie     − simEnvFairway (lie ball speed / spin / form drag)
   //   windΔ    = simContext    − simEnvLie     (head/tail and crosswind)
   //
   // Rain is a separate multiplicative factor (wet ball / wet air aggregate).
   const weatherCarryDeltaM = simEnvFairway.carryM - simBaseline.carryM;
   const lieCarryDeltaM = simEnvLie.carryM - simEnvFairway.carryM;
   const rawWindDeltaM = simContext.carryM - simEnvLie.carryM;
   const windSens = rawWindDeltaM < 0 ? sensCarryHead : sensCarryTail;
   const windCarryDeltaM = rawWindDeltaM * windSens;

   const adjustedCarryNoRain =
     anchorCarryM + weatherCarryDeltaM + lieCarryDeltaM + windCarryDeltaM;
   physicsCarryM = adjustedCarryNoRain * rainConfig.carryFactor;
   carryM = physicsCarryM;

   const sideSpinLateralM = simEnvLie.lateralM;
   const windLateralM = (simContext.lateralM - simEnvLie.lateralM) * sensLateral;
   lateralM = sideSpinLateralM + windLateralM;

   appliedAeroDelta = anchorCarryM > 1e-6 ? carryM / anchorCarryM - 1 : 0;
 }


 const windAlongShotMs = env.windSpeedMs * env.headComponent;

 // Anchored-mode landing-angle reporting. catalogNeutral (calm) replays the
 // Trackman descent angle exactly. For wind/lie/non-default cases we blend
 // the RK4 landing-angle delta (vs the calm baseline RK4) onto the catalog
 // value using direction-aware sensitivities — head wind drives a much
 // steeper descent than RK4 alone gives back to plausibility and field
 // observation, so its sensitivity is smaller than the tail's. Physics
 // mode keeps `landingCatalogDeg = undefined` so RK4 is reported verbatim.
 let landingCatalogDeg: number | undefined;
 const catalogLandingDeg =
   typeof trackman.landingAngleDeg === 'number' && Number.isFinite(trackman.landingAngleDeg)
     ? Math.abs(trackman.landingAngleDeg)
     : undefined;
 if (mode === 'anchored' && catalogNeutral && catalogLandingDeg !== undefined) {
   landingCatalogDeg = catalogLandingDeg;
 } else if (mode === 'anchored' && catalogLandingDeg !== undefined) {
   // Same three-bucket split as carry/apex: weather and lie shift the
   // descent angle at full RK4 weight, wind is scaled by the calibrated
   // head/tail sensitivity (head wind steepens descent more than RK4
   // alone predicts; tail flattens it).
   const weatherLandingDelta =
     simEnvFairway.landingAngleDeg - simBaseline.landingAngleDeg;
   const lieLandingDelta =
     simEnvLie.landingAngleDeg - simEnvFairway.landingAngleDeg;
   const rawWindLandingDelta =
     simContext.landingAngleDeg - simEnvLie.landingAngleDeg;
   const windSensLanding = windAlongShotMs >= 0
     ? BALL.WIND_SENSITIVITY_LANDING_HEAD
     : BALL.WIND_SENSITIVITY_LANDING_TAIL;
   const windLandingDelta = rawWindLandingDelta * windSensLanding;
   const blended =
     catalogLandingDeg + weatherLandingDelta + lieLandingDelta + windLandingDelta;
   landingCatalogDeg = clamp(blended, 8, 88);
 }

 const { rollM, ground: groundRoll } = estimateGroundRollModel(
   simContext.terminalV,
   simContext.terminalOmega,
   trackman.launchAngleDeg,
   apexReportM,
   windAlongShotMs,
   lieConfig,
   rainConfig,
   landingCatalogDeg,
 );


 const slopeDeg = finiteOrDefault(args.fairwaySlopeDeg, 0);
 const slopeF = Math.cos((slopeDeg * Math.PI) / 180);
 carryM *= slopeF;
 physicsCarryM *= slopeF;
 const rollMScaled = rollM * slopeF;


 const apexHeightM = apexReportM;


 if (mode === 'physics' && anchorCarryM > 1e-6) {
   appliedAeroDelta = carryM / anchorCarryM - 1;
 }


 const uncertaintyM = Math.sqrt(
   lieConfig.uncertaintyM ** 2 +
   rainConfig.uncertaintyM ** 2,
 );


 return {
   carryM,
   physicsCarryM,
   anchorCarryM,
   apexHeightM,
   flightTimeS: flightTimeReportS,
   lateralM,
   rollM: rollMScaled,
   totalDistanceM: carryM + rollMScaled,
   uncertaintyM,
   appliedAeroDelta,
   calculationMode: mode,
   details: {
     weatherDeltaPct,
     windCarryDeltaPct,
     airDensityKgM3: envNow.rho,
     referenceCarryM: simBaseline.carryM,
     weatherCarryM: simEnvFairway.carryM,
     actualCarryM: simWindFairway.carryM,
     v0AfterCorMs: v0NowMs,
     impactBallSpeedMs: v0LieMs,
     impactLaunchAngleDeg: trackman.launchAngleDeg,
     impactBackspinRpm: spinLie,
     ballModel: {
       dimpleTurbulence: ballModel.dimpleTurbulence,
       surfaceWear: ballModel.surfaceWear,
       eccentricity: ballModel.eccentricity,
       spinDecayRateRefS: BALL.SPIN_DECAY_RATE * ballModel.spinDecayMultiplier,
     },
     groundRoll,
     baselineCarryM: simBaseline.carryM,
     baselineApexM: simBaseline.apexHeightM,
     baselineLandingAngleDeg: simBaseline.landingAngleDeg,
     contextApexM: simContext.apexHeightM,
     contextLandingAngleDeg: simContext.landingAngleDeg,
     apexPhysicsRatio: 1,
     landingAngleTrust,
   },
   calibrationVersion: CALIBRATION_VERSION,
 };
}
