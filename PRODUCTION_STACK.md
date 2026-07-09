# GoBirdie Production Engine - Technical Stack

- Release (private) version 1.0.0 - Calibration version 24.1.0

## Want to take your own ballistics simulation to the next level?

- Below you can find the breakdown of the full prod stack needed to simulate and predict the flight like GoBirdie:

## 1. Numerical Integration

- RK4 (4th-order Runge–Kutta) capped at 100hz timestep
- 9-state ODE
- Hermite cubic interpolation
- Bisection root-finding
- (Navier-Stokes equation coming for the release 2.0)

## 2. Classical Mechanics / Forces

- Gravity
- Newton's 2nd law
- Dynamic pressure
- Quadratic drag
- Magnus force (3D)
- Eccentricity force
- Launch kinematics
- Landing angle
- Forward-progress guard

## 3. Aerodynamics

- Reynolds number
- Spin parameter S
- Drag-crisis CD fit
- Spin-induced drag
- Saturating lift curve
- Re-dependent lift trend
- Bilinear LUT interpolation
- Stall blend
- High-speed CL cap
- Iron spin-band CL boost
- Induced drag
- Mach drag surcharge
- Surface CD/CL modifiers
- Global CD calibration

## 4. Spin Dynamics

- RPM to rad/s
- Spin decay (exponential)
- Side spin from spin axis
- Spin axis from components
- Lie spin efficiency

## 5. Atmosphere & Thermodynamics

- Magnus (Tetens) saturation pressure
- Vapor pressure
- Mixing ratio
- Virtual temperature
- Ideal gas density
- Sutherland viscosity
- Speed of sound
- ISA barometric pressure
- Density sensitivity vs carry

## 6. Wind

- Log-law wind profile (x, y, z)
- Relative velocity
- Wind vector decomposition
- Headwind sensitivity ramp
- Tailwind sensitivity ramp (interpolation capped)
- Wind carry delta (legacy metric)

## 7. Ball Speed & COR

- COR temperature correction (urethane core splitted to three models; soft, medium, hard)
- Ball-type COR sensitivity
- Lie ball-speed factor

## 8. Anchored-Mode Composition

- Leg ratio (proportional transfer)
- Wind ratio adjustment
- Composed carry
- Composed apex
- Landing angle blend
- Flight time scaling
- Lateral rescaling
- Fairway slope projection

## 9. Rain / Wet Ball

- Magnus collapse
- Drag surcharge
- Rain carry ratio

## 10. Ground Roll (Post-Flight) (not critical for the Engine)

- Landing descent angle
- Forward roll fraction
- Spin speed ratio χ
- Nominal roll
- Wind roll attenuation
- Spin roll brake
- Spin-check fraction
- Spin-back distance
- Total distance

## 11. Profile / Personalization (trackmanProfile.ts)

- Clubhead speed from driver carry
- Skill factor
- Handicap spin factor
- Handicap launch factor
- Personalized launch
- Spin axis clamp

## 12. Utility Math

- custom clamp
- smoothstep
- landing angle band
- landing angle trust weight
- smooth apex ratio
- Unit conversions

## 13. Display / Trajectory Alignment (flightLabCore.ts)

- Catalog path stretch
- Apex-only align
- Parameter sweep linspace

* OTTOM1 09.07.2026
