/**
 * Flight-lab helpers wired to `./algorithm` (same sources as production engine).
 */
import type {
  FlightSimExtras,
  SampledFlightPath,
  ShotInputs,
  ShotResult,
  TrackmanLaunch,
  WindParams,
} from './algorithm';
import {
  calculateShot,
  getEnvironment,
  launchRPMWithLie,
  LIE_CONFIG,
  pressureFromAltitudeM,
  sampleFlightPath,
} from './algorithm';
import { neutralStockEnvironmentalInputs } from './algorithm/neutralShot';
import { sideSpinRpmFromSpinAxis } from '@engine/trackmanProfile';

export function spinAxisDegFromTrackman(trackman: TrackmanLaunch): number {
  const backspin = trackman.spinRPM;
  if (!(backspin > 0)) return 0;
  const side = trackman.sideSpinRPM ?? 0;
  return (Math.atan2(side, backspin) * 180) / Math.PI;
}

export function alignPathApexToShot(
  inputs: ShotInputs,
  shot: ShotResult,
  path: SampledFlightPath,
): SampledFlightPath {
  if (shot.calculationMode !== 'anchored') return path;
  const h = inputs.trackman.maxHeightM;
  if (typeof h !== 'number' || !Number.isFinite(h) || h <= 1e-3) return path;
  if (path.apexHeightM <= 1e-6) return path;
  const s = shot.apexHeightM / path.apexHeightM;
  return {
    ...path,
    points: path.points.map((p) => ({ ...p, y: p.y * s })),
    apexHeightM: shot.apexHeightM,
  };
}

/** Match plotted trajectory to anchored carry + catalogue apex when environmental inputs are stock. */
export function finalizeDisplayedFlightPath(
  inputs: ShotInputs,
  shot: ShotResult,
  rawPath: SampledFlightPath,
): SampledFlightPath {
  const hCatalog = inputs.trackman.maxHeightM;

  const useCatalogStretch =
    shot.calculationMode === 'anchored'
    && neutralStockEnvironmentalInputs(inputs)
    && typeof hCatalog === 'number'
    && Number.isFinite(hCatalog)
    && hCatalog > 1e-6
    && shot.carryM > 1e-6
    && rawPath.carryM > 1e-9
    && rawPath.apexHeightM > 1e-9;

  if (!useCatalogStretch) {
    return alignPathApexToShot(inputs, shot, rawPath);
  }

  const sx = shot.carryM / rawPath.carryM;
  const sy = hCatalog / rawPath.apexHeightM;
  const landCatalog = inputs.trackman.landingAngleDeg;

  return {
    ...rawPath,
    carryM: shot.carryM,
    apexHeightM: hCatalog,
    apexXM: rawPath.apexXM * sx,
    lateralM: shot.lateralM,
    landingAngleDeg:
      typeof landCatalog === 'number' && Number.isFinite(landCatalog)
        ? Math.abs(landCatalog)
        : rawPath.landingAngleDeg,
    flightTimeS: shot.flightTimeS,
    terminalV: rawPath.terminalV,
    terminalOmega: rawPath.terminalOmega,
    points: rawPath.points.map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
      z: p.z * sx,
    })),
  };
}

const COR_BASE = 0.781;
const D_COR_DT = 0.001;
const REF_TEMP_C = 20;

export function windFromEnv(inputs: ShotInputs): WindParams | null {
  const { env } = inputs;
  if (env.windSpeedMs <= 0) return null;
  return {
    wind_x: -env.windSpeedMs * env.headComponent,
    wind_z: env.windSpeedMs * env.crossComponent,
    refSpeedMs: env.windSpeedMs,
    ...(typeof env.windZ0M === 'number' && Number.isFinite(env.windZ0M)
      ? { z0: env.windZ0M }
      : {}),
    ...(typeof env.windRefHeightM === 'number' && Number.isFinite(env.windRefHeightM)
      ? { zRef: env.windRefHeightM }
      : {}),
  };
}

/** RK4 path aligned with {@link calculateShot}. */
export function samplePathAlignedWithCalculateShot(inputs: ShotInputs): SampledFlightPath {
  const { env, trackman: tr } = inputs;
  const pressurePa = env.pressurePa ?? pressureFromAltitudeM(0);
  const envNow = getEnvironment(env.tempC, env.humidityPct, pressurePa);
  const dCor = D_COR_DT * (env.tempC - REF_TEMP_C);
  const v0NowMs = tr.ballSpeedMs * (1 + dCor / (1 + COR_BASE));

  const lieKey = inputs.lie ?? '';
  const lieCfg = LIE_CONFIG[lieKey];
  const spinLie = launchRPMWithLie(tr.spinRPM, inputs.lie);
  const sideLie = launchRPMWithLie(tr.sideSpinRPM ?? 0, inputs.lie);
  const v0LieMs = v0NowMs * lieCfg.ballSpeedMs;
  const launchDirectionDeg = tr.launchDirectionDeg ?? 0;

  const flightExtras: FlightSimExtras | undefined =
    typeof inputs.landingGroundYM === 'number' && Number.isFinite(inputs.landingGroundYM)
      ? { groundYM: inputs.landingGroundYM }
      : undefined;

  return sampleFlightPath(
    v0LieMs,
    tr.launchAngleDeg,
    spinLie,
    envNow,
    windFromEnv(inputs),
    sideLie,
    inputs.ball,
    2,
    flightExtras,
    lieCfg.carryDragFactor,
    launchDirectionDeg,
  );
}

export type SweepParam =
  | 'ballSpeedMs'
  | 'launchAngleDeg'
  | 'spinRPM'
  | 'spinAxisDeg'
  | 'launchDirectionDeg'
  | 'windSpeedMs'
  | 'tempC'
  | 'humidityPct'
  | 'altitudeM';

export const SWEEP_PARAM_LABELS: Record<SweepParam, string> = {
  ballSpeedMs: 'Ball speed (m/s)',
  launchAngleDeg: 'Launch angle (°)',
  spinRPM: 'Backspin (rpm)',
  spinAxisDeg: 'Spin axis (°)',
  launchDirectionDeg: 'Launch direction (°)',
  windSpeedMs: 'Wind speed (m/s)',
  tempC: 'Temperature (°C)',
  humidityPct: 'Humidity (%)',
  altitudeM: 'Altitude (m → pressure)',
};

export function readSweepBaseline(inputs: ShotInputs, param: SweepParam, altitudeM: number): number {
  switch (param) {
    case 'ballSpeedMs':
      return inputs.trackman.ballSpeedMs;
    case 'launchAngleDeg':
      return inputs.trackman.launchAngleDeg;
    case 'spinRPM':
      return inputs.trackman.spinRPM;
    case 'spinAxisDeg':
      return spinAxisDegFromTrackman(inputs.trackman);
    case 'launchDirectionDeg':
      return inputs.trackman.launchDirectionDeg ?? 0;
    case 'windSpeedMs':
      return inputs.env.windSpeedMs;
    case 'tempC':
      return inputs.env.tempC;
    case 'humidityPct':
      return inputs.env.humidityPct;
    case 'altitudeM':
      return altitudeM;
    default:
      throw new Error('Unhandled sweep param');
  }
}

export function applySweepParam(
  inputs: ShotInputs,
  param: SweepParam,
  value: number,
): ShotInputs {
  switch (param) {
    case 'ballSpeedMs':
      return { ...inputs, trackman: { ...inputs.trackman, ballSpeedMs: value } };
    case 'launchAngleDeg':
      return { ...inputs, trackman: { ...inputs.trackman, launchAngleDeg: value } };
    case 'spinRPM': {
      const axis = spinAxisDegFromTrackman(inputs.trackman);
      const sideSpinRPM = sideSpinRpmFromSpinAxis(value, axis);
      return { ...inputs, trackman: { ...inputs.trackman, spinRPM: value, sideSpinRPM } };
    }
    case 'spinAxisDeg': {
      const sideSpinRPM = sideSpinRpmFromSpinAxis(inputs.trackman.spinRPM, value);
      return { ...inputs, trackman: { ...inputs.trackman, sideSpinRPM } };
    }
    case 'launchDirectionDeg':
      return { ...inputs, trackman: { ...inputs.trackman, launchDirectionDeg: value } };
    case 'windSpeedMs':
      return { ...inputs, env: { ...inputs.env, windSpeedMs: value } };
    case 'tempC':
      return { ...inputs, env: { ...inputs.env, tempC: value } };
    case 'humidityPct':
      return { ...inputs, env: { ...inputs.env, humidityPct: value } };
    case 'altitudeM':
      return { ...inputs, env: { ...inputs.env, pressurePa: pressureFromAltitudeM(value) } };
    default:
      throw new Error('Unhandled sweep param');
  }
}

export function linspace(low: number, high: number, steps: number): number[] {
  const n = Math.max(2, Math.floor(steps));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    out.push(low + t * (high - low));
  }
  return out;
}

export interface SweepRow {
  paramValue: number;
  shot: ShotResult;
  path: SampledFlightPath;
}

export function runParameterSweep(args: {
  baseInputs: ShotInputs;
  param: SweepParam;
  low: number;
  high: number;
  steps: number;
}): SweepRow[] {
  const vals = linspace(args.low, args.high, args.steps);
  return vals.map((paramValue) => {
    const inputs = applySweepParam(args.baseInputs, args.param, paramValue);
    const shot = calculateShot(inputs);
    const path = finalizeDisplayedFlightPath(
      inputs,
      shot,
      samplePathAlignedWithCalculateShot(inputs),
    );
    return {
      paramValue,
      shot,
      path,
    };
  });
}
