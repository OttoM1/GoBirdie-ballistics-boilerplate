// lightweight RK4 demo

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
import { BALL, PHYSICS, WIND_LOG_LAW } from './physicsConstants';

const IX = 0, IY = 1, IZ = 2, IVX = 3, IVY = 4, IVZ = 5, IWX = 6, IWY = 7, IWZ = 8;
const N = 9;

function setLaunch(
  y: Float64Array,
  v0: number,
  launchDeg: number,
  backspinRpm: number,
  sideSpinRpm: number,
  launchDirDeg: number,
): void {
  const lr = (launchDeg * Math.PI) / 180;
  const dr = (launchDirDeg * Math.PI) / 180;
  const vH = v0 * Math.cos(lr);
  y[IX] = 0;
  y[IY] = 0;
  y[IZ] = 0;
  y[IVX] = vH * Math.cos(dr);
  y[IVY] = v0 * Math.sin(lr);
  y[IVZ] = vH * Math.sin(dr);
  y[IWX] = 0;
  y[IWY] = (sideSpinRpm * Math.PI) / 30;
  y[IWZ] = (backspinRpm * Math.PI) / 30;
}

/* Not a logarithmic wind gradient scaling */
function windAtHeight(wind: WindParams | null, yM: number): { wx: number; wz: number } {
  if (!wind) return { wx: 0, wz: 0 };
  const z0 = wind.z0 ?? WIND_LOG_LAW.z0;
  const zRef = wind.zRef ?? WIND_LOG_LAW.zRef;
  const h = Math.max(yM, z0 + 0.05);
  const scale = Math.min(1, Math.log(h / z0) / Math.log(zRef / z0));
  return { wx: wind.wind_x * scale, wz: wind.wind_z * scale };
}

function derivatives(
  y: Float64Array,
  out: Float64Array,
  env: AirState,
  wind: WindParams | null,
  ball: ResolvedBallFlightCondition,
  lieDrag: number,
): void {
  const { wx, wz } = windAtHeight(wind, y[IY]);
  const vrx = y[IVX] - wx;
  const vry = y[IVY];
  const vrz = y[IVZ] - wz;
  const vm = Math.hypot(vrx, vry, vrz);

  out[IX] = y[IVX];
  out[IY] = y[IVY];
  out[IZ] = y[IVZ];

  // Spin lifespan
  const decay = BALL.SPIN_DECAY_RATE;
  out[IWX] = -decay * y[IWX];
  out[IWY] = -decay * y[IWY];
  out[IWZ] = -decay * y[IWZ];

  if (vm < 0.5) {
    out[IVX] = 0;
    out[IVY] = -PHYSICS.G;
    out[IVZ] = 0;
    return;
  }

  const wMag = Math.hypot(y[IWX], y[IWY], y[IWZ]);
  const s = Math.min(BALL.S_MAX, (wMag * BALL.radius) / Math.max(vm, BALL.VREL_SPIN_FLOOR_MS));
  let { CD, CL } = aeroCoefficientsFromLut(0, s, ball.lutClMultiplier, ball.lutCdMultiplier);
  CD *= lieDrag * ball.carryDragFactor;

  
  const stall = 1 - Math.exp(-Math.pow(vm / BALL.STALL_VELOCITY, 2));
  CL *= stall;

  const q = 0.5 * env.rho * vm * vm * BALL.area;
  const inv = 1 / vm;

  const fdx = -q * CD * vrx * inv;
  const fdy = -q * CD * vry * inv;
  const fdz = -q * CD * vrz * inv;


  const cx = y[IWY] * vrz - y[IWZ] * vry;
  const cy = y[IWZ] * vrx - y[IWX] * vrz;
  const cz = y[IWX] * vry - y[IWY] * vrx;
  const cm = Math.hypot(cx, cy, cz) || 1;
  const fmx = q * CL * cx / cm;
  const fmy = q * CL * cy / cm;
  const fmz = q * CL * cz / cm;

  const invM = 1 / BALL.mass;
  out[IVX] = (fdx + fmx) * invM;
  out[IVY] = (fdy + fmy) * invM - PHYSICS.G;
  out[IVZ] = (fdz + fmz) * invM;
}

function rk4(
  ws: SimWorkspace,
  dt: number,
  env: AirState,
  wind: WindParams | null,
  ball: ResolvedBallFlightCondition,
  lieDrag: number,
): void {
  const { y, yTmp, k1, k2, k3, k4 } = ws;
  const h = 0.5 * dt;
  derivatives(y, k1, env, wind, ball, lieDrag);
  for (let i = 0; i < N; i++) yTmp[i] = y[i] + h * k1[i];
  derivatives(yTmp, k2, env, wind, ball, lieDrag);
  for (let i = 0; i < N; i++) yTmp[i] = y[i] + h * k2[i];
  derivatives(yTmp, k3, env, wind, ball, lieDrag);
  for (let i = 0; i < N; i++) yTmp[i] = y[i] + dt * k3[i];
  derivatives(yTmp, k4, env, wind, ball, lieDrag);
  const c = dt / 6;
  for (let i = 0; i < N; i++) y[i] += c * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function landingFromStep(
  y0: Float64Array,
  y1: Float64Array,
  groundY: number,
  t0: number,
  dt: number,
): { tau: number; tLand: number } {
  if (y1[IY] >= groundY || y0[IY] <= groundY) return { tau: 1, tLand: t0 + dt };
  const tau = (y0[IY] - groundY) / Math.max(y0[IY] - y1[IY], 1e-6);
  return { tau: Math.min(1, Math.max(0, tau)), tLand: t0 + dt * tau };
}

function snapshot(
  y0: Float64Array,
  y1: Float64Array,
  tau: number,
  groundY: number,
): FlightResult {
  const x = lerp(y0[IX], y1[IX], tau);
  const z = lerp(y0[IZ], y1[IZ], tau);
  const vx = lerp(y0[IVX], y1[IVX], tau);
  const vy = lerp(y0[IVY], y1[IVY], tau);
  const vz = lerp(y0[IVZ], y1[IVZ], tau);
  const wx = lerp(y0[IWX], y1[IWX], tau);
  const wy = lerp(y0[IWY], y1[IWY], tau);
  const wz = lerp(y0[IWZ], y1[IWZ], tau);
  const vH = Math.hypot(vx, vz);
  const landDeg = (Math.atan2(Math.abs(vy), Math.max(vH, 1e-3)) * 180) / Math.PI;
  return {
    carryM: x,
    lateralM: z,
    apexHeightM: 0,
    apexXM: 0,
    flightTimeS: 0,
    landingAngleDeg: landDeg,
    terminalV: [vx, vy, vz],
    terminalOmega: [wx, wy, wz],
  };
}

function integrate(
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  env: AirState,
  wind: WindParams | null,
  sideSpinRPM: number,
  ws: SimWorkspace,
  ballCondition: BallFlightCondition | undefined,
  flightExtras: FlightSimExtras | undefined,
  lieDrag: number,
  launchDirectionDeg: number,
  sampleEvery: number,
): {
  result: FlightResult;
  points: FlightPathPoint[];
  apex: number;
  apexX: number;
  tLand: number;
} {
  const { y, yStart } = ws;
  const ball = resolveBallFlightCondition(ballCondition);
  const groundY = flightExtras?.groundYM ?? 0;
  const maxT = flightExtras?.maxFlightTimeS ?? Number.POSITIVE_INFINITY;
  const dt = PHYSICS.DT;
  const stride = sampleEvery < 1 ? 1 : sampleEvery;

  setLaunch(y, v0Ms, launchDeg, backspinRPM, sideSpinRPM, launchDirectionDeg);

  let t = 0;
  let apex = 0;
  let apexX = 0;
  const points: FlightPathPoint[] = [{ x: 0, y: 0, z: 0, t: 0 }];

  for (let step = 0; step < PHYSICS.MAX_STEPS; step++) {
    yStart.set(y);
    rk4(ws, dt, env, wind, ball, lieDrag);

    if (y[IY] > apex) {
      apex = y[IY];
      apexX = y[IX];
    }

    if (y[IY] <= groundY && yStart[IY] > groundY) {
      const { tau, tLand } = landingFromStep(yStart, y, groundY, t, dt);
      const snap = snapshot(yStart, y, tau, groundY);
      points.push({ x: snap.carryM, y: groundY, z: snap.lateralM, t: tLand });
      return {
        result: {
          ...snap,
          apexHeightM: apex,
          apexXM: apexX,
          flightTimeS: tLand,
        },
        points,
        apex,
        apexX,
        tLand,
      };
    }

    t += dt;
    if (step % stride === 0) {
      points.push({ x: y[IX], y: y[IY], z: y[IZ], t });
    }
    if (t >= maxT) break;
  }

  const vH = Math.hypot(y[IVX], y[IVZ]);
  const landDeg = (Math.atan2(Math.abs(y[IVY]), Math.max(vH, 1e-3)) * 180) / Math.PI;
  points.push({ x: y[IX], y: y[IY], z: y[IZ], t });
  return {
    result: {
      carryM: y[IX],
      lateralM: y[IZ],
      apexHeightM: apex,
      apexXM: apexX,
      flightTimeS: t,
      landingAngleDeg: landDeg,
      terminalV: [y[IVX], y[IVY], y[IVZ]],
      terminalOmega: [y[IWX], y[IWY], y[IWZ]],
    },
    points,
    apex,
    apexX,
    tLand: t,
  };
}

export function createSimWorkspace(): SimWorkspace {
  return {
    y: new Float64Array(N),
    yTmp: new Float64Array(N),
    k1: new Float64Array(N),
    k2: new Float64Array(N),
    k3: new Float64Array(N),
    k4: new Float64Array(N),
    yStart: new Float64Array(N),
    k1Start: new Float64Array(N),
    k1End: new Float64Array(N),
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
  carryDragFactor: number = 1,
  _lieLaunchSpinEfficiency: number = 1,
  _lieBallSpeedMs: number = 1,
  launchDirectionDeg: number = 0,
): FlightResult {
  void _lieLaunchSpinEfficiency;
  void _lieBallSpeedMs;
  const { result } = integrate(
    v0Ms,
    launchDeg,
    backspinRPM,
    env,
    wind,
    sideSpinRPM,
    ws,
    ballCondition,
    flightExtras,
    carryDragFactor,
    launchDirectionDeg,
    999,
  );
  return result;
}

export function sampleFlightPath(
  v0Ms: number,
  launchDeg: number,
  backspinRPM: number,
  env: AirState,
  wind: WindParams | null,
  sideSpinRPM: number = 0,
  ballCondition?: BallFlightCondition,
  sampleStride: number = 4,
  flightExtras?: FlightSimExtras,
  carryDragFactor: number = 1,
  launchDirectionDeg: number = 0,
): SampledFlightPath {
  const ws = createSimWorkspace();
  const { result, points } = integrate(
    v0Ms,
    launchDeg,
    backspinRPM,
    env,
    wind,
    sideSpinRPM,
    ws,
    ballCondition,
    flightExtras,
    carryDragFactor,
    launchDirectionDeg,
    sampleStride,
  );
  return {
    points,
    carryM: result.carryM,
    lateralM: result.lateralM,
    apexHeightM: result.apexHeightM,
    apexXM: result.apexXM,
    flightTimeS: result.flightTimeS,
    landingAngleDeg: result.landingAngleDeg,
    terminalV: result.terminalV,
    terminalOmega: result.terminalOmega,
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
  sampleStride: number = 4,
  flightExtras?: FlightSimExtras,
  carryDragFactor: number = 1,
  launchDirectionDeg: number = 0,
): SampledFlightTrace {
  const path = sampleFlightPath(
    v0Ms,
    launchDeg,
    backspinRPM,
    env,
    wind,
    sideSpinRPM,
    ballCondition,
    sampleStride,
    flightExtras,
    carryDragFactor,
    launchDirectionDeg,
  );
  const points: FlightTracePoint[] = path.points.map((p) => ({
    ...p,
    vx: 0,
    vy: 0,
    vz: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    vRelMs: 0,
  }));
  return { ...path, points };
}
