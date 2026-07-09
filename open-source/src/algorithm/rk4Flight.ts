'use strict';

import { aeroCoefficientsFromLut } from './aeroTable';
import type { AirState, BallFlightCondition, ResolvedBallFlightCondition } from './environment';
import { resolveBallFlightCondition } from './environment';
import type {
  FlightSimExtras,
  FlightResult,
  FlightPathPoint,
  SampledFlightPath,
  FlightTracePoint,
  SampledFlightTrace,
  SimWorkspace,
  WindParams,
} from './flightTypes';
import { clamp } from './math';
import { BALL, BALL_SURFACE, PHYSICS, WIND_LOG_LAW } from './physicsConstants';

const I_X = 0 as const;
const I_Y = 1 as const;
const I_Z = 2 as const;
const I_VX = 3 as const;
const I_VY = 4 as const;
const I_VZ = 5 as const;
const I_WX = 6 as const;
const I_WY = 7 as const;
const I_WZ = 8 as const;
const STATE_DIM = 9 as const;

// High-|v_rel| CL ceiling. Real golf-ball lift coefficients do not climb
// indefinitely with airspeed; once the dimpled boundary layer is fully
// turbulent (Re ≳ 200k) measured CL plateaus, then drops slightly. Our LUT
// only captures the climb, so this cap stands in for the post-drag-crisis
// CL ceiling. Onset is set at typical iron impact ball-speed (≈ 55 m/s),
// fully active by ≈ 80 m/s (driver impact / strong headwind regime). Tighter
// MAX/MIN than v22 to keep iron headwind balloons in the claude.md band.
const CL_CAP_V_ONSET_MS = 55;
const CL_CAP_V_FULL_MS = 80;
const CL_CAP_MAX = 0.28;
const CL_CAP_MIN = 0.16;
/** Minimum CL multiplier at negligible relative airspeed (stall blend → 0). */
const CL_STALL_FLOOR = 0.2;

function initLaunchState(
  y: Float64Array,
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  sideSpinRPM: number,
  launchDirectionDeg: number = 0,
): void {
  const launchRad = (launchDeg * Math.PI) / 180;
  const dirRad = (launchDirectionDeg * Math.PI) / 180;
  const omegaZ = (backspinRPM * Math.PI) / 30;
  const omegaY = (sideSpinRPM * Math.PI) / 30;
  const vHoriz = v0Ms * Math.cos(launchRad);
  y[I_X] = 0;
  y[I_Y] = 0;
  y[I_Z] = 0;
  y[I_VX] = vHoriz * Math.cos(dirRad);
  y[I_VY] = v0Ms * Math.sin(launchRad);
  y[I_VZ] = vHoriz * Math.sin(dirRad);
  y[I_WX] = 0;
  y[I_WY] = omegaY;
  y[I_WZ] = omegaZ;
}

/** Anchor fit: amplify CL near typical mid/short iron S (smooth half-sine in [lo, hi]). */
function trackmanIronSpinBandClMultiplier(S: number, peakDelta: number): number {
  const lo = BALL.IRON_CL_BOOST_S_LO;
  const hi = BALL.IRON_CL_BOOST_S_HI;
  if (S <= lo || S >= hi) return 1;
  const bell = Math.sin((Math.PI * (S - lo)) / (hi - lo));
  return 1 + peakDelta * bell;
}

function computeDerivatives(
  y: Float64Array,
  out: Float64Array,
  env: AirState,
  wind: WindParams | null,
  ball: ResolvedBallFlightCondition,
  carryDragFactor: number = 1,
): void {
  const ry = y[I_Y];
  const vx = y[I_VX], vy = y[I_VY], vz = y[I_VZ];
  const wx = y[I_WX], wy = y[I_WY], wz = y[I_WZ];

  let wxs = 0;
  let wzs = 0;
  if (wind) {
    const z0 = wind.z0 ?? WIND_LOG_LAW.z0;
    const zRef = wind.zRef ?? WIND_LOG_LAW.zRef;
    const zLo = z0 + 0.01;
    const z_above = ry > zLo ? ry : zLo;
    const scale = Math.min(1, Math.log(z_above / z0) / Math.log(zRef / z0));
    wxs = wind.wind_x * scale;
    wzs = wind.wind_z * scale;
  }

  const vrx = vx - wxs;
  const vry = vy;
  const vrz = vz - wzs;
  const vMag = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);

  out[I_X] = vx;
  out[I_Y] = vy;
  out[I_Z] = vz;

  const vRef = 45;
  const vFrictionScale = Math.pow(Math.max(vMag, 5) / vRef, 1.2);
  const k = BALL.SPIN_DECAY_RATE * ball.spinDecayMultiplier * vFrictionScale;
  out[I_WX] = -k * wx;
  out[I_WY] = -k * wy;
  out[I_WZ] = -k * wz;

  if (vMag < 0.2) {
    out[I_VX] = 0;
    out[I_VY] = -PHYSICS.G;
    out[I_VZ] = 0;
    return;
  }

  const wMag = Math.sqrt(wx * wx + wy * wy + wz * wz);
  const vMagForS = Math.max(vMag, BALL.VREL_SPIN_FLOOR_MS);
  const sRaw = wMag > 0 ? (wMag * BALL.radius) / vMagForS : 0;
  const S = sRaw > BALL.S_MAX ? BALL.S_MAX : sRaw;

  const Re = clamp(
    (env.rho * vMag * BALL.diameter) / env.mu,
    BALL_SURFACE.RE_MIN,
    BALL_SURFACE.RE_MAX,
  );

  let { CD, CL } = aeroCoefficientsFromLut(Re, S, ball.lutClMultiplier, ball.lutCdMultiplier);

  const stallBlend = 1 - Math.exp(-Math.pow(vMag / BALL.STALL_VELOCITY, 2));
  CL *= CL_STALL_FLOOR + (1 - CL_STALL_FLOOR) * stallBlend;

  const reLog = Math.log(Re / BALL_SURFACE.RE_REF);
  const reBlend = Math.tanh(1.25 * reLog);
  const dimpleLoss = 1 - ball.dimpleTurbulence;
  const cdMult = 1
    - 0.06 * ball.dimpleTurbulence * reBlend
    + 0.12 * dimpleLoss
    + 0.10 * ball.surfaceWear
    + 0.04 * ball.eccentricity;
  const clMult = 1
    + 0.04 * ball.dimpleTurbulence * reBlend
    - 0.15 * dimpleLoss
    - 0.08 * ball.surfaceWear;

  CD = Math.max(
    0.2,
    CD * cdMult * carryDragFactor * ball.baselineCdCalibrationScale,
  );
  if (CD > 0.85) CD = 0.85;
  CL = Math.max(0, CL * clMult);
  CL *= trackmanIronSpinBandClMultiplier(S, ball.ironBandClBoostMaxDelta);

  if (CL > 0) {
    const t = clamp(
      (vMag - CL_CAP_V_ONSET_MS) / Math.max(CL_CAP_V_FULL_MS - CL_CAP_V_ONSET_MS, 1e-3),
      0,
      1,
    );
    const clCap = CL_CAP_MAX + (CL_CAP_MIN - CL_CAP_MAX) * t;
    if (CL > clCap) CL = clCap;
  }

  const cSound = env.soundSpeedMs;
  if (cSound > 1 && vMag > 1) {
    const mach = vMag / cSound;
    const dm = Math.max(0, mach - BALL.MACH_DRAG_ONSET);
    const cdMach = 1 + BALL.MACH_DRAG_COEFF * dm * dm;
    CD *= Math.min(cdMach, 1.28);
  }

  const qA = 0.5 * env.rho * vMag * vMag * BALL.area;
  const invMag = 1 / vMag;

  const fdx = -qA * CD * vrx * invMag;
  const fdy = -qA * CD * vry * invMag;
  const fdz = -qA * CD * vrz * invMag;

  const cx = wy * vrz - wz * vry;
  const cy = wz * vrx - wx * vrz;
  const cz = wx * vry - wy * vrx;
  const c2 = cx * cx + cy * cy + cz * cz;
  const cMag = c2 > 0 ? Math.sqrt(c2) : 1;
  const fmx = qA * CL * cx / cMag;
  const fmy = qA * CL * cy / cMag;
  const fmz = qA * CL * cz / cMag;

  const fEcc = qA * ball.eccentricForceCoeff;
  const fey = fEcc * Math.sin(ball.eccentricityAxisRad);
  const fez = fEcc * Math.cos(ball.eccentricityAxisRad);

  const invM = 1 / BALL.mass;
  out[I_VX] = (fdx + fmx) * invM;
  out[I_VY] = (fdy + fmy + fey) * invM - PHYSICS.G;
  out[I_VZ] = (fdz + fmz + fez) * invM;

  // Forward-progress invariant (claudePrompt.md §3): a struck ball must not
  // attain a negative ground-frame velocity component along its direction of
  // travel purely from wind drag. Pure Galilean RK4 will assert v → wind
  // asymptotically; in finite-time integration, this can numerically push vx
  // through zero in extreme headwinds. The guard kicks in only near the
  // crossing (vx > 0 already decaying, wind opposing) and tapers the negative
  // acceleration smoothly toward zero. It never *adds* forward acceleration
  // and never affects calm or tailwind shots. The lateral (z) axis is left
  // alone — crosswind lateral drift may legitimately reverse sign relative to
  // a side-spin-driven launch.
  if (wind && vx > 0 && wxs < 0 && out[I_VX] < 0) {
    const decelFloor = -vx * 5; // soft asymptote: vx halves in ~0.1 s near zero
    if (out[I_VX] < decelFloor) out[I_VX] = decelFloor;
  }
}

function rk4Step(
  ws: SimWorkspace,
  dt: number,
  env: AirState,
  wind: WindParams | null,
  ball: ResolvedBallFlightCondition,
  carryDragFactor: number = 1,
): void {
  const { y, yTmp, k1, k2, k3, k4 } = ws;
  const halfDt = 0.5 * dt;

  computeDerivatives(y, k1, env, wind, ball, carryDragFactor);
  for (let j = 0; j < STATE_DIM; j++) yTmp[j] = y[j] + halfDt * k1[j];

  computeDerivatives(yTmp, k2, env, wind, ball, carryDragFactor);
  for (let j = 0; j < STATE_DIM; j++) yTmp[j] = y[j] + halfDt * k2[j];

  computeDerivatives(yTmp, k3, env, wind, ball, carryDragFactor);
  for (let j = 0; j < STATE_DIM; j++) yTmp[j] = y[j] + dt * k3[j];

  computeDerivatives(yTmp, k4, env, wind, ball, carryDragFactor);

  const c = dt / 6;
  for (let j = 0; j < STATE_DIM; j++) {
    y[j] += c * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
  }
}

function hermite(
  p0: number, p1: number, m0: number, m1: number, dt: number, tau: number,
): number {
  const tau2 = tau * tau;
  const tau3 = tau2 * tau;
  const h00 = 2 * tau3 - 3 * tau2 + 1;
  const h10 = tau3 - 2 * tau2 + tau;
  const h01 = -2 * tau3 + 3 * tau2;
  const h11 = tau3 - tau2;
  return h00 * p0 + h10 * dt * m0 + h01 * p1 + h11 * dt * m1;
}

function bisectHermiteTarget(
  p0: number,
  p1: number,
  m0: number,
  m1: number,
  dt: number,
  target: number,
): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < PHYSICS.EVENT_BISECT_ITERS; i++) {
    const mid = 0.5 * (lo + hi);
    const pMid = hermite(p0, p1, m0, m1, dt, mid);
    if (pMid > target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function bisectGroundCrossing(
  y0: number, y1: number, vy0: number, vy1: number, dt: number,
  targetY: number,
): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < PHYSICS.EVENT_BISECT_ITERS; i++) {
    const mid = 0.5 * (lo + hi);
    const yMid = hermite(y0, y1, vy0, vy1, dt, mid);
    if (yMid > targetY) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function createSimWorkspace(): SimWorkspace {
  return {
    y: new Float64Array(STATE_DIM),
    yTmp: new Float64Array(STATE_DIM),
    k1: new Float64Array(STATE_DIM),
    k2: new Float64Array(STATE_DIM),
    k3: new Float64Array(STATE_DIM),
    k4: new Float64Array(STATE_DIM),
    yStart: new Float64Array(STATE_DIM),
    k1Start: new Float64Array(STATE_DIM),
    k1End: new Float64Array(STATE_DIM),
  };
}

export function simulateFlightRK4(
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  env: AirState,
  wind: WindParams | null,
  sideSpinRPM: number = 0,
  ws: SimWorkspace = createSimWorkspace(),
  ballCondition?: BallFlightCondition,
  flightExtras?: FlightSimExtras,
  /** Lie-specific form-drag multiplier on CD (see `LIE_CONFIG.carryDragFactor`). */
  carryDragFactor: number = 1,
  /**
   * Launch spin efficiency and lie ball-speed factor are already applied to
   * `backspinRPM` / `v0Ms` in `calculateShot`; these parameters keep the
   * call signature aligned and reserve room for future in-flight coupling.
   */
  _lieLaunchSpinEfficiency: number = 1,
  _lieBallSpeedMs: number = 1,
  launchDirectionDeg: number = 0,
): FlightResult {
  void _lieLaunchSpinEfficiency;
  void _lieBallSpeedMs;

  const { y, yStart, k1, k1Start, k1End } = ws;
  const ball = resolveBallFlightCondition(ballCondition);
  const groundYM = flightExtras?.groundYM ?? 0;
  const maxFlightTimeS = flightExtras?.maxFlightTimeS ?? Number.POSITIVE_INFINITY;

  initLaunchState(y, v0Ms, launchDeg, backspinRPM, sideSpinRPM, launchDirectionDeg);

  const dt = PHYSICS.DT;
  let t = 0;
  let apex = 0;
  let apexX = 0;

  for (let step = 0; step < PHYSICS.MAX_STEPS; step++) {
    yStart.set(y);

    rk4Step(ws, dt, env, wind, ball, carryDragFactor);
    k1Start.set(k1);

    if (y[I_Y] > apex) {
      apex = y[I_Y];
      apexX = y[I_X];
    }

    // Refine apex location when vertical velocity crosses zero.
    if (yStart[I_VY] > 0 && y[I_VY] <= 0) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tauApex = bisectHermiteTarget(
        yStart[I_VY],
        y[I_VY],
        k1Start[I_VY],
        k1End[I_VY],
        dt,
        0,
      );
      const yApex = hermite(yStart[I_Y], y[I_Y], k1Start[I_Y], k1End[I_Y], dt, tauApex);
      const xApex = hermite(yStart[I_X], y[I_X], k1Start[I_X], k1End[I_X], dt, tauApex);
      if (yApex > apex) {
        apex = yApex;
        apexX = xApex;
      }
    }

    if (
      y[I_Y] <= groundYM
      && yStart[I_Y] >= groundYM
      && y[I_Y] < yStart[I_Y]
    ) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tau = bisectGroundCrossing(
        yStart[I_Y], y[I_Y], k1Start[I_Y], k1End[I_Y], dt, groundYM,
      );

      const carry = hermite(yStart[I_X], y[I_X], k1Start[I_X], k1End[I_X], dt, tau);
      const lateral = hermite(yStart[I_Z], y[I_Z], k1Start[I_Z], k1End[I_Z], dt, tau);
      const vxL = hermite(yStart[I_VX], y[I_VX], k1Start[I_VX], k1End[I_VX], dt, tau);
      const vyL = hermite(yStart[I_VY], y[I_VY], k1Start[I_VY], k1End[I_VY], dt, tau);
      const vzL = hermite(yStart[I_VZ], y[I_VZ], k1Start[I_VZ], k1End[I_VZ], dt, tau);
      const wxL = hermite(yStart[I_WX], y[I_WX], k1Start[I_WX], k1End[I_WX], dt, tau);
      const wyL = hermite(yStart[I_WY], y[I_WY], k1Start[I_WY], k1End[I_WY], dt, tau);
      const wzL = hermite(yStart[I_WZ], y[I_WZ], k1Start[I_WZ], k1End[I_WZ], dt, tau);
      const vHorizL = Math.hypot(vxL, vzL);
      const landingAngleDeg = (Math.atan2(Math.abs(vyL), Math.max(vHorizL, 1e-3)) * 180) / Math.PI;

      return {
        carryM: carry,
        lateralM: lateral,
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: t + dt * tau,
        landingAngleDeg,
        terminalV: [vxL, vyL, vzL],
        terminalOmega: [wxL, wyL, wzL],
      };
    }

    t += dt;
    if (t >= maxFlightTimeS) {
      const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
      const landingAngleDeg =
        (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
      return {
        carryM: y[I_X],
        lateralM: y[I_Z],
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: maxFlightTimeS,
        landingAngleDeg,
        terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
        terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
      };
    }
  }

  const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
  const landingAngleDeg =
    (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
  return {
    carryM: y[I_X],
    lateralM: y[I_Z],
    apexHeightM: apex,
    apexXM: apexX,
    flightTimeS: t,
    landingAngleDeg,
    terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
    terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
  };
}

export function sampleFlightPath(
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  env: AirState,
  wind: WindParams | null,
  sideSpinRPM: number = 0,
  ballCondition?: BallFlightCondition,
  sampleStride: number = 2,
  flightExtras?: FlightSimExtras,
  carryDragFactor: number = 1,
  launchDirectionDeg: number = 0,
): SampledFlightPath {
  const ws = createSimWorkspace();
  const { y, yStart, k1, k1Start, k1End } = ws;
  const ball = resolveBallFlightCondition(ballCondition);
  const groundYM = flightExtras?.groundYM ?? 0;
  const maxFlightTimeS = flightExtras?.maxFlightTimeS ?? Number.POSITIVE_INFINITY;

  initLaunchState(y, v0Ms, launchDeg, backspinRPM, sideSpinRPM, launchDirectionDeg);

  const dt = PHYSICS.DT;
  let t = 0;
  let apex = 0;
  let apexX = 0;
  const points: FlightPathPoint[] = [{ x: 0, y: 0, z: 0, t: 0 }];
  const stride = sampleStride < 1 ? 1 : sampleStride;

  for (let step = 0; step < PHYSICS.MAX_STEPS; step++) {
    yStart.set(y);
    rk4Step(ws, dt, env, wind, ball, carryDragFactor);
    k1Start.set(k1);

    if (y[I_Y] > apex) {
      apex = y[I_Y];
      apexX = y[I_X];
    }

    if (yStart[I_VY] > 0 && y[I_VY] <= 0) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tauApex = bisectHermiteTarget(
        yStart[I_VY],
        y[I_VY],
        k1Start[I_VY],
        k1End[I_VY],
        dt,
        0,
      );
      const yApex = hermite(yStart[I_Y], y[I_Y], k1Start[I_Y], k1End[I_Y], dt, tauApex);
      const xApex = hermite(yStart[I_X], y[I_X], k1Start[I_X], k1End[I_X], dt, tauApex);
      if (yApex > apex) {
        apex = yApex;
        apexX = xApex;
      }
    }

    if (
      y[I_Y] <= groundYM
      && yStart[I_Y] >= groundYM
      && y[I_Y] < yStart[I_Y]
    ) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tau = bisectGroundCrossing(
        yStart[I_Y],
        y[I_Y],
        k1Start[I_Y],
        k1End[I_Y],
        dt,
        groundYM,
      );
      const xLand = hermite(
        yStart[I_X],
        y[I_X],
        k1Start[I_X],
        k1End[I_X],
        dt,
        tau,
      );
      const zLand = hermite(
        yStart[I_Z],
        y[I_Z],
        k1Start[I_Z],
        k1End[I_Z],
        dt,
        tau,
      );
      const vxL = hermite(
        yStart[I_VX],
        y[I_VX],
        k1Start[I_VX],
        k1End[I_VX],
        dt,
        tau,
      );
      const vyL = hermite(
        yStart[I_VY],
        y[I_VY],
        k1Start[I_VY],
        k1End[I_VY],
        dt,
        tau,
      );
      const vzL = hermite(
        yStart[I_VZ],
        y[I_VZ],
        k1Start[I_VZ],
        k1End[I_VZ],
        dt,
        tau,
      );
      const wxL = hermite(
        yStart[I_WX],
        y[I_WX],
        k1Start[I_WX],
        k1End[I_WX],
        dt,
        tau,
      );
      const wyL = hermite(
        yStart[I_WY],
        y[I_WY],
        k1Start[I_WY],
        k1End[I_WY],
        dt,
        tau,
      );
      const wzL = hermite(
        yStart[I_WZ],
        y[I_WZ],
        k1Start[I_WZ],
        k1End[I_WZ],
        dt,
        tau,
      );
      const vHorizL = Math.hypot(vxL, vzL);
      const landingAngleDeg =
        (Math.atan2(Math.abs(vyL), Math.max(vHorizL, 1e-3)) * 180) / Math.PI;
      const tLand = t + dt * tau;
      points.push({ x: xLand, y: groundYM, z: zLand, t: tLand });
      return {
        points,
        carryM: xLand,
        lateralM: zLand,
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: tLand,
        landingAngleDeg,
        terminalV: [vxL, vyL, vzL],
        terminalOmega: [wxL, wyL, wzL],
      };
    }

    t += dt;
    if (step % stride === 0) {
      points.push({ x: y[I_X], y: y[I_Y], z: y[I_Z], t });
    }
    if (t >= maxFlightTimeS) {
      points.push({ x: y[I_X], y: y[I_Y], z: y[I_Z], t: maxFlightTimeS });
      const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
      const landingAngleDeg =
        (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
      return {
        points,
        carryM: y[I_X],
        lateralM: y[I_Z],
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: maxFlightTimeS,
        landingAngleDeg,
        terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
        terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
      };
    }
  }

  points.push({ x: y[I_X], y: y[I_Y], z: y[I_Z], t });
  const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
  const landingAngleDeg =
    (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
  return {
    points,
    carryM: y[I_X],
    lateralM: y[I_Z],
    apexHeightM: apex,
    apexXM: apexX,
    flightTimeS: t,
    landingAngleDeg,
    terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
    terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
  };
}

export function sampleFlightTraceRK4(
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  env: AirState,
  wind: WindParams | null,
  sideSpinRPM: number = 0,
  ballCondition?: BallFlightCondition,
  sampleStride: number = 2,
  flightExtras?: FlightSimExtras,
  carryDragFactor: number = 1,
  launchDirectionDeg: number = 0,
): SampledFlightTrace {
  const ws = createSimWorkspace();
  const { y, yStart, k1, k1Start, k1End } = ws;
  const ball = resolveBallFlightCondition(ballCondition);
  const groundYM = flightExtras?.groundYM ?? 0;
  const maxFlightTimeS = flightExtras?.maxFlightTimeS ?? Number.POSITIVE_INFINITY;

  initLaunchState(y, v0Ms, launchDeg, backspinRPM, sideSpinRPM, launchDirectionDeg);

  const dt = PHYSICS.DT;
  let t = 0;
  let apex = 0;
  let apexX = 0;
  const points: FlightTracePoint[] = [];
  const stride = sampleStride < 1 ? 1 : sampleStride;

  const windAtY = (ry: number): { wxs: number; wzs: number } => {
    if (!wind) return { wxs: 0, wzs: 0 };
    const z0 = wind.z0 ?? WIND_LOG_LAW.z0;
    const zRef = wind.zRef ?? WIND_LOG_LAW.zRef;
    const zLo = z0 + 0.01;
    const z_above = ry > zLo ? ry : zLo;
    const scale = Math.min(1, Math.log(z_above / z0) / Math.log(zRef / z0));
    return { wxs: wind.wind_x * scale, wzs: wind.wind_z * scale };
  };

  const pushPoint = (): void => {
    const { wxs, wzs } = windAtY(y[I_Y]);
    const vrx = y[I_VX] - wxs;
    const vry = y[I_VY];
    const vrz = y[I_VZ] - wzs;
    const vRelMs = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);
    points.push({
      x: y[I_X],
      y: y[I_Y],
      z: y[I_Z],
      t,
      vx: y[I_VX],
      vy: y[I_VY],
      vz: y[I_VZ],
      wx: y[I_WX],
      wy: y[I_WY],
      wz: y[I_WZ],
      vRelMs,
    });
  };

  pushPoint();

  for (let step = 0; step < PHYSICS.MAX_STEPS; step++) {
    yStart.set(y);
    rk4Step(ws, dt, env, wind, ball, carryDragFactor);
    k1Start.set(k1);

    if (y[I_Y] > apex) {
      apex = y[I_Y];
      apexX = y[I_X];
    }

    if (yStart[I_VY] > 0 && y[I_VY] <= 0) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tauApex = bisectHermiteTarget(
        yStart[I_VY],
        y[I_VY],
        k1Start[I_VY],
        k1End[I_VY],
        dt,
        0,
      );
      const yApex = hermite(yStart[I_Y], y[I_Y], k1Start[I_Y], k1End[I_Y], dt, tauApex);
      const xApex = hermite(yStart[I_X], y[I_X], k1Start[I_X], k1End[I_X], dt, tauApex);
      if (yApex > apex) {
        apex = yApex;
        apexX = xApex;
      }
    }

    t += dt;
    if (step % stride === 0) pushPoint();
    if (t >= maxFlightTimeS) {
      pushPoint();
      const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
      const landingAngleDeg =
        (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
      return {
        points,
        carryM: y[I_X],
        lateralM: y[I_Z],
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: maxFlightTimeS,
        landingAngleDeg,
        terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
        terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
      };
    }

    if (
      y[I_Y] <= groundYM
      && yStart[I_Y] >= groundYM
      && y[I_Y] < yStart[I_Y]
    ) {
      computeDerivatives(y, k1End, env, wind, ball, carryDragFactor);
      const tau = bisectGroundCrossing(
        yStart[I_Y], y[I_Y], k1Start[I_Y], k1End[I_Y], dt, groundYM,
      );

      const carry = hermite(yStart[I_X], y[I_X], k1Start[I_X], k1End[I_X], dt, tau);
      const lateral = hermite(yStart[I_Z], y[I_Z], k1Start[I_Z], k1End[I_Z], dt, tau);
      const vxL = hermite(yStart[I_VX], y[I_VX], k1Start[I_VX], k1End[I_VX], dt, tau);
      const vyL = hermite(yStart[I_VY], y[I_VY], k1Start[I_VY], k1End[I_VY], dt, tau);
      const vzL = hermite(yStart[I_VZ], y[I_VZ], k1Start[I_VZ], k1End[I_VZ], dt, tau);
      const wxL = hermite(yStart[I_WX], y[I_WX], k1Start[I_WX], k1End[I_WX], dt, tau);
      const wyL = hermite(yStart[I_WY], y[I_WY], k1Start[I_WY], k1End[I_WY], dt, tau);
      const wzL = hermite(yStart[I_WZ], y[I_WZ], k1Start[I_WZ], k1End[I_WZ], dt, tau);
      const vHorizL = Math.hypot(vxL, vzL);
      const landingAngleDeg =
        (Math.atan2(Math.abs(vyL), Math.max(vHorizL, 1e-3)) * 180) / Math.PI;

      const { wxs, wzs } = windAtY(groundYM);
      const vrx = vxL - wxs;
      const vry = vyL;
      const vrz = vzL - wzs;
      const vRelMs = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);

      points.push({
        x: carry,
        y: groundYM,
        z: lateral,
        t: t - dt + dt * tau,
        vx: vxL,
        vy: vyL,
        vz: vzL,
        wx: wxL,
        wy: wyL,
        wz: wzL,
        vRelMs,
      });

      return {
        points,
        carryM: carry,
        lateralM: lateral,
        apexHeightM: apex,
        apexXM: apexX,
        flightTimeS: t - dt + dt * tau,
        landingAngleDeg,
        terminalV: [vxL, vyL, vzL],
        terminalOmega: [wxL, wyL, wzL],
      };
    }
  }

  const vHorizEnd = Math.hypot(y[I_VX], y[I_VZ]);
  const landingAngleDeg =
    (Math.atan2(Math.abs(y[I_VY]), Math.max(vHorizEnd, 1e-3)) * 180) / Math.PI;
  return {
    points,
    carryM: y[I_X],
    lateralM: y[I_Z],
    apexHeightM: apex,
    apexXM: apexX,
    flightTimeS: t,
    landingAngleDeg,
    terminalV: [y[I_VX], y[I_VY], y[I_VZ]],
    terminalOmega: [y[I_WX], y[I_WY], y[I_WZ]],
  };
}
