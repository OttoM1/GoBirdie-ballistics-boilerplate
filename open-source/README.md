# GoBirdie Flight Engine

This is a **research and demo release** of GoBirdie's ball-flight simulation approach. It is **not** the production caddie engine. Anchor-carry calibration, full club catalogues, and on-course recommendation logic are intentionally omitted.

What you get:

- Demo-grade RK4 ball-flight integrator (illustrative trajectories, not field-calibrated)
- Atmosphere and log-law wind profile
- Ground roll model (simplified demo coefficients)
- `calculateShot({ mode: 'physics', ... })` — the supported public API
- **Flight Lab** — a Vite + React UI to tweak inputs and plot trajectories

## Quick start

```bash
cd Engine/flight-lab
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## API example

```typescript
import { calculateShot } from './Engine/flight-lab/src/algorithm';

const result = calculateShot({
  mode: 'physics',
  anchorCarryM: 160,
  trackman: {
    ballSpeedMs: 55,
    launchAngleDeg: 16,
    spinRPM: 7000,
    sideSpinRPM: 0,
    launchDirectionDeg: 0,
    effectiveMassKg: 0.23,
  },
  env: {
    tempC: 20,
    humidityPct: 50,
    pressurePa: 101325,
    windSpeedMs: 0,
    headComponent: 1,
    crossComponent: 0,
  },
});

console.log(result.carryM, result.apexHeightM, result.rollM);
```

See [`examples/basic-shot.ts`](examples/basic-shot.ts) for a runnable script.

## Layout

```
Engine/
├── trackmanProfile.ts       # types + demo 7-iron preset
└── flight-lab/
    ├── src/algorithm/         # physics modules
    └── src/flightLabCore.ts   # demo UI bridge
```

## What is not included

- Production anchor-carry blending
- Calibration tables and golden validation targets
- Full 14-club Trackman catalogue and handicap personalization
- Caddie / club-suggestion logic

See [`PUBLIC.md`](PUBLIC.md) for the full public-release checklist and redaction notes.

## License

MIT — see [LICENSE](LICENSE).
