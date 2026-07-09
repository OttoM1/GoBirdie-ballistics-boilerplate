'use strict';

import { PHYSICS } from './physicsConstants';

/**
 * Standard-atmosphere (ISA) pressure from altitude above sea level.
 * Tropospheric barometric formula, accurate ±0.5 % up to 3 000 m.
 */
export function pressureFromAltitudeM(altM: number): number {
  return PHYSICS.P_DEFAULT *
    Math.pow(1 - (0.0065 * Math.max(0, altM)) / 288.15, 5.2561);
}
