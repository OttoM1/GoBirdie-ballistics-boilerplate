# GoBirdie Flight Engine — Public Release

This repository is **not** the GoBirdie production caddie engine.

It is a **research and demo slice**: a coarse ball-flight integrator, a small typed API, and a browser lab for exploring inputs. It does **not** ship calibration tables, anchor-carry blending, full club catalogues, or on-course club recommendation logic.

The production repo adds a tuned product layer on top of physics — that layer is intentionally omitted here.

---

## What is included

| Component | Description |
| --------- | ----------- |
| Demo RK4 integrator | 3D trajectory with simplified drag, lift, and spin decay |
| Atmosphere model | Air density, humidity, temperature, pressure; height-scaled wind |
| Ground roll | Rough post-landing roll estimate for the demo UI |
| `calculateShot()` | Public entry point — **`mode: 'physics'` only** |
| Flight Lab | Vite + React UI to tweak inputs and plot trajectories |
| Type definitions | `ShotInputs`, `ShotResult`, `TrackmanLaunch`, environment types |
| ESM bundle script | `npm run bundle:algorithm` → `engine-dist/algorithm.mjs` |

## What is not included

| Omitted | Reason |
| ------- | ------ |
| Anchor-carry blending | Proprietary tuning that locks stock carry while applying weather deltas |
| `mode: 'anchored'` | Throws in this release; production-only |
| Calibration tables & golden targets | Field-matched constants across clubs |
| Full 14-club Trackman catalogue | Demo ships one generic 7-iron preset |
| Handicap / player personalization | App-specific product logic |
| Caddie / club-suggestion logic | Multi-club comparison and scoring |
| Production-grade aero LUT | Public tree uses inline demo coefficients |

---

## Repository layout

```
├── LICENSE
├── README.md
├── PUBLIC.md
├── .gitignore
├── examples/
│   └── basic-shot.ts
└── Engine/
    ├── trackmanProfile.ts          # types + demo 7-iron preset
    └── flight-lab/
        ├── package.json
        ├── package-lock.json
        ├── index.html
        ├── vite.config.ts
        ├── tsconfig.json
        ├── scripts/
        │   └── bundle-algorithm.mjs
        └── src/
            ├── App.tsx             # Flight Lab UI
            ├── flightLabCore.ts    # UI ↔ algorithm bridge
            └── algorithm/
                ├── index.ts        # public exports
                ├── calculateShot.ts
                ├── rk4Flight.ts
                ├── aeroTable.ts
                ├── environment.ts
                ├── physicsConstants.ts
                ├── groundRoll.ts
                ├── lie.ts
                ├── rain.ts
                ├── pressure.ts
                ├── math.ts
                ├── units.ts
                ├── flightTypes.ts
                ├── flightConstraints.ts
                ├── shotModel.ts
                ├── neutralShot.ts
                └── aeroDensity.ts
```

Generated or local-only paths (not committed):

- `Engine/flight-lab/node_modules/`
- `Engine/flight-lab/dist/`
- `Engine/flight-lab/engine-dist/`

---

## Quick start

### Flight Lab (browser)

```bash
cd Engine/flight-lab
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`).

### Example script

From the repo root (requires `tsx`):

```bash
npx tsx examples/basic-shot.ts
```

### Standalone algorithm bundle

```bash
cd Engine/flight-lab
npm install
npm run bundle:algorithm
```

Output: `engine-dist/algorithm.mjs` (ESM, with source map).

---

## Public API

Supported calculation mode:

```typescript
import { calculateShot } from './Engine/flight-lab/src/algorithm';

const result = calculateShot({
  mode: 'physics',
  anchorCarryM: 160,
  trackman: { /* launch monitor fields */ },
  env: { /* temp, humidity, pressure, wind */ },
});
```

- **`mode: 'physics'`** — runs the public demo integrator; carry and apex come from RK4 (not anchor-locked).
- **`mode: 'anchored'`** — not available; throws with a clear error.

`anchorCarryM` is accepted for API compatibility and delta reporting; it does not drive production-style anchor blending in this release.

---

## Implementation notes

Files under `algorithm/` keep **stable module names and exports** so the architecture is readable, but several implementations are **deliberately simplified**:

| Module | Public behaviour |
| ------ | ---------------- |
| `rk4Flight.ts` | Coarse timestep; linear ground crossing; no production refinements |
| `aeroTable.ts` | Inline demo CD/CL formulas (not a calibrated LUT) |
| `calculateShot.ts` | Physics path only |
| `aeroDensity.ts` | Flat demo factor |
| `physicsConstants.ts` | Generic ball/thermo constants; `CALIBRATION_VERSION = 0` |
| `trackmanProfile.ts` | One demo 7-iron; generic numbers |
| `groundRoll.ts` | Simplified roll estimate |
| `flightLabCore.ts` | Raw sampled paths; no catalogue trajectory stretch |

Source files marked with a `PUBLIC RELEASE` header use demo implementations — production tuning is not included.

---

## Scope disclaimer

> This is a research and demo release of GoBirdie's ball-flight simulation **approach**. It is not the production caddie engine. Results are illustrative; do not use public carry numbers as on-course yardages.

---

## License

MIT — see [LICENSE](LICENSE).
