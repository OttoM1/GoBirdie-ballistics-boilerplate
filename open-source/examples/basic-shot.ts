/*
  Surface level physics for a shot calculation.
 run from repo root after npm install: npx tsx examples/basic-shot.ts
 */
import { calculateShot } from '../Engine/flight-lab/src/algorithm';
import { DEMO_7_IRON } from '../Engine/trackmanProfile';

const trackman = {
  ballSpeedMs: DEMO_7_IRON.ballSpeedMs,
  launchAngleDeg: DEMO_7_IRON.launchAngleDeg,
  spinRPM: DEMO_7_IRON.spinRPM,
  sideSpinRPM: 0,
  launchDirectionDeg: 0,
  effectiveMassKg: DEMO_7_IRON.effectiveMassKg,
  maxHeightM: DEMO_7_IRON.maxHeightM,
  landingAngleDeg: DEMO_7_IRON.landingAngleDeg,
};

const result = calculateShot({
  mode: 'physics',
  anchorCarryM: DEMO_7_IRON.stockCarryM,
  trackman,
  env: {
    tempC: 20,
    humidityPct: 50,
    pressurePa: 101325,
    windSpeedMs: 0,
    headComponent: 1,
    crossComponent: 0,
  },
});

console.log('Physics-mode 7-iron (calm, fairway):');
console.log(`  Carry:  ${result.carryM.toFixed(1)} m`);
console.log(`  Apex:   ${result.apexHeightM.toFixed(1)} m`);
console.log(`  Roll:   ${result.rollM.toFixed(1)} m`);
console.log(`  Total:  ${result.totalDistanceM.toFixed(1)} m`);
