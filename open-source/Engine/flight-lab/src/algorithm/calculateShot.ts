// NOTE:
//  physics mode only, anchored carry blending is not published

'use strict';

import { landingAngleTrustWeight } from './flightConstraints';
import {
  getEnvironment,
} from './environment';
import type { FlightSimExtras } from './flightTypes';
import { estimateGroundRollModel } from './groundRoll';
import { lieAdjustedLaunchRPM, LIE_CONFIG } from './lie';
import { finiteOrDefault } from './math';
import { BALL, CALIBRATION_VERSION, PHYSICS } from './physicsConstants';
import type { RainType } from './rain';
import { RAIN_CONFIG } from './rain';
import {
  createSimWorkspace,
  simulateFlightRK4,
} from './rk4Flight';
import type { ShotCalculationMode, ShotInputs, ShotResult } from './shotModel';

export function calculateShot(args: ShotInputs): ShotResult {
  const mode: ShotCalculationMode = args.mode === 'physics' ? 'physics' : 'anchored';

  if (mode === 'anchored') {
    throw new Error(
      'anchored mode is not available in the public release — use mode: "physics"',
    );
  }

  const { anchorCarryM, trackman, env } = args;
  const physicsCal = finiteOrDefault(args.physicsCarryCalibration, 1);
  const pressurePa = env.pressurePa ?? PHYSICS.P_DEFAULT;
  const lieKey = args.lie ?? '';
  const rainKey = (args.rain ?? 'none') as RainType;
  const lieConfig = LIE_CONFIG[lieKey];
  const rainConfig = RAIN_CONFIG[rainKey];
  const sideSpinRPM = trackman.sideSpinRPM ?? 0;
  const launchDirectionDeg = trackman.launchDirectionDeg ?? 0;
  const flightEx: FlightSimExtras | undefined =
    typeof args.landingGroundYM === 'number' && Number.isFinite(args.landingGroundYM)
      ? { groundYM: args.landingGroundYM }
      : undefined;

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

  const eta = lieConfig.launchSpinEfficiency;
  const spinLie = lieAdjustedLaunchRPM(trackman.spinRPM, eta);
  const sideLie = lieAdjustedLaunchRPM(sideSpinRPM, eta);
  const v0LieMs = v0NowMs * lieConfig.ballSpeedMs;

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

  let carryM = simContext.carryM * rainConfig.carryFactor * physicsCal;
  let physicsCarryM = carryM;
  const lateralM = simContext.lateralM;
  let appliedAeroDelta = 0;

  const windAlongShotMs = env.windSpeedMs * env.headComponent;

  const { rollM, ground: groundRoll } = estimateGroundRollModel(
    simContext.terminalV,
    simContext.terminalOmega,
    trackman.launchAngleDeg,
    simContext.apexHeightM,
    windAlongShotMs,
    lieConfig,
    rainConfig,
    undefined,
  );

  const slopeDeg = finiteOrDefault(args.fairwaySlopeDeg, 0);
  const slopeF = Math.cos((slopeDeg * Math.PI) / 180);
  carryM *= slopeF;
  physicsCarryM *= slopeF;
  const rollMScaled = rollM * slopeF;

  if (anchorCarryM > 1e-6) {
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
    apexHeightM: simContext.apexHeightM,
    flightTimeS: simContext.flightTimeS,
    lateralM,
    rollM: rollMScaled,
    totalDistanceM: carryM + rollMScaled,
    uncertaintyM,
    appliedAeroDelta,
    calculationMode: mode,
    details: {
      weatherDeltaPct: 0,
      windCarryDeltaPct: 0,
      airDensityKgM3: envNow.rho,
      referenceCarryM: simContext.carryM,
      weatherCarryM: simContext.carryM,
      actualCarryM: simContext.carryM,
      v0AfterCorMs: v0NowMs,
      impactBallSpeedMs: v0LieMs,
      impactLaunchAngleDeg: trackman.launchAngleDeg,
      impactBackspinRpm: spinLie,
      ballModel: {
        dimpleTurbulence: finiteOrDefault(args.ball?.dimpleTurbulence, 1),
        surfaceWear: finiteOrDefault(args.ball?.surfaceWear, 0),
        eccentricity: finiteOrDefault(args.ball?.eccentricity, 0),
        spinDecayRateRefS: BALL.SPIN_DECAY_RATE,
      },
      groundRoll,
      baselineCarryM: simContext.carryM,
      baselineApexM: simContext.apexHeightM,
      baselineLandingAngleDeg: simContext.landingAngleDeg,
      contextApexM: simContext.apexHeightM,
      contextLandingAngleDeg: simContext.landingAngleDeg,
      apexPhysicsRatio: 1,
      landingAngleTrust,
    },
    calibrationVersion: CALIBRATION_VERSION,
  };
}
