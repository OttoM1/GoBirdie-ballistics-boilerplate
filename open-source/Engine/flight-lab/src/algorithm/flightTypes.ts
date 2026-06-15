'use strict';

export interface WindParams {
  readonly wind_x: number;
  readonly wind_z: number;
  readonly refSpeedMs: number;
  readonly z0?: number;
  readonly zRef?: number;
}

export interface FlightSimExtras {
  readonly groundYM?: number;

  readonly maxFlightTimeS?: number;
}

export interface FlightResult {
  carryM: number;
  lateralM: number;
  apexHeightM: number;

  apexXM: number;
  flightTimeS: number;
  landingAngleDeg: number;
  terminalV: [number, number, number];
  terminalOmega: [number, number, number];
}

export interface FlightPathPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly t: number;
}

export interface SampledFlightPath extends FlightResult {
  readonly points: FlightPathPoint[];
}

export interface FlightTracePoint extends FlightPathPoint {
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;

  readonly wx: number;
  readonly wy: number;
  readonly wz: number;

  readonly vRelMs: number;
}

export interface SampledFlightTrace extends FlightResult {
  readonly points: FlightTracePoint[];
}

export interface SimWorkspace {
  readonly y: Float64Array;
  readonly yTmp: Float64Array;
  readonly k1: Float64Array;
  readonly k2: Float64Array;
  readonly k3: Float64Array;
  readonly k4: Float64Array;
  readonly yStart: Float64Array;
  readonly k1Start: Float64Array;
  readonly k1End: Float64Array;
}
