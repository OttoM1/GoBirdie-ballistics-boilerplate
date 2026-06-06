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



---
