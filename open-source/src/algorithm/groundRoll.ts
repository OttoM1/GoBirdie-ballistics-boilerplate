'use strict';

import type { LieConfig } from './lie';
import { clamp, smoothstep01 } from './math';
import { BALL, ROLL_K } from './physicsConstants';
import type { RainConfig } from './rain';
import type { GroundRollDetail, GroundRollRegime } from './shotModel';

const GROUND_CHI_REF = 0.72;
const GROUND_WIND_ROLL_K = 0.036;
const GROUND_SPIN_BACK_SCALE = 3.15;

export function estimateGroundRollModel(
  terminalV: readonly [number, number, number],
  terminalOmega: readonly [number, number, number],
  launchAngleDeg: number,
  apexHeightM: number,
  windAlongShotMs: number,
  lieConfig: LieConfig,
  rainConfig: RainConfig,
  /** When set (neutral catalogue shot), use Trackman-listed descent angle ° for kinematic roll fractions. */
  landingAngleDegCatalog?: number,
): { rollM: number; ground: GroundRollDetail } {
  const vx = terminalV[0];
  const vy = terminalV[1];
  const vz = terminalV[2];
  const u = Math.hypot(Math.max(vx, 0), vz);
  const thetaPhysics = Math.atan2(Math.abs(vy), Math.max(u, 1e-3));
  const theta =
    landingAngleDegCatalog !== undefined && Number.isFinite(landingAngleDegCatalog)
      ? Math.max(
        1e-4,
        Math.min(Math.PI / 2 - 1e-4, (Math.abs(landingAngleDegCatalog) * Math.PI) / 180),
      )
      : thetaPhysics;
  const forwardFraction = 1 - Math.sin(theta);

  const wz = terminalOmega[2];
  const backspinRpmLanding = (wz * 30) / Math.PI;
  const chi = wz > 0.04 && u > 0.04 ? (wz * BALL.radius) / u : 0;

  const windAlong = windAlongShotMs;
  const windAtten = clamp(
    Math.exp(-GROUND_WIND_ROLL_K * windAlong),
    0.52,
    1.14,
  );

  // High backspin should strongly suppress forward roll.
  const chiNorm = smoothstep01(chi / GROUND_CHI_REF);
  const spinRollBrake = clamp(1 - 0.62 * chiNorm, 0.12, 1);
  const rollNom = ROLL_K * Math.max(u, 0) * forwardFraction
    * lieConfig.rollFactor * rainConfig.rollFactor * windAtten * spinRollBrake;

  const launchRad = (launchAngleDeg * Math.PI) / 180;
  const launchSteep = Math.max(0, Math.sin(launchRad));
  const apexNorm = clamp(apexHeightM / 24, 0, 1.85);
  const apexFactor = 1 + 0.065 * apexNorm;
  const launchFactor = 1 + 0.24 * launchSteep;

  const steepNorm = Math.pow(Math.sin(theta), 1.1);

  let checkFraction = lieConfig.spinCheckCoupling * apexFactor * launchFactor
    * (0.52 * chiNorm + 0.48 * steepNorm);
  checkFraction = clamp(checkFraction, 0, 0.88);

  const rollAfterCheck = rollNom * (1 - checkFraction);

  const firmness = clamp(lieConfig.rollFactor * 1.12, 0, 1);
  const spinBackGate = smoothstep01((chi - 0.60) / 0.50)
    * Math.pow(Math.sin(theta), 1.22)
    * firmness
    * (0.52 + 0.48 * rainConfig.rollFactor);

  const spinBackM = -GROUND_SPIN_BACK_SCALE
    * lieConfig.spinBackCoupling
    * spinBackGate;

  let rollM = rollAfterCheck + spinBackM;
  if (rollM < -2.8) rollM = -2.8;

  if (backspinRpmLanding > 9000 && rollM > 1.5) rollM = 1.5;

  let regime: GroundRollRegime = 'forward_release';
  if (spinBackM < -0.32 && chi > 0.82) regime = 'spin_back';
  else if (checkFraction > 0.36 || chi > 0.74) regime = 'checked';

  return {
    rollM,
    ground: {
      regime,
      backspinRpmLanding,
      landingAngleDeg:
        landingAngleDegCatalog !== undefined && Number.isFinite(landingAngleDegCatalog)
          ? Math.abs(landingAngleDegCatalog)
          : (thetaPhysics * 180) / Math.PI,
      spinSpeedRatio: chi,
      checkFraction,
      spinBackM,
      windAlongShotMs: windAlong,
      nominalRollM: rollNom,
    },
  };
}
