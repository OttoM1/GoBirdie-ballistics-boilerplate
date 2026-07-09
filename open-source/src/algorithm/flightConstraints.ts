'use strict';

import { clamp, smoothstep01 } from './math';

/** Soft min / max descent angle (° below horizontal) vs launch — keeps reports in a believable band. */
export function landingAngleBandDeg(launchAngleDeg: number): { lo: number; hi: number } {
  const lo = clamp(24 + launchAngleDeg * 0.28, 22, 34);
  const hi = clamp(48 + launchAngleDeg * 0.32, 42, 60);
  return { lo, hi };
}

export function landingAngleTrustWeight(
  landingAngleDeg: number,
  launchAngleDeg: number,
): number {
  const { lo, hi } = landingAngleBandDeg(launchAngleDeg);
  if (landingAngleDeg >= lo && landingAngleDeg <= hi) return 1;
  const span = landingAngleDeg < lo ? lo - 18 : 62 - hi;
  const d = landingAngleDeg < lo ? lo - landingAngleDeg : landingAngleDeg - hi;
  const t = clamp(1 - d / Math.max(span, 8), 0, 1);
  return 0.62 + 0.38 * smoothstep01(t);
}

/**
 * Map raw apex ratio (context RK4 / baseline RK4) toward 1 — soft cap on deviation (±14% of delta).
 */
export function smoothApexRatio(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const c = clamp(raw, 0.48, 1.92);
  return 1 + (c - 1) * 0.86;
}
