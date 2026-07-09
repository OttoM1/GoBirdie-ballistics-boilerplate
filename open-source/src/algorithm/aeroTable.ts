'use strict';

import { BALL, BALL_SURFACE } from './physicsConstants';
import { clamp, smoothstep01 } from './math';

function trackmanClassCdClAtNode(Re: number, S: number): { cd: number; cl: number } {
  const lr = Math.log(Re / 155_000);
  const cdCrisis = 0.246 + 0.024 * Math.tanh(-1.42 * lr);
  const cdSpin = (S * (0.086 + 0.058 * S)) / (1 + 0.29 * S);
  let cd = cdCrisis + cdSpin;
  cd = clamp(cd, 0.188, 0.405);

  let cl = S * 1.06 - 0.59 * S * S + 0.035 * S * S * S;
  const reLift = 0.90 + 0.10 * smoothstep01((lr + 0.22) / 0.95);
  cl *= reLift;
  if (S < 1e-9) cl = 0;
  cl = Math.max(0, cl);
  return { cd, cl };
}

function buildAeroLut(): { cd: Float64Array; cl: Float64Array; nRe: number; nS: number } {
  const nRe = BALL.AERO_LUT_N_RE;
  const nS = BALL.AERO_LUT_N_S;
  const cd = new Float64Array(nRe * nS);
  const cl = new Float64Array(nRe * nS);
  const logR0 = Math.log(BALL_SURFACE.RE_MIN);
  const logR1 = Math.log(BALL_SURFACE.RE_MAX);
  for (let i = 0; i < nRe; i++) {
    const t = nRe <= 1 ? 0 : i / (nRe - 1);
    const Re = Math.exp(logR0 + (logR1 - logR0) * t);
    for (let j = 0; j < nS; j++) {
      const S = nS <= 1 ? 0 : BALL.S_MAX * (j / (nS - 1));
      const { cd: cdi, cl: cli } = trackmanClassCdClAtNode(Re, S);
      const k = i * nS + j;
      cd[k] = cdi;
      cl[k] = cli;
    }
  }
  return { cd, cl, nRe, nS };
}

const _AERO_LUT = buildAeroLut();

function aeroLutBilinear(
  table: Float64Array,
  nRe: number,
  nS: number,
  Re: number,
  S: number,
): number {
  const logR = Math.log(clamp(Re, BALL_SURFACE.RE_MIN, BALL_SURFACE.RE_MAX));
  const logR0 = Math.log(BALL_SURFACE.RE_MIN);
  const logR1 = Math.log(BALL_SURFACE.RE_MAX);
  const tR = (logR - logR0) / (logR1 - logR0);
  const tS = clamp(S / BALL.S_MAX, 0, 1);
  const x = tR * (nRe - 1);
  const y = tS * (nS - 1);
  const i0 = Math.floor(x);
  const j0 = Math.floor(y);
  const i1 = Math.min(i0 + 1, nRe - 1);
  const j1 = Math.min(j0 + 1, nS - 1);
  const fx = x - i0;
  const fy = y - j0;
  const idx = (i: number, j: number) => i * nS + j;
  const f00 = table[idx(i0, j0)];
  const f10 = table[idx(i1, j0)];
  const f01 = table[idx(i0, j1)];
  const f11 = table[idx(i1, j1)];
  return (1 - fx) * (1 - fy) * f00
    + fx * (1 - fy) * f10
    + (1 - fx) * fy * f01
    + fx * fy * f11;
}

/**
 * LUT sample with optional tuning multipliers applied immediately after interpolation.
 * Use `lutClMultiplier` / `lutCdMultiplier` while matching Trackman (e.g. mid-iron apex/carry targets);
 * bake winning values into `BallFlightCondition` defaults or physics constants afterward.
 */
export function aeroCoefficientsFromLut(
  Re: number,
  S: number,
  lutClMultiplier: number = 1,
  lutCdMultiplier: number = 1,
): { CD: number; CL: number } {
  return {
    CD: aeroLutBilinear(_AERO_LUT.cd, _AERO_LUT.nRe, _AERO_LUT.nS, Re, S) * lutCdMultiplier,
    CL: aeroLutBilinear(_AERO_LUT.cl, _AERO_LUT.nRe, _AERO_LUT.nS, Re, S) * lutClMultiplier,
  };
}
