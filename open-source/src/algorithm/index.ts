/**
 * Import from `algorithm/index`.
 */

export { CALIBRATION_VERSION } from './physicsConstants';

export {
  MPS_TO_MPH,
  MPH_TO_MPS,
  M_TO_YD,
  YD_TO_M,
} from './units';

export { pressureFromAltitudeM } from './pressure';

export type {
  AirState,
  BallFlightCondition,
} from './environment';

export { getEnvironment } from './environment';

export type {
  WindParams,
  FlightSimExtras,
  FlightResult,
  FlightPathPoint,
  SampledFlightPath,
  FlightTracePoint,
  SampledFlightTrace,
  SimWorkspace,
} from './flightTypes';

export {
  createSimWorkspace,
  simulateFlightRK4,
  sampleFlightPath,
  sampleFlightTraceRK4,
} from './rk4Flight';

export type { LieType } from './lie';

export type { LieConfig } from './lie';

export {
  LIE_CONFIG,
  launchRPMWithLie,
  LIE_CARRY_DELTA_M,
} from './lie';

export type { RainType } from './rain';

export type { RainConfig } from './rain';

export { RAIN_CONFIG } from './rain';

export { neutralStockEnvironmentalInputs } from './neutralShot';

export type {
  ShotEnvironment,
  ShotCalculationMode,
  TrackmanLaunch,
  LieTyp,
  MissBias,
  GroundRollRegime,
  GroundRollDetail,
  ShotInputs,
  ShotResult,
} from './shotModel';

export { calculateShot } from './calculateShot';
