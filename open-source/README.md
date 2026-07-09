# GoBirdie Flight Engine — Public Release

This repository is **not** the full GoBirdie production caddie engine.

It is a **research and demo slice**: enough to run experiments, understand the simulation approach, and build on a clean API — without shipping calibration tables, anchor-carry blending, or app-specific club catalogues.

What you get here is the **physics skeleton** (RK4 ball flight, atmosphere, ground roll) plus a small **Flight Lab** web UI to visualize shots. What stays in the private production repo is the tuned product layer that turns that physics into reliable on-course club recommendations.

---

## What this repo is

| Included                  | Purpose                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| RK4 flight integrator     | 3D ball trajectory with drag, lift, spin decay, Mach effects          |
| Atmosphere model          | Humidity, temperature, pressure, log-law wind profile                 |
| Ground roll model         | Post-landing roll, check, spin-back (simplified coefficients)         |
| `calculateShot()` API     | Single entry point: launch + environment → carry, apex, roll, details |
| Flight Lab (Vite + React) | Interactive demo to tweak inputs and plot trajectories                |
| Type definitions          | `ShotInputs`, `ShotResult`, `TrackmanLaunch`, environment types       |

## What this repo is not

| Not included                        | Why                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Production anchor-carry blending    | Proprietary tuning that locks stock carry to player/club data while applying weather deltas |
| Calibration tables & golden targets | Iterated constants matched to launch-monitor field data across clubs                        |
| Full club catalogue                 | 14-club Trackman defaults, handicap personalization, skill scaling                          |
| Caddie / club-suggestion logic      | Multi-club comparison, playability scoring, app integration                                 |
| Stress-test golden numbers          | Internal acceptance criteria (`claude.md`, anchor stress reports)                           |

---

## Public tree (target layout)

Publish this **shape** so contributors can navigate the architecture. File contents inside sensitive modules are mostly **stubbed or redacted** — see checklist below.

```
GoBirdie-Flight-Engine/          # public repo name (suggested)
├── LICENSE
├── README.md                    # public-facing overview + quick start
├── PUBLIC.md                    # this file (optional in repo; useful for maintainers)
├── .gitignore
│
├── Engine/
│   ├── trackmanProfile.ts       # types + 1–2 example clubs only (stub)
│   │
│   ├── scripts/                 # optional: physics-only test runners
│   │   └── test-physics-7iron.ts   # renamed/simplified; no anchor golden checks
│   │
│   └── flight-lab/
│       ├── package.json
│       ├── package-lock.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       ├── scripts/
│       │   └── bundle-algorithm.mjs
│       │
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── App.css
│           ├── index.css
│           ├── flightLabCore.ts      # demo bridge; physics mode default
│           │
│           └── algorithm/            # full module list, selective contents
│               ├── index.ts
│               ├── shotModel.ts      # publish types + interfaces (full)
│               ├── calculateShot.ts  # physics path live; anchored path stubbed
│               ├── rk4Flight.ts      # publish (core integrator)
│               ├── environment.ts    # publish
│               ├── aeroTable.ts      # publish LUT builder (generic coeffs)
│               ├── aeroDensity.ts    # stub or generic demo factors
│               ├── physicsConstants.ts  # publish generic physics; redact tuning
│               ├── groundRoll.ts     # publish structure; soften tuned coeffs
│               ├── lie.ts              # publish enums + demo config
│               ├── rain.ts             # publish enums + demo config
│               ├── pressure.ts         # publish
│               ├── math.ts             # publish
│               ├── units.ts            # publish
│               ├── flightTypes.ts      # publish
│               ├── flightConstraints.ts # publish clamps; omit prod-only guards
│               └── neutralShot.ts      # publish (reference env helper)
│
└── examples/                    # optional but recommended
    └── basic-shot.ts            # minimal `calculateShot({ mode: 'physics' })` script
```

### Do not publish (omit entirely)

```
Prototypes/                      # internal history; not needed for public API
claudePrompt.md                  # internal agent / calibration brief
DEV.md                           # product notes (club suggestion logic)
Engine/flight-lab/dev_errors/    # internal test failures & stress reports
Engine/flight-lab/dist/          # build output
Engine/flight-lab/engine-dist/   # bundled build output
Engine/flight-lab/node_modules/
Engine/scripts/
  calibration-sweep.ts
  generate-anchor-stress-report.ts
  generate-wind-physics-stress-report.ts
  test-anchor-7iron.ts           # anchor golden-number validation
  test-env-sensitivity.ts        # anchored-mode sensitivity (uses full catalogue)
.DS_Store
```

---

## Release checklist: what to add, what to hide

### 1. Repo metadata (add)

- [ ] **LICENSE** — pick one (MIT or Apache-2.0 are common for research demos)
- [ ] **README.md** — rewrite for strangers: scope disclaimer, quick start, API example, link to Flight Lab
- [ ] **.gitignore** — at minimum: `node_modules/`, `dist/`, `engine-dist/`, `.DS_Store`, `dev_errors/`
- [ ] **CONTRIBUTING.md** (optional) — how to run Flight Lab, where physics lives, what PRs are welcome

### 2. Strategy: structure visible, content selective

The goal is **architectural transparency without giving away production IP**.

| Layer                              | Publish structure? | Publish full implementation?                                             |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| Folder tree + filenames            | Yes                | —                                                                        |
| TypeScript interfaces / public API | Yes                | Yes (`shotModel.ts`, exports in `index.ts`)                              |
| RK4 integrator + atmosphere        | Yes                | Yes (this is the research value)                                         |
| Aero LUT builder (`aeroTable.ts`)  | Yes                | Yes (generic Trackman-class polynomial; not your calibrated multipliers) |
| `calculateShot.ts`                 | Yes                | **Partial** — see below                                                  |
| `physicsConstants.ts`              | Yes                | **Partial** — generic ball/physics only                                  |
| `trackmanProfile.ts`               | Yes (file exists)  | **Stub** — types + one demo club                                         |
| Flight Lab UI                      | Yes                | Yes (default to `mode: 'physics'`)                                       |
| Internal scripts & reports         | No                 | No                                                                       |

### 3. File-by-file: add vs redact

#### Publish as-is (or with minor comment cleanup)

- `algorithm/rk4Flight.ts` — core integrator
- `algorithm/environment.ts` — air properties, wind field
- `algorithm/aeroTable.ts` — LUT construction & bilinear lookup (generic coeffs)
- `algorithm/pressure.ts`, `math.ts`, `units.ts`, `flightTypes.ts`
- `algorithm/shotModel.ts` — all interfaces
- `algorithm/index.ts` — public exports (drop anything that only serves anchored prod)
- `flight-lab/` app shell: `package.json`, configs, `main.tsx`, `App.tsx`, styles
- `flight-lab/scripts/bundle-algorithm.mjs`

#### Publish with redacted / generic constants

**`physicsConstants.ts`** — keep:

- `PHYSICS`, `THERMO`, `BALL` mass/diameter/LUT dimensions, Mach/spin decay baselines

Remove or replace with clearly labelled demo placeholders:

- `CALIBRATION_VERSION` (or set to `0` with comment: _not production-calibrated_)
- `WIND_SENSITIVITY_*` (head/tail/apex/landing blend factors)
- `IRON_CL_BOOST_*`, `TRACKMAN_CD_CALIBRATION_SCALE`
- `AERO_DENSITY_FACTOR_*` (anchor-distance sensitivity) — replace with a single demo constant or document as TODO

**`groundRoll.ts`**, **`lie.ts`**, **`rain.ts`** — keep structure and enums; replace tuned multipliers with documented demo defaults and a comment that production values are proprietary.

**`flightConstraints.ts`** — keep generic clamps; omit anchor-specific trust weights tied to golden validation.

#### Publish as stub / simplified implementation

**`calculateShot.ts`**

- **Keep:** full `mode: 'physics'` path (pure RK4 + rain/lie)
- **Stub:** `mode: 'anchored'` — either:
  - throw / log _"anchored mode not available in public release"_, or
  - return a simplified demo that applies raw RK4 deltas without anchor locking (clearly labelled non-production)
- Remove comments referencing internal golden targets (`claude.md`, specific 7-iron carry numbers)

**`aeroDensity.ts`**

- Replace club-distance sensitivity curve with a flat demo factor or a short comment + `return 0.35` placeholder

**`trackmanProfile.ts`**

- Keep: `TrackmanClubId` type (or a reduced union), `TrackmanLaunch`-related types, `sideSpinRpmFromSpinAxis`
- Publish: **one** example club (e.g. 7-iron) with plausible but generic numbers
- Remove: full `DEFAULT_TRACKMAN` 14-club table, `PlayerProfile`, handicap scaling, `deriveSkillFactor`, personalization helpers, app UI hint strings

**`flightLabCore.ts`**

- Default UI to `mode: 'physics'`
- Remove anchored-mode trajectory scaling tied to production blending

**`neutralShot.ts`**

- Keep if used by physics mode; strip references to production stock anchors

#### Do not add to public repo

| Item                                                     | Reason                                            |
| -------------------------------------------------------- | ------------------------------------------------- |
| `Prototypes/Core.js`, `golfPhysics_old.ts`               | Internal history, duplicates algorithm            |
| `claudePrompt.md`, `DEV.md`                              | Internal product & calibration notes              |
| Anchor / calibration stress scripts & reports            | Reveals golden numbers and acceptance thresholds  |
| `dist/`, `engine-dist/`, `node_modules/`                 | Generated; user runs `npm install && npm run dev` |
| Any file with player-specific or app-backend integration | Outside demo scope                                |

### 4. README messaging (add to public README)

Include a short disclaimer near the top:

> This is a research and demo release of GoBirdie's ball-flight simulation approach. It is **not** the production caddie engine. Anchor-carry calibration, club catalogues, and on-course recommendation logic are intentionally omitted.

Suggested quick start:

```bash
cd Engine/flight-lab
npm install
npm run dev
```

Point readers to `calculateShot({ mode: 'physics', ... })` as the supported public API.

### 5. Optional: placeholder pattern for redacted files

When keeping a file in the tree but hiding implementation, use a consistent pattern so the repo still type-checks:

```typescript
/** @public-release stub — production implementation is not open source */
export function aeroDensityFactorFromAnchor(_anchorCarryM: number): number {
  return 0.35; // demo constant; production uses club-distance sensitivity curve
}
```

Add a one-line file header where redaction applies:

```typescript
// PUBLIC RELEASE: simplified demo implementation. Production tuning not included.
```

### 6. Pre-push sanity check

- [ ] `npm install && npm run dev` works from `Engine/flight-lab`
- [ ] `mode: 'physics'` returns sensible carry for the demo 7-iron
- [ ] Grep for internal terms before push: `claude.md`, `CALIBRATION_VERSION`, `stockCarryM: _yd`, `WIND_SENSITIVITY`, golden carry numbers (~160.9 m), `PlayerProfile`, `handicap`
- [ ] No `dev_errors/`, no stress-report `.txt`/`.md` with prod numbers
- [ ] LICENSE present; README disclaimer present
- [ ] `.gitignore` excludes build artifacts and secrets

---

## Summary

**Publish the architecture** — module boundaries, public types, RK4 physics, Flight Lab demo.

**Hide the product** — calibration constants, anchor blending, full club tables, caddie logic, validation goldens, internal prompts.

**Preferred mechanism:** keep filenames and exports stable; replace proprietary _values and blending logic_ with stubs, demo constants, and `physics`-mode-only behaviour. That way the repo reads like the real engine, runs experiments honestly, and does not ship what makes GoBirdie production-accurate on course.
