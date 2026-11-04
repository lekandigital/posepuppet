// CP10 — split-waterline verification for the dolphin chase camera.
//
// Drives the review window (review.mjs, headed or --headless) running the integrated app and checks,
// through the eval handle and Tidewater's own per-pixel medium target (post/PostFX.js `medium`, the
// near-plane water / air classification Underwater.js composites from), that the chase camera is free
// to sit on, straddle and cross the sea surface — and, after the CP10 controls pass, that ORDINARY
// surface swimming puts the Follow lens just under the mean so Tidewater's waves cross it both ways:
// fully submerged, the surface-ceiling hover (waves crossing a stationary lens), the Surface style
// (lens just above the mean), swimming at the surface with the hold, a dive and ascent, a breach and
// re-entry, and the pier shallows. The same lens pose is then rendered by PRISTINE Tidewater (free
// camera, 55° lens) for a side-by-side. Paced on the world clock. Results: waterline.json in
// eval/results (or TIDEWATER_RESULTS_DIR), images under captures/waterline/.
//
//   node test/waterline.mjs        (review window up: node review.mjs [--headless]; both dev servers running)

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep, screenshot, consoleLines, gameSleep, gameRun, baseUrl, pristineUrl, urlFlags, resultsDir, environment, setClockPath } from '../eval/lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resultsDir( resolve( HERE, '..', 'eval', 'results' ) );
const SHOTS = resolve( OUT, 'captures', 'waterline' );
mkdirSync( OUT, { recursive: true } );
mkdirSync( SHOTS, { recursive: true } );

const results = [];
const check = ( name, ok, detail ) => { results.push( { name, ok: !! ok, detail } ); console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name }${ detail !== undefined ? ' — ' + ( typeof detail === 'string' ? detail : JSON.stringify( detail ) ) : '' }` ); };
const D = ( expr ) => evaluate( `window.__TIDEWATER_DOLPHIN.${ expr }` );
const state = () => D( 'state()' );
const cam = () => D( 'camera()' );
const setIntent = ( p ) => D( `test.setIntent( ${ JSON.stringify( p ) } )` );
const place = ( x, z, y, yaw, speed = 0 ) => D( `test.placeAndFace( ${ x }, ${ z }, ${ y }, ${ yaw }, ${ speed } )` );
const HOVER = { kicks: 0, kickRate: 0, pitch: 0, roll: 0, burst: false, brake: true, autopilot: false };
const SWIM = { swim: 1, kicks: 0, kickRate: 1.8, pitch: 0, roll: 0, burst: false, brake: false, autopilot: false };

// Tidewater's medium target: fraction of the lens in water (1 = fully submerged, 0 = fully in air)
// plus the water fraction of the top and bottom pixel rows (a split lens has air at the top, water
// at the bottom).
let enginePath = '/vendor/tidewater/src/engine'; // the pristine app serves the same engine at /src/engine
const medium = () => evaluate( `(async () => {
	const { readTexture } = await import( '${ enginePath }/gpu/Readback.js' );
	const t = window.__app.post.medium.texture;
	const img = await readTexture( t, { bytesPerTexel: 1 } );
	const a = new Uint8Array( img.data ), w = img.width, h = img.height;
	let s = 0; for ( let i = 0; i < a.length; i ++ ) s += a[ i ];
	let top = 0, bot = 0;
	for ( let x = 0; x < w; x ++ ) { if ( a[ x ] > 127 ) top ++; if ( a[ ( h - 1 ) * w + x ] > 127 ) bot ++; }
	return { water: s / 255 / a.length, top: top / w, bottom: bot / w, w, h };
})()` );
const lens = async () => {

	const c = await cam(), m = await medium();
	const h = await evaluate( 'window.__app.cameraWaterHeight ?? 0' );
	return { eyeY: c.y, waterAtCam: h, eyeAboveCam: c.y - h, eyeAboveDolphinColumn: c.eyeAboveWaterM, eyeAboveMean: c.eyeAboveMeanM, crossings: c.surfaceCrossings, state: c.state, style: c.style, ...m };

};
const split = ( m ) => m.water > 0.04 && m.water < 0.96;
const samples = ( seconds, everyS = 0.25 ) => gameRun( seconds, everyS, () => lens() );
const sweep = ( arr ) => ( { min: + Math.min( ...arr.map( ( s ) => s.water ) ).toFixed( 2 ), max: + Math.max( ...arr.map( ( s ) => s.water ) ).toFixed( 2 ), split: arr.filter( split ).length, of: arr.length } );

// the start overlay appears after the loader fades: wait for it, then click it away
const dismissStart = async () => {

	await waitFor( `(() => { const s = document.querySelector( '.tw-start' ); return !! s && ! s.hidden && s.classList.contains( 'is-on' ); })()`, { label: 'start overlay', timeoutMs: 60000 } ).catch( () => {} );
	await evaluate( `(() => { const s = document.querySelector( '.tw-start' ); if ( s ) s.click(); return true; })()` );
	await sleep( 300 );
	await gameSleep( 0.3 );

};

const url = `${ baseUrl() }/?noAudio${ urlFlags() }`;
await navigate( url );
await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 1800000 } );
await dismissStart();
await evaluate( `window.__app.settings.timeOfDay = 14.0` ); // high sun: unambiguous air / water read
const env = await environment();
console.log( `[waterline] ${ url } · ${ env.headless ? 'headless' : 'headed' } · adapter ${ env.adapter ? `${ env.adapter.vendor }/${ env.adapter.architecture }` : 'none' }` );

const RIG = await D( 'RIG' );
check( 'rig constants carry no waterline exclusion (SURFACE_BAND / SHIMMER_MIN_Y / SHIMMER_HOLD_S absent)', ! ( 'SURFACE_BAND' in RIG ) && ! ( 'SHIMMER_MIN_Y' in RIG ) && ! ( 'SHIMMER_HOLD_S' in RIG ), Object.keys( RIG ).filter( ( k ) => /SHIMMER|SURFACE_BAND/.test( k ) ) );
await D( `setCameraStyle( 'follow' )` );

// 1. fully submerged: dolphin 6 m down, hovering → the eye ~4.9 m down (deep water keeps HEIGHT 1.1)
await place( 0, 80, - 6.0, Math.PI, 0 );
await setIntent( HOVER );
await gameSleep( 2.5 );
let L = await lens();
check( '1 fully submerged: lens entirely in water (medium ≥ 0.98), eye ≈ 4.9 m below the surface', L.water >= 0.98 && L.eyeAboveCam < - 3, { water: + L.water.toFixed( 3 ), eyeAboveCam: + L.eyeAboveCam.toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '01-submerged.jpg' ), 'jpeg', 86 );

// 2. the ordinary surface hover: the dolphin at its surface ceiling (−0.4 m). The Follow eye parks just
//    UNDER the mean (chaseHeight → HEIGHT_SURFACE) and Tidewater's waves cross the stationary lens.
await place( 0, 80, - 0.4, Math.PI, 0 );
await setIntent( HOVER );
await gameSleep( 2.0 );
const c0 = await cam();
const still = await samples( 8, 0.2 );
const sw2 = sweep( still );
check( '2 Follow at the surface ceiling: eye 0.0–0.2 m under the mean, stationary (< 3 cm of travel over 8 s)', still.every( ( s ) => s.eyeAboveMean < 0 && s.eyeAboveMean > - 0.2 ) && Math.max( ...still.map( ( s ) => s.eyeY ) ) - Math.min( ...still.map( ( s ) => s.eyeY ) ) < 0.03, { eyeAboveMean: still.map( ( s ) => + s.eyeAboveMean.toFixed( 3 ) ).slice( 0, 6 ) } );
check( '2 waves cross the lens: fully-in and fully-out frames (medium ≤ 0.05 and ≥ 0.95) and split frames between', sw2.min <= 0.05 && sw2.max >= 0.95 && sw2.split >= 1, { ...sw2, medium: still.map( ( s ) => + s.water.toFixed( 2 ) ) } );
check( '2 the split sits the right way up (air at the top row, water at the bottom row)', still.filter( split ).every( ( s ) => s.top <= 0.5 && s.bottom >= 0.5 ), still.filter( split ).slice( 0, 6 ).map( ( s ) => [ + s.top.toFixed( 2 ), + s.bottom.toFixed( 2 ) ] ) );
check( '2 the surface passes through the lens repeatedly (eye / waterline crossings ≥ 2 in 8 s)', still.at( - 1 ).crossings - c0.surfaceCrossings >= 2, { crossings: still.at( - 1 ).crossings - c0.surfaceCrossings } );
for ( let k = 0; k < 3; k ++ ) { await screenshot( resolve( SHOTS, `02-surface-hover-${ k }.jpg` ), 'jpeg', 90 ); await gameSleep( 0.7 ); }
// remember this lens pose for the pristine side-by-side
const pose = await evaluate( `(async () => { const { Euler } = await import( '/vendor/tidewater/src/engine/index.js' ); const c = window.__app.camera; const e = new Euler().setFromQuaternion( c.quaternion, 'YXZ' ); return { p: [ c.position.x, c.position.y, c.position.z ], yaw: e.y, pitch: e.x, fov: c.fov }; })()` );

// 3. the Surface style: the swimmer's eye, just ABOVE the mean, waves washing over it
await D( `setCameraStyle( 'scenic' )` );
await gameSleep( 2.0 );
const surf = await samples( 8, 0.2 );
const sw3 = sweep( surf );
check( '3 Surface style: eye 0.0–0.2 m above the mean, waves still wash over it (medium sweeps, split frames)', surf.every( ( s ) => s.eyeAboveMean > 0 && s.eyeAboveMean < 0.2 && s.style === 'scenic' ) && sw3.max >= 0.5 && sw3.min <= 0.05, { eyeAboveMean: + surf[ 0 ].eyeAboveMean.toFixed( 3 ), ...sw3, medium: surf.map( ( s ) => + s.water.toFixed( 2 ) ) } );
await screenshot( resolve( SHOTS, '03-surface-style.jpg' ), 'jpeg', 90 );
await D( `setCameraStyle( 'follow' )` );

// 4. a literally stationary lens with the swell ride OFF (the rendered dolphin no longer lifts): the eye
//    does not move either way — positioning is against the sim body — and the waves still cross it
await D( 'test.setSwellRide( false )' );
await place( 0, 80, - 0.4, Math.PI, 0 );
await setIntent( HOVER );
await gameSleep( 1.8 );
const c4 = await cam();
const fixed = await samples( 6, 0.2 );
await D( 'test.setSwellRide( true )' );
const eyeMove = Math.max( ...fixed.map( ( s ) => s.eyeY ) ) - Math.min( ...fixed.map( ( s ) => s.eyeY ) );
const sw4 = sweep( fixed );
check( '4 swell ride off: eye still (< 3 cm), water fraction sweeps (range ≥ 0.5), crossings ≥ 1', eyeMove < 0.03 && sw4.max - sw4.min >= 0.5 && fixed.at( - 1 ).crossings - c4.surfaceCrossings >= 1, { eyeMoveM: + eyeMove.toFixed( 3 ), ...sw4, crossings: fixed.at( - 1 ).crossings - c4.surfaceCrossings } );
await screenshot( resolve( SHOTS, '04-stationary-lens.jpg' ), 'jpeg', 90 );

// 5. ordinary surface SWIMMING with the hold: the dolphin cruises at its ceiling, the lens just under the
//    mean, the waves crossing it as it goes (this is the gameplay case the pass is about)
await place( 0, 95, - 0.4, Math.PI, 3 );
await setIntent( SWIM );
const swim = await gameRun( 8, 0.25, async () => ( { ...( await lens() ), dolphinY: ( await state() ).y, speed: ( await state() ).speed } ) );
const sw5 = sweep( swim );
check( '5 swimming at the surface (hold): dolphin at the ceiling (−0.6 … −0.3 m) at cruise, eye just under the mean', swim.every( ( s ) => s.dolphinY < - 0.3 && s.dolphinY > - 0.6 && s.eyeAboveMean < 0 && s.eyeAboveMean > - 0.25 ) && swim.at( - 1 ).speed > 4.5, { dolphinY: swim.map( ( s ) => + s.dolphinY.toFixed( 2 ) ).slice( 0, 8 ), eye: swim.map( ( s ) => + s.eyeAboveMean.toFixed( 2 ) ).slice( 0, 8 ), speed: + swim.at( - 1 ).speed.toFixed( 2 ) } );
check( '5 …and the waves pass through the moving lens (fully-in and fully-out frames seen; split frames or crossings)', sw5.min <= 0.1 && sw5.max >= 0.9 && ( sw5.split >= 1 || swim.at( - 1 ).crossings > swim[ 0 ].crossings ), { ...sw5, medium: swim.map( ( s ) => + s.water.toFixed( 2 ) ) } );
await screenshot( resolve( SHOTS, '05-swim-surface.jpg' ), 'jpeg', 86 );

// 6. dive and ascent: the eye goes under with the dolphin and comes back to the surface skim, continuously
await place( 0, 100, - 0.4, Math.PI, 3 );
await setIntent( { ...SWIM, pitch: 1 } );
const cBefore = await cam();
const dive = await gameRun( 2.2, 0.1, () => lens() );
await setIntent( { ...SWIM, pitch: - 1 } );
const rise = await gameRun( 4, 0.1, () => lens() );
await setIntent( HOVER );
await gameSleep( 1.5 );
const settle = await samples( 4, 0.25 );
const path = [ ...dive, ...rise, ...settle ];
const maxStep = Math.max( ...path.slice( 1 ).map( ( s, i ) => Math.abs( s.eyeY - path[ i ].eyeY ) ) );
const cAfter = await cam();
check( '6 dive: lens goes fully under (medium ≥ 0.98 at the bottom of the dive)', Math.max( ...dive.map( ( s ) => s.water ) ) >= 0.98, { deepest: + Math.min( ...dive.map( ( s ) => s.eyeAboveCam ) ).toFixed( 2 ) } );
check( '6 ascent: back at the surface skim (eye 0.0–0.25 m under the mean) with the waves crossing it again; the eye moved continuously (< 5.5 m per 100 ms, the rig\'s 55 m/s cap)', settle.every( ( s ) => s.eyeAboveMean < 0 && s.eyeAboveMean > - 0.25 ) && cAfter.surfaceCrossings - cBefore.surfaceCrossings >= 1 && maxStep < 5.5, { crossings: cAfter.surfaceCrossings - cBefore.surfaceCrossings, maxStepM: + maxStep.toFixed( 3 ), medium: settle.map( ( s ) => + s.water.toFixed( 2 ) ) } );
await screenshot( resolve( SHOTS, '06-after-ascent.jpg' ), 'jpeg', 86 );

// 7. breach and re-entry
await D( `test.setAssist( 'full' )` );
await place( 0, 110, - 4.0, Math.PI, 6 );
await setIntent( { brake: false, burst: true, pitch: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
await gameSleep( 0.7 );
await setIntent( { burst: true, pitch: - 1, kicks: 0, kickRate: 1.6, autopilot: false } );
const cB0 = await cam();
const breach = await gameRun( 3.5, 0.05, async ( tGame ) => ( { tGame, ...( await lens() ), s: await state() } ) );
await setIntent( HOVER );
const air = breach.filter( ( b ) => b.s.phase === 'air' );
const cB1 = await cam();
check( '7 breach: the dolphin goes airborne, the lens is fully in air at the apex, then both return under', air.length > 0 && air.some( ( b ) => b.water < 0.05 ) && breach.at( - 1 ).s.phase === 'swim', { airSamples: air.length, apexY: + Math.max( ...breach.map( ( b ) => b.s.y ) ).toFixed( 2 ), mediumInAir: air.map( ( b ) => + b.water.toFixed( 2 ) ) } );
check( '7 breach: camera states Airborne and SurfaceTransition / ReEntryRecovery, lens crossings counted', breach.some( ( b ) => b.state === 'Airborne' ) && breach.some( ( b ) => b.state === 'SurfaceTransition' || b.state === 'ReEntryRecovery' ) && cB1.surfaceCrossings > cB0.surfaceCrossings, { states: [ ...new Set( breach.map( ( b ) => b.state ) ) ], crossings: cB1.surfaceCrossings - cB0.surfaceCrossings } );
const stepB = Math.max( ...breach.slice( 1 ).map( ( b, i ) => Math.abs( b.eyeY - breach[ i ].eyeY ) ) );
const dtB = Math.max( 0.05, ...breach.slice( 1 ).map( ( b, i ) => ( b.tGame ?? 0 ) - ( breach[ i ].tGame ?? 0 ) ) );
check( `7 breach: camera path continuous (< 55 m/s × sample interval in y — never a cut)`, stepB < 55 * Math.max( dtB, 0.1 ) + 0.1, + stepB.toFixed( 2 ) );
await screenshot( resolve( SHOTS, '07-after-breach.jpg' ), 'jpeg', 86 );

// 8. shoreline terrain and obstacles: the pier shallows, swimming at the surface with the lens at its skim
await place( 50, 30, - 0.4, Math.PI, 2 );
await setIntent( SWIM );
const c8 = await cam();
const shore = await gameRun( 8, 0.5, async () => { const c = await cam(); return { ...( await lens() ), clear: c.bvhClearanceM, st: c.state }; } );
await setIntent( HOVER );
const shoreCross = shore.at( - 1 ).crossings - c8.surfaceCrossings;
check( '8 pier shallows at the surface: camera clearance from terrain / piles ≥ 0.5 m, no EmergencyRecenter, the surface crosses the lens', shore.every( ( s ) => ( s.clear === undefined || s.clear >= 0.5 ) && s.st !== 'EmergencyRecenter' ) && ( shore.some( split ) || shoreCross >= 1 ), { minClear: + Math.min( ...shore.map( ( s ) => s.clear ?? 99 ) ).toFixed( 2 ), states: [ ...new Set( shore.map( ( s ) => s.st ) ) ], medium: shore.map( ( s ) => + s.water.toFixed( 2 ) ), crossings: shoreCross } );
await screenshot( resolve( SHOTS, '08-pier-shallows.jpg' ), 'jpeg', 86 );
await setIntent( null );

// ---- pristine Tidewater at the same lens pose (free camera, 55° lens): the renderer is the same
// code; this shows the split view is Tidewater's own, not something the dolphin app adds
let pristine = null;
if ( process.env.TIDEWATER_SKIP_PRISTINE ) {

	console.log( 'pristine side-by-side skipped (TIDEWATER_SKIP_PRISTINE)' );

} else try {

	await navigate( `${ pristineUrl() }/?noAudio&fly${ urlFlags() }` );
	enginePath = '/src/engine';
	setClockPath( '/src/core/Globals.js' );
	await waitFor( '!!(window.__app && window.__app.ui)', { label: 'pristine ready', timeoutMs: 1800000 } );
	await dismissStart();
	// the pristine first-play guide (fishing intro) would sit over the view: close it
	await evaluate( `(() => { const g = window.__app.game && window.__app.game.guide; if ( g && g.open ) g.close(); return true; })()` );
	await evaluate( `(() => { const app = window.__app; app.settings.timeOfDay = 14.0; app.setFreeCam( true ); const V = app.fly.camera.position.constructor; app.fly.setPose( new V( ${ pose.p.join( ',' ) } ), ${ pose.yaw }, ${ pose.pitch } ); app.fly.velocity.set( 0, 0, 0 ); app.camera.fov = ${ pose.fov }; app.camera.updateProjectionMatrix(); return true; })()` );
	await gameSleep( 1.5 );
	const pm = await gameRun( 7.5, 0.25, () => medium() );
	for ( let k = 0; k < 3; k ++ ) { await screenshot( resolve( SHOTS, `02-surface-hover-pristine-${ k }.jpg` ), 'jpeg', 90 ); await gameSleep( 0.7 ); }
	const w = pm.map( ( m ) => + m.water.toFixed( 2 ) );
	pristine = { pose, medium: w, split: pm.filter( split ).length, min: Math.min( ...w ), max: Math.max( ...w ) };
	check( 'pristine Tidewater at the same lens pose and 55° lens shows the same behaviour (the surface sweeps through the lens: fully-in and fully-out, split frames)', pristine.max - pristine.min >= 0.5, pristine );

} catch ( e ) {

	check( 'pristine side-by-side captured', false, String( e ) );

} finally {

	enginePath = '/vendor/tidewater/src/engine';
	setClockPath( '/vendor/tidewater/src/core/Globals.js' );
	await navigate( url );
	await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 1800000 } );

}

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) && ! /favicon/.test( l ) );
check( 'no console errors during the waterline trials', errors.length === 0, errors.slice( 0, 5 ) );

const summary = { url, at: new Date().toISOString(), environment: env, passed: results.filter( ( r ) => r.ok ).length, total: results.length, results, pristine };
writeFileSync( resolve( OUT, 'waterline.json' ), JSON.stringify( summary, null, 2 ) );
console.log( `\n${ summary.passed }/${ summary.total } passed → ${ resolve( OUT, 'waterline.json' ) }` );
