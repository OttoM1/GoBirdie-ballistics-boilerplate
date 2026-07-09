/**
 * New per-club Trackman launch profiles.

 *   Ball speed 
 *    Carry       m
 *    Spin        rpm
 *   Launch      deg
 *   Spin axis   deg
 *   Launch dir  deg
 *   Apex        m 
 *    Landing    deg
 */

import type { TrackmanLaunch } from './flight-lab/src/algorithm';
import { MPH_TO_MPS, MPS_TO_MPH, YD_TO_M, M_TO_YD } from './flight-lab/src/algorithm';

export const TRACKMAN_CLUB_IDS = [
  'Driver',
  '3-Wood',
  '5-Wood',
  'Hybrid',
  '3-iron',
  '4-iron',
  '5-iron',
  '6-iron',
  '7-iron',
  '8-iron',
  '9-iron',
  'P-Wedge',
  'S-Wedge',
  '60°-Wedge',
] as const;

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


export type PersonalizedDefaults = Record<TrackmanClubId, FullClubDefault>;


const _mph = (v: number): number => v * MPH_TO_MPS;
const _yd  = (v: number): number => v * YD_TO_M;

/** Side spin (rpm) from monitor backspin and spin-axis tilt (°). */
export function sideSpinRpmFromSpinAxis(backspinRpm: number, spinAxisDeg: number): number {
  const rad = (spinAxisDeg * Math.PI) / 180;
  return backspinRpm * Math.tan(rad);
}

export const DEFAULT_TRACKMAN: Record<TrackmanClubId, FullClubDefault> = {
  
Driver:      { ballSpeedMs: _mph(171), launchAngleDeg: 10.4, spinRPM: 2545, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.198, maxHeightM: 32, landingAngleDeg: 39, stockCarryM: _yd(282) },

'3-Wood':    { ballSpeedMs: _mph(162), launchAngleDeg: 9.3,  spinRPM: 3663, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.205, maxHeightM: 29, landingAngleDeg: 44, stockCarryM:  _yd(249) },

'5-Wood':    { ballSpeedMs: _mph(156), launchAngleDeg: 9.7,  spinRPM: 4322, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.210, maxHeightM: 30, landingAngleDeg: 48, stockCarryM:  _yd(236) },

Hybrid:      { ballSpeedMs: _mph(149), launchAngleDeg: 10.2, spinRPM: 4587, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.215, maxHeightM: 28, landingAngleDeg: 49, stockCarryM:  _yd(231) },

'3-iron':    { ballSpeedMs: _mph(145), launchAngleDeg: 10.3, spinRPM: 4404, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.220, maxHeightM: 27, landingAngleDeg: 48, stockCarryM:  _yd(218) },

'4-iron':    { ballSpeedMs: _mph(140), launchAngleDeg: 10.8, spinRPM: 4782, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.222, maxHeightM: 28, landingAngleDeg: 49, stockCarryM:  _yd(209) },

'5-iron':    { ballSpeedMs: _mph(135), launchAngleDeg: 11.9, spinRPM: 5280, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.225, maxHeightM: 30, landingAngleDeg: 50, stockCarryM:  _yd(199) },

'6-iron':    { ballSpeedMs: _mph(130), launchAngleDeg: 14.0, spinRPM: 6204, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.228, maxHeightM: 29, landingAngleDeg: 50, stockCarryM:  _yd(188) },

'7-iron':    { ballSpeedMs: _mph(123), launchAngleDeg: 16.1, spinRPM: 7124, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.230, maxHeightM: 31, landingAngleDeg: 51, stockCarryM:  _yd(176) },

'8-iron':    { ballSpeedMs: _mph(118), launchAngleDeg: 17.8, spinRPM: 8078, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.233, maxHeightM: 30, landingAngleDeg: 51, stockCarryM:  _yd(164) },

'9-iron':    { ballSpeedMs: _mph(112), launchAngleDeg: 20.0, spinRPM: 8793, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.236, maxHeightM: 29, landingAngleDeg: 52, stockCarryM:  _yd(152) },

'P-Wedge':   { ballSpeedMs: _mph(104), launchAngleDeg: 23.7, spinRPM: 9316, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.240, maxHeightM: 29, landingAngleDeg: 52, stockCarryM:  _yd(142) },
'S-Wedge':   { ballSpeedMs: _mph( 83), launchAngleDeg: 28.0, spinRPM: 9800, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.242, maxHeightM: 28.0, landingAngleDeg: 54.0, stockCarryM: _yd( 116) },
  
  
'60°-Wedge': { ballSpeedMs: _mph(75), launchAngleDeg: 31.0, spinRPM: 10700, spinAxisDeg: 0, launchDirectionDeg: 0, effectiveMassKg: 0.245, maxHeightM: 26.5, landingAngleDeg: 54.7, stockCarryM: _yd(108) },
};


const HCP_BASELINE = 10;
const SPIN_FACTOR_PER_HCP    = 0.010;
const LAUNCH_FACTOR_PER_HCP  = 0.005;
const SPIN_FACTOR_RANGE:   readonly [number, number] = [0.85, 1.30];
const LAUNCH_FACTOR_RANGE: readonly [number, number] = [0.95, 1.10];
const CH_SPEED_RANGE_MPH:  readonly [number, number] = [70, 130];


export interface PlayerProfile {
 
  
  clubDistancesM?: Readonly<Record<string, string | number | null | undefined>>;
 
  handicap?: number | string | null;
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;


export function clubheadSpeedMsFromDriverCarry(carryM: number): number {
  const carryYd = carryM * M_TO_YD;
  const vChMph  = clamp(0.4375 * carryYd - 11.25, CH_SPEED_RANGE_MPH[0], CH_SPEED_RANGE_MPH[1]);
  return vChMph * MPH_TO_MPS;
}


export function normalizeHandicap(raw: number | string | null | undefined): number {
  if (raw == null) return HCP_BASELINE;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return HCP_BASELINE;
  return clamp(n, 0, 54);
}


export function handicapSpinFactor(hcp: number): number {
  return clamp(1 + (hcp - HCP_BASELINE) * SPIN_FACTOR_PER_HCP,
               SPIN_FACTOR_RANGE[0], SPIN_FACTOR_RANGE[1]);
}


export function handicapLaunchFactor(hcp: number): number {
  return clamp(1 + (hcp - HCP_BASELINE) * LAUNCH_FACTOR_PER_HCP,
               LAUNCH_FACTOR_RANGE[0], LAUNCH_FACTOR_RANGE[1]);
}


export function deriveSkillFactor(driverCarryM: number): number {
  const userCH    = clubheadSpeedMsFromDriverCarry(driverCarryM);
  const defaultCH = clubheadSpeedMsFromDriverCarry(DEFAULT_TRACKMAN.Driver.stockCarryM);
  return userCH / defaultCH;
}


export function derivePersonalizedDefaults(player: PlayerProfile = {}): PersonalizedDefaults {
  const driverCarryM = getAnchorCarryM(
    player.clubDistancesM,
    'Driver',
    null,
    DEFAULT_TRACKMAN.Driver.stockCarryM,
  );
  const skill   = deriveSkillFactor(driverCarryM);
  const hcp     = normalizeHandicap(player.handicap);
  const spinF   = handicapSpinFactor(hcp);
  const launchF = handicapLaunchFactor(hcp);


    const out = {} as PersonalizedDefaults;
  for (const clubId of TRACKMAN_CLUB_IDS) {
    const base = DEFAULT_TRACKMAN[clubId];


        // fallback from the DEFAULT stock carry.
    

        const personalisedStockCarryM = base.stockCarryM * skill;
    const carryM = getAnchorCarryM(
      player.clubDistancesM,
      clubId,
      null,
      personalisedStockCarryM,
    );

    out[clubId] = {
      ballSpeedMs:        base.ballSpeedMs     * skill,
      launchAngleDeg:     base.launchAngleDeg  * launchF,
      spinRPM:            base.spinRPM         * spinF,
      spinAxisDeg:        base.spinAxisDeg,
      launchDirectionDeg: base.launchDirectionDeg,
      effectiveMassKg:    base.effectiveMassKg,
      maxHeightM:         base.maxHeightM,
      landingAngleDeg:    base.landingAngleDeg,
      stockCarryM:        carryM,
    };
  }
  return out;
}


export function resolveTrackman(
  clubId: TrackmanClubId,
  override?: PartialTrackmanEntry | null,
  personalized?: PersonalizedDefaults | null,
): TrackmanLaunch {
  const base = (personalized ?? DEFAULT_TRACKMAN)[clubId];
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

export type TrackmanField =
  | 'ballSpeedMs'
  | 'launchAngleDeg'
  | 'spinRPM'
  | 'spinAxisDeg'
  | 'launchDirectionDeg'
  | 'maxHeightM'
  | 'landingAngleDeg'
  | 'carryM';


export const TRACKMAN_COMPLETENESS_FIELDS: TrackmanField[] = [
  'ballSpeedMs',
  'launchAngleDeg',
  'spinRPM',
  'carryM',
];












export function getTrackmanEngineCalibrationPercent(
  profiles: TrackmanProfileMap,
  clubDistancesM?: Readonly<Record<string, string | number | null | undefined>>,
): number {
  let filled = 0;
  const total =
    TRACKMAN_CLUB_IDS.length * TRACKMAN_COMPLETENESS_FIELDS.length;
  for (const clubId of TRACKMAN_CLUB_IDS) {
    const entry = profiles[clubId];
    for (const field of TRACKMAN_COMPLETENESS_FIELDS) {
      let isFilled = false;
      if (field === 'carryM') {
        const fromMap = clubDistancesM?.[clubId];
        if (typeof fromMap === 'number' && Number.isFinite(fromMap) && fromMap > 0) {
          isFilled = true;
        } else if (typeof fromMap === 'string' && fromMap.trim() !== '') {
          const n = parseFloat(fromMap);
          if (Number.isFinite(n) && n > 0) isFilled = true;
        } else if (
          typeof entry?.carryM === 'number' &&
          Number.isFinite(entry.carryM) &&
          entry.carryM > 0
        ) {
          isFilled = true;
        }
      } else {
        const v = entry?.[field];
       
         if (typeof v === 'number' && Number.isFinite(v) && v > 0) isFilled = true;
      }
      if (isFilled) filled += 1;
    }
  }
  return Math.min(100, Math.round((filled / total) * 100));
}

export const TRACKMAN_FIELD_META: Record<
  TrackmanField,
  {
    label: string;
    unit: string;
    placeholder: (defaults: FullClubDefault) => string;
    min: number;
    max: number;

        allowNegative?: boolean;
   
    
    allowDecimal?: boolean;

        hint?: string;
  }
> = {
  ballSpeedMs: {
    label: 'Ball speed',
    unit: 'mph',

        placeholder: (d) => (d.ballSpeedMs * MPS_TO_MPH).toFixed(1),
    min: 13 * MPS_TO_MPH,
    max: 100 * MPS_TO_MPH,
    allowDecimal: true,
  },
  launchAngleDeg: {
    label: 'Launch angle',
    unit: '°',
    placeholder: (d) => d.launchAngleDeg.toFixed(1),
    min: 0,
    max: 60,
    allowDecimal: true,
  },
  spinRPM: {
    label: 'Backspin',
    unit: 'rpm',
    placeholder: (d) => String(Math.round(d.spinRPM)),
    min: 0,
    max: 14000,
  },
  maxHeightM: {
    label: 'Apex height',
    unit: 'm',
    placeholder: (d) => d.maxHeightM.toFixed(1),
    min: 5,
    max: 70,
    allowDecimal: true,
    hint: 'Peak height above launch from monitor.',
  },
  landingAngleDeg: {
    label: 'Landing descent',
    unit: '°',
    placeholder: (d) => d.landingAngleDeg.toFixed(1),
    min: 20,
    max: 65,
    allowDecimal: true,
    hint: 'Angle below horizontal at landing — not launch angle.',
  },
  spinAxisDeg: {
    label: 'Spin axis',
    unit: '°',
    placeholder: (d) => d.spinAxisDeg.toFixed(1),
    min: -90,
    max: 90,
    allowNegative: true,
    allowDecimal: true,
    hint: 'Positive = draw, negative = fade. 0 = straight.',
  },
  launchDirectionDeg: {
    label: 'Launch direction',
    unit: '°',
    placeholder: (d) => d.launchDirectionDeg.toFixed(1),
    min: -45,
    max: 45,
    allowNegative: true,
    allowDecimal: true,
    hint: 'Horizontal launch angle off target line. 0 = straight.',
  },
  carryM: {
    label: 'Carry distance',
    unit: 'm',
    placeholder: (d) => d.stockCarryM.toFixed(1),
    min: 18,  
    
    max: 350,  
    
    allowDecimal: true,
    hint: 'Used by the caddie as the anchor distance for this club.',
  },
};


export { MPH_TO_MPS, MPS_TO_MPH, YD_TO_M, M_TO_YD };
