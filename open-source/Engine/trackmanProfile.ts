/*
  public release consists of  types + one demo club preset, not a full production club catalogue with personalization.
mph/mps + imperial/metric conversions helpers included from the production reference.
  */

import type { TrackmanLaunch } from './flight-lab/src/algorithm';
import { MPH_TO_MPS, MPS_TO_MPH, YD_TO_M, M_TO_YD } from './flight-lab/src/algorithm';

export const TRACKMAN_CLUB_IDS = ['7-iron'] as const;

export type TrackmanClubId = (typeof TRACKMAN_CLUB_IDS)[number];

export interface PartialTrackmanEntry {
  ballSpeedMs?: number | null;
  launchAngleDeg?: number | null;
  spinRPM?: number | null;
  spinAxisDeg?: number | null;
  launchDirectionDeg?: number | null;
  maxHeightM?: number | null;
  landingAngleDeg?: number | null;
  carryM?: number | null;
}

export type TrackmanProfileMap = Partial<Record<TrackmanClubId, PartialTrackmanEntry>>;

export type FullClubDefault = Omit<
  TrackmanLaunch,
  'maxHeightM' | 'landingAngleDeg' | 'sideSpinRPM' | 'launchDirectionDeg'
> & {
  stockCarryM: number;
  maxHeightM: number;
  landingAngleDeg: number;
  spinAxisDeg: number;
  launchDirectionDeg: number;
};


/* Side spin calculated from raw monitor backspin mirrored to the spin-axis tilt */

export function sideSpinRpmFromSpinAxis(backspinRpm: number, spinAxisDeg: number): number {
  const rad = (spinAxisDeg * Math.PI) / 180;
  return backspinRpm * Math.tan(rad);
}

/* 7-iron acts as the demo slice
*/
export const DEMO_7_IRON: FullClubDefault = {
  ballSpeedMs: 55.0,
  launchAngleDeg: 16.0,
  spinRPM: 7000,
  spinAxisDeg: 0,
  launchDirectionDeg: 0,
  effectiveMassKg: 0.23,
  maxHeightM: 30,
  landingAngleDeg: 50,
  stockCarryM: 160.0,
};

export const DEFAULT_TRACKMAN: Record<TrackmanClubId, FullClubDefault> = {
  '7-iron': DEMO_7_IRON,
};

export function resolveTrackman(
  clubId: TrackmanClubId,
  override?: PartialTrackmanEntry | null,
): TrackmanLaunch {
  const base = DEFAULT_TRACKMAN[clubId];
  const signedNum = (v: number | null | undefined, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const build = (
    ballSpeedMs: number,
    launchAngleDeg: number,
    spinRPM: number,
    spinAxisDeg: number,
    launchDirectionDeg: number,
  ): TrackmanLaunch => ({
    ballSpeedMs,
    launchAngleDeg,
    spinRPM,
    sideSpinRPM: sideSpinRpmFromSpinAxis(spinRPM, spinAxisDeg),
    launchDirectionDeg,
    effectiveMassKg: base.effectiveMassKg,
    maxHeightM: base.maxHeightM,
    landingAngleDeg: base.landingAngleDeg,
  });

  if (!override) {
    return build(
      base.ballSpeedMs,
      base.launchAngleDeg,
      base.spinRPM,
      base.spinAxisDeg,
      base.launchDirectionDeg,
    );
  }

  const num = (v: number | null | undefined, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
  const ballSpeedMs = num(override.ballSpeedMs, base.ballSpeedMs);
  const launchAngleDeg = num(override.launchAngleDeg, base.launchAngleDeg);
  const spinRPM = num(override.spinRPM, base.spinRPM);
  const spinAxisDeg = signedNum(override.spinAxisDeg, base.spinAxisDeg);
  const launchDirectionDeg = signedNum(override.launchDirectionDeg, base.launchDirectionDeg);

  return {
    ...build(ballSpeedMs, launchAngleDeg, spinRPM, spinAxisDeg, launchDirectionDeg),
    maxHeightM: num(override.maxHeightM, base.maxHeightM),
    landingAngleDeg: num(override.landingAngleDeg, base.landingAngleDeg),
  };
}

export function isTrackmanClubId(x: string): x is TrackmanClubId {
  return (TRACKMAN_CLUB_IDS as readonly string[]).includes(x);
}

export function getAnchorCarryM(
  clubDistancesM: Readonly<Record<string, string | number | null | undefined>> | undefined,
  clubId: TrackmanClubId,
  profiles?: TrackmanProfileMap | null,
  fallback: number = DEFAULT_TRACKMAN[clubId].stockCarryM,
): number {
  const fromMap = clubDistancesM?.[clubId];
  if (typeof fromMap === 'number' && Number.isFinite(fromMap) && fromMap > 0) {
    return fromMap;
  }
  if (typeof fromMap === 'string' && fromMap.trim() !== '') {
    const n = parseFloat(fromMap);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const legacy = profiles?.[clubId]?.carryM;
  if (typeof legacy === 'number' && Number.isFinite(legacy) && legacy > 0) {
    return legacy;
  }
  return fallback;
}

export { MPH_TO_MPS, MPS_TO_MPH, YD_TO_M, M_TO_YD };
