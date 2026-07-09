
import type {
  GroundRollRegime,
  LieType,
  RainType,
  SampledFlightPath,
  ShotInputs,
  ShotResult,
} from './algorithm';
import {
  CALIBRATION_VERSION,
  calculateShot,
  pressureFromAltitudeM,
} from './algorithm';
import { BALL } from './algorithm/physicsConstants';
import {
 DEFAULT_TRACKMAN,
 MPS_TO_MPH,
 resolveTrackman,
 sideSpinRpmFromSpinAxis,
 TRACKMAN_CLUB_IDS,
 type TrackmanClubId,
} from '@engine/trackmanProfile';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
 finalizeDisplayedFlightPath,
 readSweepBaseline,
 runParameterSweep,
 samplePathAlignedWithCalculateShot,
 SWEEP_PARAM_LABELS,
 type SweepParam,
} from './flightLabCore';
import './App.css';


const PALETTE = [
 '#38bdf8',
 '#fb923c',
 '#a78bfa',
 '#4ade80',
 '#f472b6',
 '#facc15',
 '#2dd4bf',
 '#f87171',
];


const LIE_OPTIONS: LieType[] = [
 'fairway',
 'rough',
 'heavyRough',
 'fairwayBunker',
 'sand',
 'tee',
 '',
];


const RAIN_OPTIONS: RainType[] = ['none', 'light', 'moderate', 'heavy'];


const SWEEP_PARAMS = Object.keys(SWEEP_PARAM_LABELS) as SweepParam[];


type RunRow = {
 n: number;
 color: string;
 path: SampledFlightPath;
 shot: ShotResult;
};


function parseNum(s: string, fallback: number): number {
 const n = Number(String(s).replace(',', '.'));
 return Number.isFinite(n) ? n : fallback;
}


/** Downrange distance (x) where sampled path height is maximum. */
function downrangeAtApexM(path: SampledFlightPath): number | null {
 if (Number.isFinite(path.apexXM)) return path.apexXM;
 if (path.points.length === 0) return null;
 let maxY = -Infinity;
 let xAt = 0;
 for (const p of path.points) {
   if (p.y > maxY) {
     maxY = p.y;
     xAt = p.x;
   }
 }
 return maxY === -Infinity ? null : xAt;
}


function rollRegimeReadable(r: GroundRollRegime): string {
 switch (r) {
   case 'forward_release':
     return 'Forward release (runs out)';
   case 'checked':
     return 'Checked up (little release)';
   case 'spin_back':
     return 'Spin back (rolls back)';
   default:
     return String(r);
 }
}


function boundsFromRuns(paths: SampledFlightPath[]) {
 let maxX = 20;
 let maxY = 12;
 let maxZ = 5;
 for (const P of paths) {
   for (const p of P.points) {
     if (p.x > maxX) maxX = p.x;
     if (p.y > maxY) maxY = p.y;
     if (Math.abs(p.z) > maxZ) maxZ = Math.abs(p.z);
   }
 }
 maxX *= 1.06;
 maxY *= 1.12;
 if (maxY < 12) maxY = 12;
 maxZ = Math.max(maxZ * 1.25, 4);
 return { maxX, maxY, maxZ };
}


function sidePolylinePoints(
 path: SampledFlightPath,
 w: number,
 h: number,
 pad: number,
 b: { maxX: number; maxY: number; maxZ: number },
): string {
 if (path.points.length === 0) return '';
 const sx = (x: number) => pad + (x / b.maxX) * (w - 2 * pad);
 const sy = (y: number) => h - pad - (y / b.maxY) * (h - 2 * pad);
 return path.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
}


function planPolylinePoints(
 path: SampledFlightPath,
 w: number,
 h: number,
 pad: number,
 b: { maxX: number; maxY: number; maxZ: number },
): string {
 if (path.points.length === 0) return '';
 const sx = (x: number) => pad + (x / b.maxX) * (w - 2 * pad);
 const sz = (z: number) => h / 2 - (z / b.maxZ) * ((h - 2 * pad) / 2);
 return path.points.map((p) => `${sx(p.x)},${sz(p.z)}`).join(' ');
}


function FlightPlots({
 history,
 sweepPaths,
 chartW,
 chartH,
}: {
 history: RunRow[];
 sweepPaths: { path: SampledFlightPath; color: string; opacity: number }[];
 chartW: number;
 chartH: number;
}) {
 const paths = useMemo(() => history.map((h) => h.path), [history]);
 const allPaths = useMemo(() => [...paths, ...sweepPaths.map((s) => s.path)], [paths, sweepPaths]);
 const b = useMemo(() => boundsFromRuns(allPaths), [allPaths]);
 const pad = 44;
 const w = Math.max(chartW, 200);
 const h = Math.max(chartH, 160);


 const axes = (
   <>
     <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#2d3a47" strokeWidth={1} />
     <line x1={pad} y1={h - pad} x2={pad} y2={pad} stroke="#2d3a47" strokeWidth={1} />
   </>
 );


 const empty = (
   <div className="chart-pair">
     <p className="chart-title">Side view</p>
     <svg width={w} height={h}>
       <rect width={w} height={h} fill="#0c1014" rx={8} />
     </svg>
     <p className="chart-title">Plan/Lateral view</p>
     <svg width={w} height={h}>
       <rect width={w} height={h} fill="#0c1014" rx={8} />
     </svg>
   </div>
 );


 if (history.length === 0 && sweepPaths.length === 0) return empty;


 return (
   <div className="chart-pair">
     <p className="chart-title">Side view</p>
     <svg width={w} height={h}>
       <rect width={w} height={h} fill="#0c1014" rx={8} />
       {axes}
       {sweepPaths.map((s, i) => (
         <polyline
           key={`sw-s-${i}`}
           points={sidePolylinePoints(s.path, w, h, pad, b)}
           fill="none"
           stroke={s.color}
           strokeWidth={1.25}
           opacity={s.opacity}
         />
       ))}
       {history.map((row) => (
         <polyline
           key={`s-${row.n}`}
           points={sidePolylinePoints(row.path, w, h, pad, b)}
           fill="none"
           stroke={row.color}
           strokeWidth={2}
           opacity={0.92}
         />
       ))}
     </svg>
     <p className="chart-title">Plan/Lateral view</p>
     <svg width={w} height={h}>
       <rect width={w} height={h} fill="#0c1014" rx={8} />
       {axes}
       <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#283541" strokeWidth={1} strokeDasharray="4 4" />
       {sweepPaths.map((s, i) => (
         <polyline
           key={`sw-p-${i}`}
           points={planPolylinePoints(s.path, w, h, pad, b)}
           fill="none"
           stroke={s.color}
           strokeWidth={1.25}
           opacity={s.opacity}
         />
       ))}
       {history.map((row) => (
         <polyline
           key={`p-${row.n}`}
           points={planPolylinePoints(row.path, w, h, pad, b)}
           fill="none"
           stroke={row.color}
           strokeWidth={2}
           opacity={0.92}
         />
       ))}
     </svg>
   </div>
 );
}


export function App() {
 const [clubId, setClubId] = useState<TrackmanClubId>('7-iron');
 const [carryMStr, setCarryMStr] = useState('');
 const [ballSpeedStr, setBallSpeedStr] = useState('');
 const [launchStr, setLaunchStr] = useState('');
 const [spinStr, setSpinStr] = useState('');
 const [spinAxisStr, setSpinAxisStr] = useState('0');
 const [launchDirectionStr, setLaunchDirectionStr] = useState('0');
 const [maxHeightStr, setMaxHeightStr] = useState('');
 const [landingAngleStr, setLandingAngleStr] = useState('');
 const [windSpeedStr, setWindSpeedStr] = useState('0');
 const [headStr, setHeadStr] = useState('1');
 const [crossStr, setCrossStr] = useState('0');
 const [tempStr, setTempStr] = useState('20');
 const [humidityStr, setHumidityStr] = useState('50');
 const [altStr, setAltStr] = useState('0');
 const [lie, setLie] = useState<LieType>('fairway');
 const [rain, setRain] = useState<RainType>('none');
 const [dimpleStr, setDimpleStr] = useState('1');
 const [wearStr, setWearStr] = useState('0');
 const [eccStr, setEccStr] = useState('0');
 const [eccAxisStr, setEccAxisStr] = useState('0');
 const [lutClStr, setLutClStr] = useState('1');
 const [lutCdStr, setLutCdStr] = useState('1');
 const [ironBoostStr, setIronBoostStr] = useState(String(BALL.IRON_CL_BOOST_MAX_DELTA));
 const [cdCalStr, setCdCalStr] = useState(String(BALL.TRACKMAN_CD_CALIBRATION_SCALE));


 const [history, setHistory] = useState<RunRow[]>([]);
 const chartWrapRef = useRef<HTMLDivElement>(null);
 const [chartW, setChartW] = useState(360);


 useEffect(() => {
   const el = chartWrapRef.current;
   if (!el || typeof ResizeObserver === 'undefined') return;
   const ro = new ResizeObserver((entries) => {
     const w = entries[0]?.contentRect.width;
     if (w && w > 40) setChartW(w);
   });
   ro.observe(el);
   return () => ro.disconnect();
 }, []);


 const [sweepParam, setSweepParam] = useState<SweepParam>('launchAngleDeg');
 const [sweepLowStr, setSweepLowStr] = useState('');
 const [sweepHighStr, setSweepHighStr] = useState('');
 const [sweepStepsStr, setSweepStepsStr] = useState('9');
 const [sweepRows, setSweepRows] = useState<
   {
     paramValue: number;
     shot: ShotResult;
     path: SampledFlightPath;
   }[]
 >([]);
 const [showSweepOnChart, setShowSweepOnChart] = useState(true);


 const applyClubPreset = useCallback((id: TrackmanClubId) => {
   const d = DEFAULT_TRACKMAN[id];
   setCarryMStr(d.stockCarryM.toFixed(1));
   setBallSpeedStr(d.ballSpeedMs.toFixed(2));
   setLaunchStr(String(d.launchAngleDeg));
   setSpinStr(String(Math.round(d.spinRPM)));
   setSpinAxisStr(String(d.spinAxisDeg ?? 0));
   setLaunchDirectionStr(String(d.launchDirectionDeg ?? 0));
   setMaxHeightStr(d.maxHeightM.toFixed(1));
   setLandingAngleStr(String(d.landingAngleDeg));
 }, []);


 useEffect(() => {
   applyClubPreset(clubId);
 }, [clubId, applyClubPreset]);


 const buildInputs = useCallback((): ShotInputs => {
   const altM = parseNum(altStr, 0);
   const d = DEFAULT_TRACKMAN[clubId];
   const trackman = resolveTrackman(clubId, {
     ballSpeedMs: parseNum(ballSpeedStr, d.ballSpeedMs),
     launchAngleDeg: parseNum(launchStr, d.launchAngleDeg),
     spinRPM: parseNum(spinStr, d.spinRPM),
     spinAxisDeg: parseNum(spinAxisStr, d.spinAxisDeg),
     launchDirectionDeg: parseNum(launchDirectionStr, d.launchDirectionDeg),
     maxHeightM: parseNum(maxHeightStr, d.maxHeightM),
     landingAngleDeg: parseNum(landingAngleStr, d.landingAngleDeg),
   });
   return {
     anchorCarryM: parseNum(carryMStr, d.stockCarryM),
     trackman,
     env: {
       tempC: parseNum(tempStr, 20),
       humidityPct: parseNum(humidityStr, 50),
       pressurePa: pressureFromAltitudeM(altM),
       windSpeedMs: parseNum(windSpeedStr, 0),
       headComponent: parseNum(headStr, 1),
       crossComponent: parseNum(crossStr, 0),
     },
     lie: lie === '' ? undefined : lie,
     rain,
     ball: {
       dimpleTurbulence: parseNum(dimpleStr, 1),
       surfaceWear: parseNum(wearStr, 0),
       eccentricity: parseNum(eccStr, 0),
       eccentricityAxisDeg: parseNum(eccAxisStr, 0),
       lutClMultiplier: parseNum(lutClStr, 1),
       lutCdMultiplier: parseNum(lutCdStr, 1),
       ironBandClBoostMaxDelta: parseNum(ironBoostStr, BALL.IRON_CL_BOOST_MAX_DELTA),
       baselineCdCalibrationScale: parseNum(cdCalStr, BALL.TRACKMAN_CD_CALIBRATION_SCALE),
     },
     mode: 'anchored',
   };
 }, [
   altStr,
   carryMStr,
   ballSpeedStr,
   launchStr,
   spinStr,
   spinAxisStr,
   launchDirectionStr,
   maxHeightStr,
   landingAngleStr,
   windSpeedStr,
   headStr,
   crossStr,
   tempStr,
   humidityStr,
   clubId,
   lie,
   rain,
   dimpleStr,
   wearStr,
   eccStr,
   eccAxisStr,
   lutClStr,
   lutCdStr,
   ironBoostStr,
   cdCalStr,
 ]);


 const runShot = useCallback(() => {
   const inputs = buildInputs();
   const shot = calculateShot(inputs);
   const path = finalizeDisplayedFlightPath(
     inputs,
     shot,
     samplePathAlignedWithCalculateShot(inputs),
   );
   setHistory((h) => {
     const n = h.length + 1;
     const color = PALETTE[(n - 1) % PALETTE.length];
     return [...h, { n, color, path, shot }];
   });
 }, [buildInputs]);


 const clearPlots = useCallback(() => {
   setHistory([]);
   setSweepRows([]);
 }, []);


 const fillSweepSpanPercent = useCallback(() => {
   const inputs = buildInputs();
   const altM = parseNum(altStr, 0);
   const base = readSweepBaseline(inputs, sweepParam, altM);
   const pct = 0.1;
   if (sweepParam === 'spinAxisDeg') {
     const lo = base - 8;
     const hi = base + 8;
     setSweepLowStr(lo.toFixed(1));
     setSweepHighStr(hi.toFixed(1));
     return;
   }
   if (sweepParam === 'launchDirectionDeg') {
     const lo = base - 5;
     const hi = base + 5;
     setSweepLowStr(lo.toFixed(1));
     setSweepHighStr(hi.toFixed(1));
     return;
   }
   if (sweepParam === 'windSpeedMs') {
     const lo = Math.max(0, base - 5);
     const hi = base + 5;
     setSweepLowStr(lo.toFixed(1));
     setSweepHighStr(hi.toFixed(1));
     return;
   }
   if (sweepParam === 'altitudeM') {
     const lo = Math.max(0, altM - 500);
     const hi = altM + 500;
     setSweepLowStr(lo.toFixed(0));
     setSweepHighStr(hi.toFixed(0));
     return;
   }
   if (!Number.isFinite(base) || base === 0) {
     setSweepLowStr('');
     setSweepHighStr('');
     return;
   }
   setSweepLowStr((base * (1 - pct)).toFixed(4));
   setSweepHighStr((base * (1 + pct)).toFixed(4));
 }, [buildInputs, altStr, sweepParam]);


 const runSweep = useCallback(() => {
   const inputs = buildInputs();
   const steps = Math.min(51, Math.max(2, parseNum(sweepStepsStr, 9)));
   let low = parseNum(sweepLowStr, NaN);
   let high = parseNum(sweepHighStr, NaN);
   const altM = parseNum(altStr, 0);
   if (!Number.isFinite(low) || !Number.isFinite(high)) {
     const base = readSweepBaseline(inputs, sweepParam, altM);
     low = base * 0.9;
     high = base * 1.1;
   }
   if (high < low) [low, high] = [high, low];
   const rows = runParameterSweep({
     baseInputs: inputs,
     param: sweepParam,
     low,
     high,
     steps,
   });
   setSweepRows(rows);
 }, [buildInputs, sweepParam, sweepLowStr, sweepHighStr, sweepStepsStr, altStr]);


 const sweepPathsDecorated = useMemo(() => {
   if (!showSweepOnChart || sweepRows.length === 0) return [];
   const n = sweepRows.length;
   return sweepRows.map((row, i) => ({
     path: row.path,
     color: '#94a3b8',
     opacity: 0.15 + (0.55 * i) / Math.max(1, n - 1),
   }));
 }, [showSweepOnChart, sweepRows]);


 const last = history[history.length - 1];
 const lastApexDownrangeM = last ? downrangeAtApexM(last.path) : null;


 const baselineSweepShot = useMemo(() => {
   if (sweepRows.length === 0) return null;
   const mid = Math.floor(sweepRows.length / 2);
   return sweepRows[mid]?.shot ?? null;
 }, [sweepRows]);


 return (
   <div className="app-root">
     <header className="top-bar">
       <h1 className="title">GoBirdie Engine</h1>
       <p className="sub">
         Standalone harness for <span className="mono">algorithm/</span>.
         Charts show the sampled trajectory (COR, lie, wind, ball model); carry is anchored to your stock
         distance. Calibration v1.{CALIBRATION_VERSION}.
       </p>
     </header>


     <div className="grid">
       <div>
         <p className="section-label">Club preset</p>
         <select className="select" value={clubId} onChange={(e) => setClubId(e.target.value as TrackmanClubId)}>
           {TRACKMAN_CLUB_IDS.map((id) => (
             <option key={id} value={id}>
               {id}
             </option>
           ))}
         </select>


         <p className="section-label">Trackman</p>
         <LabeledInput label="Carry anchor (m)" value={carryMStr} onChange={setCarryMStr} />
         <LabeledInput
           label={`Ball speed (m/s) — ≈ ${(parseNum(ballSpeedStr, 0) * MPS_TO_MPH).toFixed(1)} mph`}
           value={ballSpeedStr}
           onChange={setBallSpeedStr}
         />
         <LabeledInput label="Launch (°)" value={launchStr} onChange={setLaunchStr} />
         <LabeledInput label="Backspin (rpm)" value={spinStr} onChange={setSpinStr} />
         <LabeledInput
           label="Spin axis (°, + draw / − fade)"
           value={spinAxisStr}
           onChange={setSpinAxisStr}
         />
         <LabeledInput
           label="Launch direction (°, off target line)"
           value={launchDirectionStr}
           onChange={setLaunchDirectionStr}
         />
         <LabeledInput label="Apex height (m)" value={maxHeightStr} onChange={setMaxHeightStr} />
         <LabeledInput label="Landing descent (°)" value={landingAngleStr} onChange={setLandingAngleStr} />
         <p className="stat-muted" style={{ margin: '0 0 0.75rem' }}>
           Side spin derived: {Math.round(sideSpinRpmFromSpinAxis(parseNum(spinStr, 0), parseNum(spinAxisStr, 0)))} rpm
         </p>


         <p className="section-label">Environment</p>
         <LabeledInput label="Wind (m/s)" value={windSpeedStr} onChange={setWindSpeedStr} />
         <LabeledInput label="Head fraction [−1 tail…+1 head]" value={headStr} onChange={setHeadStr} />
         <LabeledInput label="Cross fraction (+ from left)" value={crossStr} onChange={setCrossStr} />
         <LabeledInput label="Temp (°C)" value={tempStr} onChange={setTempStr} />
         <LabeledInput label="Humidity (%)" value={humidityStr} onChange={setHumidityStr} />
         <LabeledInput label="Altitude (m)" value={altStr} onChange={setAltStr} />


         <p className="section-label">Lie / rain</p>
         <select className="select" value={lie} onChange={(e) => setLie(e.target.value as LieType)}>
           {LIE_OPTIONS.map((k) => (
             <option key={k || 'def'} value={k}>
               {k === '' ? '(default)' : k}
             </option>
           ))}
         </select>
         <select className="select" value={rain} onChange={(e) => setRain(e.target.value as RainType)}>
           {RAIN_OPTIONS.map((k) => (
             <option key={k} value={k}>
               {k}
             </option>
           ))}
         </select>


         <p className="section-label">Ball model</p>
         <LabeledInput label="Dimple turbulence [0–1]" value={dimpleStr} onChange={setDimpleStr} />
         <LabeledInput label="Surface wear [0–1]" value={wearStr} onChange={setWearStr} />
         <LabeledInput label="Eccentricity [0–1]" value={eccStr} onChange={setEccStr} />
         <LabeledInput label="Eccentricity axis (°)" value={eccAxisStr} onChange={setEccAxisStr} />
         <p className="section-label">Aero LUT tuning</p>
         <LabeledInput
           label="LUT CL × (after interpolate, before stacks)"
           value={lutClStr}
           onChange={setLutClStr}
         />
         <LabeledInput
           label="LUT CD × (after interpolate, before stacks)"
           value={lutCdStr}
           onChange={setLutCdStr}
         />
         <LabeledInput
           label="Iron-band CL peak Δ (S band half-sine)"
           value={ironBoostStr}
           onChange={setIronBoostStr}
         />
         <LabeledInput
           label="Baseline CD calibration × (drag trim)"
           value={cdCalStr}
           onChange={setCdCalStr}
         />
       </div>


       <div ref={chartWrapRef}>
         <FlightPlots history={history} sweepPaths={sweepPathsDecorated} chartW={chartW} chartH={200} />


         {history.length > 0 && (
           <div className="legend">
             <p className="legend-title">Manual runs</p>
             {history.map((row) => (
               <p key={row.n} className="legend-row">
                 <span style={{ color: row.color }}>●</span> #{row.n} path carry {row.path.carryM.toFixed(1)} m — final
                 carry {row.shot.carryM.toFixed(1)} m
               </p>
             ))}
           </div>
         )}


         <div className="stats-box">
           {last ? (
             <>
               <p className="stat-section">Simulation Details</p>
               <p className="stat-line">
                <span className="stat-k"> Stock carry {last.shot.anchorCarryM.toFixed(2)} m. </span>
               <br></br>  <span className="stat-k">Adjusted carry</span> {last.shot.carryM.toFixed(2)} m.
               </p>
               <p className="stat-line">
                 <span className="stat-k">Ground roll</span> {last.shot.rollM.toFixed(2)} m (
                 {rollRegimeReadable(last.shot.details.groundRoll.regime)}).
               </p>
               <p className="stat-line">
                 <span className="stat-k">Total</span> {last.shot.totalDistanceM.toFixed(2)} m (carry + roll).
               </p>
               <p className="stat-line">
                 <span className="stat-k">Apex at x (downrange)</span>{' '}
                 {lastApexDownrangeM === null ? '—' : `${lastApexDownrangeM.toFixed(2)} m`}
               </p>
               <p className="stat-line">
                 <span className="stat-k">Ball speed at impact</span>{' '}
                 {last.shot.details.impactBallSpeedMs.toFixed(2)} m/s (≈{' '}
                 {(last.shot.details.impactBallSpeedMs * MPS_TO_MPH).toFixed(1)} mph).
               </p>
               <p className="stat-line">
                 <span className="stat-k">Launch angle at impact</span>{' '}
                 {last.shot.details.impactLaunchAngleDeg.toFixed(2)}°.
               </p>
               <p className="stat-line">
                 <span className="stat-k">Backspin at impact</span>{' '}
                 {last.shot.details.impactBackspinRpm.toFixed(0)} rpm.
               </p>


               <p className="stat-section">Flight Path</p>
               <p className="stat-line">
                 <span className="stat-k">Time airborne</span> {last.shot.flightTimeS.toFixed(2)} s ·{' '}
                 <br></br>
                 <span className="stat-k">Apex</span> {last.shot.apexHeightM.toFixed(2)} m ·{' '}
                <br></br>
                 <span className="stat-k">Lateral curve</span> {last.shot.lateralM.toFixed(2)} m.
               </p>
               <p className="stat-line">
                 <span className="stat-k">Landing</span>{' '}
                 {last.shot.details.groundRoll.landingAngleDeg.toFixed(1)}° descent{' '}
               <br></br>  <span className="stat-k">Backspin left at touchdown</span>{' '}
                 {last.shot.details.groundRoll.backspinRpmLanding.toFixed(0)} rpm.
               </p>


           
             </>
           ) : (
             <p className="stat-muted">Run a shot to see totals, or run a sweep for a sensitivity table.</p>
           )}
         </div>
         <div className="actions">
           <button type="button" className="btn btn-primary" onClick={runShot}>
             Run shot
           </button>
           <button type="button" className="btn btn-secondary" onClick={clearPlots}>
             Clear all
           </button>
         </div>
        
           <div className="sweep-tools" style={{marginTop: '1.5em'}}>
           <button type="button" className="btn btn-ghost" onClick={fillSweepSpanPercent}>
             Suggest sweep
           </button>
           <button type="button" className="btn btn-secondary" onClick={runSweep}>
             Run sweep
           </button>
         </div>
         <label className="checkbox-row">
           <input type="checkbox" checked={showSweepOnChart} onChange={(e) => setShowSweepOnChart(e.target.checked)} />
           Overlay sweep trajectories on charts
         </label>


            <p className="section-label">Parameter sweep</p>
         <select className="select" value={sweepParam} onChange={(e) => setSweepParam(e.target.value as SweepParam)}>
           {SWEEP_PARAMS.map((p) => (
             <option key={p} value={p}>
               {SWEEP_PARAM_LABELS[p]}
             </option>
           ))}
         </select>
         <LabeledInput label="Low" value={sweepLowStr} onChange={setSweepLowStr} />
         <LabeledInput label="High" value={sweepHighStr} onChange={setSweepHighStr} />
         <LabeledInput label="Steps (≥2)" value={sweepStepsStr} onChange={setSweepStepsStr} />
   


         {sweepRows.length > 0 && (
           <div className="table-wrap">
             <table className="sweep">
               <thead>
                 <tr>
                   <th>#</th>
                   <th>{SWEEP_PARAM_LABELS[sweepParam]}</th>
                   <th>Carry (m)</th>
                   <th>Δ carry %</th>
                   <th>Lateral (m)</th>
                   <th>Apex (m)</th>
                   <th>Sample path carry (m)</th>
                 </tr>
               </thead>
               <tbody>
                 {sweepRows.map((row, i) => {
                   const ref =
                     baselineSweepShot && baselineSweepShot.carryM > 1e-6
                       ? baselineSweepShot.carryM
                       : row.shot.carryM;
                   const dPct = ref > 1e-6 ? ((row.shot.carryM - ref) / ref) * 100 : 0;
                   const mid = Math.floor(sweepRows.length / 2);
                   return (
                     <tr key={`${row.paramValue}-${i}`} className={i === mid ? 'row-highlight' : undefined}>
                       <td>{i + 1}</td>
                       <td>{formatParamCell(sweepParam, row.paramValue)}</td>
                       <td>{row.shot.carryM.toFixed(2)}</td>
                       <td>{dPct.toFixed(2)}</td>
                       <td>{row.shot.lateralM.toFixed(2)}</td>
                       <td>{row.shot.apexHeightM.toFixed(2)}</td>
                       <td>{row.path.carryM.toFixed(2)}</td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
         )}
        


       </div>
       
     </div>
   </div>
 );
}


function formatParamCell(param: SweepParam, v: number): string {
 if (param === 'spinRPM') return v.toFixed(0);
 if (param === 'spinAxisDeg' || param === 'launchDirectionDeg') return v.toFixed(1);
 if (param === 'altitudeM' || param === 'humidityPct') return v.toFixed(0);
 if (param === 'tempC' || param === 'windSpeedMs') return v.toFixed(2);
 return v.toFixed(4);
}


function LabeledInput({
 label,
 value,
 onChange,
}: {
 label: string;
 value: string;
 onChange: (s: string) => void;
}) {
 return (
   <div className="field">
     <label className="field-label">{label}</label>
     <input className="input" value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
   </div>
 );
}
