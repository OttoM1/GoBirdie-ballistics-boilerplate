# GoBirdie TypeScript Engine

**Public identity:** An open-source **golf ball flight physics playground** — a TypeScript RK4 flight integrator with a browser-based lab for exploring trajectories under weather, wind, lie, and rain.

This is **not** the full GoBirdie production caddie engine. The public repo is a **research and demo slice**: enough to run experiments, understand the simulation approach, and build on a clean API — without shipping calibration tables, anchor-carry blending, or app-specific club catalogues.

# Link for the Native UI demo: 
https://github.com/OttoM1/GoBirdie-native-app-shell

---

## What this repo is

- `public-release` — development branch containing the publicly released RK4 trajectory engine, atmospheric models, and browser-based simulation lab.

| In scope (public) | Out of scope (private / not in this tree) |
|-------------------|-------------------------------------------|
| 3D ball-flight simulation (RK4 integrator) | Mobile app (`GoBirdie_RN`) |
| Atmosphere model (density, humidity, temperature) | Personalized player profiles |
| Wind profile (log-law height scaling) | Full launch-monitor calibration pipeline |
| Lie and rain as configurable modifiers | Anchored carry / catalogue blending |
| Interactive **Flight Lab** (Vite + React) | Internal stress reports and tuning notes |
| `physics` calculation mode | Production bundle integration for the app |

**One-line summary:** *Open-source mini flight simulator + lab UI — physics-first, not a commercial distance oracle.*

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.6+, strict mode, ES2022 |
| Lab UI | React 18, Vite 5 |
| Algorithm bundle | esbuild → single ESM file (`engine-dist/`) |
| Package manager | npm |
| Runtime | Browser (lab); neutral ESM bundle for embedders |

There is **no** backend, database, or cloud dependency. The lab is a static SPA after `npm run build`.

---

## Repository layout

```
GoBirdie_Prod_Engine/
└── Engine/
    ├── flight-lab/              # npm project — start here
    │   ├── src/
    │   │   ├── algorithm/       # Flight physics modules
    │   │   ├── App.tsx          # Flight Lab UI
    │   │   └── flightLabCore.ts # Lab ↔ engine bridge
    │   ├── scripts/
    │   │   └── bundle-algorithm.mjs
    │   └── engine-dist/         # Built ESM (after bundle:algorithm)
    └── scripts/                 # Optional offline report generators (dev)
```

Legacy prototypes and production-only profile data are **not** part of the public release (see [Public release boundaries](#public-release-boundaries)).

---

## Quick start

Requirements: **Node.js 18+**, **npm**, bash or any shell.

```bash
git clone <repo-url>
cd GoBirdie_Prod_Engine/Engine/flight-lab
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

### Build the lab

```bash
npm run build
npm run preview
```

### Build the standalone physics bundle

```bash
npm run bundle:algorithm
# → engine-dist/flight-algorithm.single.mjs
```

Embed that file in your own app if you only need the integrator without the React UI.

---

## Simulation overview (safe to document)

High-level pipeline — intentionally **conceptual**; implementation details and tuned coefficients stay in source but are not documented here as a calibration spec.

1. **Environment** — Air properties from temperature, humidity, and pressure (hygrometric density, Sutherland viscosity, temperature-dependent COR).
2. **Launch state** — Ball speed, launch angle, backspin / sidespin (user-supplied; no bundled pro tour tables in the public tree).
3. **Flight** — 9-state RK4 integration (position, velocity, spin) with aerodynamic forces from a 2D lookup table (Reynolds number × spin parameter).
4. **Landing** — Ground contact detection; terminal state feeds ground-roll model.
5. **Modifiers** — Lie (spin efficiency), rain (carry factor), fairway slope, wind (head/cross components with height-varying speed).

### Calculation modes

| Mode | Public repo | Description |
|------|-------------|-------------|
| **`physics`** | Supported | Carry, apex, lateral, and roll come directly from the integrator and modifiers. |
| **`anchored`** | Not public | Blends monitor/catalogue carry with physics deltas — production-only. |

Use **`mode: 'physics'`** in `ShotInputs` for open-source workflows. Do not rely on anchor carry or stock club presets in the public branch.

---

## Public API (supported surface)

Import from the algorithm entry (or the bundled `.mjs` after `bundle:algorithm`):

- **`calculateShot(inputs)`** — End-to-end shot result (`physics` mode).
- **`simulateFlightRK4` / `sampleFlightPath`** — Lower-level trajectory integration.
- **`getEnvironment`** — Air state for a given T / RH / pressure.
- **Types** — `ShotInputs`, `ShotResult`, `WindParams`, `LieType`, `RainType`, etc.
- **Units** — `MPS_TO_MPH`, `M_TO_YD`, and helpers.

Example shape (values are illustrative):

```ts
import { calculateShot } from './algorithm'; // or from engine-dist bundle

const result = calculateShot({
  anchorCarryM: 0, // ignored in physics mode
  mode: 'physics',
  trackman: {
    ballSpeedMs: 70,
    launchAngleDeg: 12,
    spinRPM: 6000,
    sideSpinRPM: 0,
  },
  env: {
    tempC: 20,
    humidityPct: 50,
    windSpeedMs: 5,
    headComponent: 1,
    crossComponent: 0,
  },
  lie: 'fairway',
  rain: 'none',
});
```

---

## Flight Lab

The lab is a **developer harness**, not a consumer product:

- Edit launch and environment parameters.
- Plot carry trajectories (side and top views).
- Compare parameter sweeps.
- Inspect carry, apex, lateral, roll, and timing.

It exists to make the physics **inspectable**, not to replicate a launch monitor UI.

---

## Contributing

1. Fork and branch from `main`.
2. Work in `Engine/flight-lab`; run `npm run dev` while iterating.
3. Prefer **`physics` mode** tests and lab scenarios — no dependencies on anchor carry or club tables.
4. Do not commit `node_modules/`, `dist/`, or stress-report outputs.
5. PRs that add launch-monitor tables, anchor blending, or app-specific profile logic will be declined for this repository (maintain a private fork for production).

---

## FAQ

**Is this TrackMan-compatible?**  
No claim of vendor compatibility in the public repo. Inputs use launch-monitor-*style* fields (ball speed, spin, angles) as a convenient API shape.

**Can I use this in a commercial app?**  
See `LICENSE`. The public slice is meant for learning and integration of the **physics** path; production GoBirdie uses a separate calibrated pipeline.

**Why RK4 instead of closed-form range equations?**  
Wind, density, and spin decay interact nonlinearly. A short integrator step gives interpretable trajectories for education and extension.

**Where is the mobile app?**  
Not here. This repo is the physics lab and embeddable integrator only.

---

## Related documentation

- **`README.md`** (root) — May contain deeper pipeline notes on the private branch; the public branch should treat **`repo.md`** as the source of truth for contributors.
- For architecture deep-dives on atmosphere and RK4 stages, see the conceptual sections in the private README — reproduce only non-calibration summaries here when syncing docs.

---

*Last updated for public open-source posture. Production calibration, anchored carry, and club catalogues remain proprietary.*
