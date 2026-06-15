// drag and lift (not a production LUT)

'use strict';

import { clamp } from './math';


function demoCdCl(S: number): { cd: number; cl: number } {
  const s = clamp(S, 0, 0.65);
  const cd = 0.24 + 0.08 * s;
  const cl = Math.max(0, s * 0.95 - 0.35 * s * s);
  return { cd, cl };
}


export function aeroCoefficientsFromLut(
  _Re: number,
  S: number,
  lutClMultiplier: number = 1,
  lutCdMultiplier: number = 1,
): { CD: number; CL: number } {
  const { cd, cl } = demoCdCl(S);
  return {
    CD: cd * lutCdMultiplier,
    CL: cl * lutClMultiplier,
  };
}
