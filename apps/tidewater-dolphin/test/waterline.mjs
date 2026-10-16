// CP10 continuation — split-waterline verification for the dolphin chase camera.
//
// Drives the persistent review window (review.mjs) running the integrated app and checks, through
// the eval handle and Tidewater's own per-pixel medium target (post/PostFX.js `medium`, the near-plane
// water / air classification Underwater.js composites from), that the chase camera is free to sit on,
// straddle and cross the sea surface: fully submerged, fully above, precisely at the surface with
// waves crossing a stationary lens, swimming below with a partly submerged lens, a dive and ascent, a
// breach and re-entry, and the pier shallows. The same lens pose is then rendered by PRISTINE
// Tidewater (free camera, 55° lens) for a side-by-side. Results: eval/results/waterline.json, images in
// eval/captures/waterline/.
//
//   node test/waterline.mjs        (review window up: node review.mjs; both dev servers running)

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep, screenshot, consoleLines } from '../eval/lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resolve( HERE, '..', 'eval', 'results' );
const SHOTS = resolve( HERE, '..', 'eval', 'captures', 'waterline' );
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
	return { eyeY: c.y, waterAtCam: h, eyeAboveCam: c.y - h, eyeAboveDolphinColumn: c.eyeAboveWaterM, crossings: c.surfaceCrossings, state: c.state, ...m };

};
const split = ( m ) => m.water > 0.04 && m.water < 0.96;
const samples = async ( ms, every = 250 ) => {

	const out = [];
	const t0 = Date.now();
	while ( Date.now() - t0 < ms ) { out.push( await lens() ); await sleep( every ); }
	return out;

};

// the start overlay appears after the loader fades: wait for it, then click it away
const dismissStart = async () => {

	await waitFor( `(() => { const s = document.querySelector( '.tw-start' ); return !! s && ! s.hidden && s.classList.contains( 'is-on' ); })()`, { label: 'start overlay', timeoutMs: 30000 } ).catch( () => {} );
	await evaluate( `(() => { const s = document.querySelector( '.tw-start' ); if ( s ) s.click(); return true; })()` );
	await sleep( 900 );

};

const url = 'http://127.0.0.1:5199/?noAudio';
await navigate( url );
await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 600000 } );
await dismissStart();
await evaluate( `window.__app.settings.timeOfDay = 14.0` ); // high sun: unambiguous air / water read

const RIG = await D( 'RIG' );
check( 'rig constants carry no waterline exclusion (SURFACE_BAND / SHIMMER_MIN_Y / SHIMMER_HOLD_S absent)', ! ( 'SURFACE_BAND' in RIG ) && ! ( 'SHIMMER_MIN_Y' in RIG ) && ! ( 'SHIMMER_HOLD_S' in RIG ), Object.keys( RIG ).filter( ( k ) => /SHIMMER|SURFACE_BAND/.test( k ) ) );

// 1. fully submerged: dolphin 6 m down, hovering → the eye ~4.9 m down
await place( 0, 80, - 6.0, Math.PI, 0 );
await setIntent( HOVER );
await sleep( 2500 );
let L = await lens();
check( '1 fully submerged: lens entirely in water (medium ≥ 0.98), eye ≈ 4.9 m below the surface', L.water >= 0.98 && L.eyeAboveCam < - 3, { water: + L.water.toFixed( 3 ), eyeAboveCam: + L.eyeAboveCam.toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '01-submerged.jpg' ), 'jpeg', 86 );

// 2. fully above: dolphin at its surface ceiling (−0.4 m) → the eye ~0.7 m above the mean surface
await place( 0, 80, - 0.4, Math.PI, 0 );
await setIntent( HOVER );
await sleep( 2500 );
L = await lens();
check( '2 fully above: lens entirely in air (medium ≤ 0.03) with the dolphin at the surface', L.water <= 0.03 && L.eyeAboveCam > 0.3, { water: + L.water.toFixed( 3 ), eyeAboveCam: + L.eyeAboveCam.toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '02-above.jpg' ), 'jpeg', 86 );

// 3 + 4. precisely at the surface, lens stationary, waves crossing it: dolphin 1.1 m down (HEIGHT 1.1)
await place( 0, 80, - 1.1, Math.PI, 0 );
await setIntent( HOVER );
await sleep( 1800 );
const c0 = await cam();
const still = await samples( 6000, 200 );
const nSplit = still.filter( split ).length;
const minW = Math.min( ...still.map( ( s ) => s.water ) ), maxW = Math.max( ...still.map( ( s ) => s.water ) );
check( '3 lens at the surface: the eye rests within 15 cm of the local waterline, no exclusion band', still.every( ( s ) => Math.abs( s.eyeAboveDolphinColumn ) < 0.15 ), { eyeAboveDolphinColumn: still.map( ( s ) => + s.eyeAboveDolphinColumn.toFixed( 3 ) ).slice( 0, 8 ) } );
// (the swell lifts the rendered dolphin and the eye with it, so the lens is fully in or fully out
// whenever a crest or trough is passing and split only while the surface is within the lens's
// few centimetres — exactly as the pristine swimmer's eye behaves)
check( '3 split frames: air and water in the same image (0.04 < medium < 0.96) seen repeatedly, with fully-in and fully-out frames between', nSplit >= 2 && minW <= 0.02 && maxW >= 0.98, { splitSamples: nSplit, of: still.length, medium: still.map( ( s ) => + s.water.toFixed( 2 ) ) } );
check( '3 the split sits the right way up (air at the top row, water at the bottom row) in the split frames', still.filter( split ).every( ( s ) => s.top <= 0.5 && s.bottom >= 0.5 ), still.filter( split ).slice( 0, 6 ).map( ( s ) => [ + s.top.toFixed( 2 ), + s.bottom.toFixed( 2 ) ] ) );
check( '3 the surface passes through the lens repeatedly (eye / waterline crossings ≥ 2 in 6 s)', still.at( - 1 ).crossings - c0.surfaceCrossings >= 2, { crossings: still.at( - 1 ).crossings - c0.surfaceCrossings } );
for ( let k = 0; k < 3; k ++ ) { await screenshot( resolve( SHOTS, `03-straddle-${ k }.jpg` ), 'jpeg', 90 ); await sleep( 700 ); }

// 4. a literally stationary lens (swell ride off → the rendered dolphin and the eye hold still) with
//    the waves crossing it
await D( 'test.setSwellRide( false )' );
await place( 0, 80, - 1.1, Math.PI, 0 );
await setIntent( HOVER );
await sleep( 1800 );
const c4 = await cam();
const fixed = await samples( 6000, 200 );
await D( 'test.setSwellRide( true )' );
const eyeMove = Math.max( ...fixed.map( ( s ) => s.eyeY ) ) - Math.min( ...fixed.map( ( s ) => s.eyeY ) );
const minF = Math.min( ...fixed.map( ( s ) => s.water ) ), maxF = Math.max( ...fixed.map( ( s ) => s.water ) );
check( '4 waves cross a stationary lens: eye still (< 3 cm), water fraction sweeps (range ≥ 0.5), surface crossings ≥ 1', eyeMove < 0.03 && maxF - minF >= 0.5 && fixed.at( - 1 ).crossings - c4.surfaceCrossings >= 1, { eyeMoveM: + eyeMove.toFixed( 3 ), minWater: + minF.toFixed( 2 ), maxWater: + maxF.toFixed( 2 ), splitSamples: fixed.filter( split ).length, crossings: fixed.at( - 1 ).crossings - c4.surfaceCrossings } );
await screenshot( resolve( SHOTS, '04-stationary-lens.jpg' ), 'jpeg', 90 );
// remember this lens pose for the pristine side-by-side
const pose = await evaluate( `(async () => { const { Euler } = await import( '/vendor/tidewater/src/engine/index.js' ); const c = window.__app.camera; const e = new Euler().setFromQuaternion( c.quaternion, 'YXZ' ); return { p: [ c.position.x, c.position.y, c.position.z ], yaw: e.y, pitch: e.x, fov: c.fov }; })()` );

// 5. swimming below the surface with the lens partly submerged: level cruise at −1.15 m with kicks
await place( 0, 95, - 1.15, Math.PI, 3 );
await setIntent( { kicks: 0, kickRate: 1.6, pitch: 0, roll: 0, burst: false, brake: false, autopilot: false } );
const swim = [];
for ( let i = 0; i < 10; i ++ ) {

	await setIntent( { kicks: 1, kickRate: 1.6, kickAmp: 0.6, pitch: 0, autopilot: false } ); await sleep( 60 );
	await setIntent( { kicks: 0, kickRate: 1.6, pitch: 0, autopilot: false } ); await sleep( 440 );
	swim.push( { ...( await lens() ), dolphinY: ( await state() ).y } );

}
check( '5 swimming below with the lens partly submerged: dolphin stays under (y < −0.8), split frames seen', swim.every( ( s ) => s.dolphinY < - 0.8 ) && swim.some( split ), { dolphinY: swim.map( ( s ) => + s.dolphinY.toFixed( 2 ) ), medium: swim.map( ( s ) => + s.water.toFixed( 2 ) ) } );
await screenshot( resolve( SHOTS, '05-swim-partial.jpg' ), 'jpeg', 86 );

// 6. dive and ascent: the eye goes through the surface both ways, continuously
await place( 0, 100, - 1.0, Math.PI, 3 );
await setIntent( { pitch: 1, kicks: 0, kickRate: 1.6, burst: false, brake: false, autopilot: false } );
const cBefore = await cam();
const dive = await samples( 2200, 100 );
// ascend nose-up with kicks (the glide alone is too slow to bring the eye back up in a few seconds)
const rise = [];
for ( let i = 0; i < 9; i ++ ) {

	await setIntent( { pitch: - 1, kicks: 1, kickRate: 1.6, kickAmp: 0.7, autopilot: false } ); await sleep( 60 );
	await setIntent( { pitch: - 1, kicks: 0, kickRate: 1.6, autopilot: false } );
	for ( let k = 0; k < 4; k ++ ) { rise.push( await lens() ); await sleep( 100 ); }

}
await setIntent( HOVER );
const path = [ ...dive, ...rise ];
const maxStep = Math.max( ...path.slice( 1 ).map( ( s, i ) => Math.abs( s.eyeY - path[ i ].eyeY ) ) );
const cAfter = await cam();
check( '6 dive: lens goes fully under (medium ≥ 0.98 at the bottom of the dive)', Math.max( ...dive.map( ( s ) => s.water ) ) >= 0.98, { deepest: + Math.min( ...dive.map( ( s ) => s.eyeAboveCam ) ).toFixed( 2 ) } );
// continuity = never a teleport: the rig's MAX_CAM_SPEED cap is 55 m/s (5.5 m per 100 ms sample)
check( '6 dive and ascent: eye crosses the waterline (≥ 2 crossings) and moves continuously (< 5.5 m per 100 ms, the rig\'s speed cap)', cAfter.surfaceCrossings - cBefore.surfaceCrossings >= 2 && maxStep < 5.5, { crossings: cAfter.surfaceCrossings - cBefore.surfaceCrossings, maxStepM: + maxStep.toFixed( 3 ), medium: path.map( ( s ) => + s.water.toFixed( 2 ) ).filter( ( _, i ) => i % 4 === 0 ) } );
await screenshot( resolve( SHOTS, '06-after-ascent.jpg' ), 'jpeg', 86 );

// 7. breach and re-entry
await D( `test.setAssist( 'full' )` );
await place( 0, 110, - 4.0, Math.PI, 6 );
await setIntent( { brake: false, burst: true, pitch: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
await sleep( 700 );
await setIntent( { burst: true, pitch: - 1, kicks: 0, kickRate: 1.6, autopilot: false } );
const cB0 = await cam();
const breach = [];
for ( let i = 0; i < 35; i ++ ) { breach.push( { ...( await lens() ), s: await state() } ); await sleep( 50 ); }
await setIntent( HOVER );
const air = breach.filter( ( b ) => b.s.phase === 'air' );
const cB1 = await cam();
check( '7 breach: the dolphin goes airborne, the lens is in air at the apex, then both return under', air.length > 0 && air.some( ( b ) => b.water < 0.05 ) && breach.at( - 1 ).s.phase === 'swim', { airSamples: air.length, apexY: + Math.max( ...breach.map( ( b ) => b.s.y ) ).toFixed( 2 ), mediumInAir: air.map( ( b ) => + b.water.toFixed( 2 ) ) } );
check( '7 breach: camera states Airborne and SurfaceTransition / ReEntryRecovery, lens crossings counted', breach.some( ( b ) => b.state === 'Airborne' ) && breach.some( ( b ) => b.state === 'SurfaceTransition' || b.state === 'ReEntryRecovery' ) && cB1.surfaceCrossings > cB0.surfaceCrossings, { states: [ ...new Set( breach.map( ( b ) => b.state ) ) ], crossings: cB1.surfaceCrossings - cB0.surfaceCrossings } );
const stepB = Math.max( ...breach.slice( 1 ).map( ( b, i ) => Math.abs( b.eyeY - breach[ i ].eyeY ) ) );
check( '7 breach: camera path continuous (< 2.75 m per 50 ms sample in y — the 55 m/s cap, never a cut)', stepB < 2.75, + stepB.toFixed( 2 ) );
await screenshot( resolve( SHOTS, '07-after-breach.jpg' ), 'jpeg', 86 );

// 8. shoreline terrain and obstacles: the pier shallows with the lens at the mean surface (the
//    shore waves' phase decides when it is crossed: a longer window)
await place( 50, 30, - 1.1, Math.PI, 2 );
await setIntent( { pitch: 0, roll: 0, kicks: 0, kickRate: 1.6, brake: false, burst: false, autopilot: false } );
const c8 = await cam();
const shore = [];
for ( let i = 0; i < 16; i ++ ) {

	await setIntent( { kicks: 1, kickRate: 1.6, kickAmp: 0.6, autopilot: false } ); await sleep( 60 );
	await setIntent( { kicks: 0, kickRate: 1.6, autopilot: false } ); await sleep( 440 );
	const c = await cam(); shore.push( { ...( await lens() ), clear: c.bvhClearanceM, st: c.state } );

}
const shoreCross = shore.at( - 1 ).crossings - c8.surfaceCrossings;
check( '8 pier shallows at the surface: camera clearance from terrain / piles ≥ 0.5 m, no EmergencyRecenter, the surface crosses the lens', shore.every( ( s ) => ( s.clear === undefined || s.clear >= 0.5 ) && s.st !== 'EmergencyRecenter' ) && ( shore.some( split ) || shoreCross >= 1 ), { minClear: + Math.min( ...shore.map( ( s ) => s.clear ?? 99 ) ).toFixed( 2 ), states: [ ...new Set( shore.map( ( s ) => s.st ) ) ], medium: shore.map( ( s ) => + s.water.toFixed( 2 ) ), crossings: shoreCross } );
await screenshot( resolve( SHOTS, '08-pier-shallows.jpg' ), 'jpeg', 86 );
await setIntent( null );

// ---- pristine Tidewater at the same lens pose (free camera, 55° lens): the renderer is the same
// code; this shows the split view is Tidewater's own, not something the dolphin app adds
let pristine = null;
try {

	await navigate( 'http://127.0.0.1:5189/?noAudio&fly' );
	enginePath = '/src/engine';
	await waitFor( '!!(window.__app && window.__app.ui)', { label: 'pristine ready', timeoutMs: 600000 } );
	await dismissStart();
	// the pristine first-play guide (fishing intro) would sit over the view: close it
	await evaluate( `(() => { const g = window.__app.game && window.__app.game.guide; if ( g && g.open ) g.close(); return true; })()` );
	await evaluate( `(() => { const app = window.__app; app.settings.timeOfDay = 14.0; app.setFreeCam( true ); const V = app.fly.camera.position.constructor; app.fly.setPose( new V( ${ pose.p.join( ',' ) } ), ${ pose.yaw }, ${ pose.pitch } ); app.fly.velocity.set( 0, 0, 0 ); app.camera.fov = ${ pose.fov }; app.camera.updateProjectionMatrix(); return true; })()` );
	await sleep( 1500 );
	const pm = [];
	for ( let k = 0; k < 30; k ++ ) { pm.push( await medium() ); if ( k === 8 || k === 16 || k === 24 ) await screenshot( resolve( SHOTS, `03-straddle-pristine-${ ( k - 8 ) / 8 }.jpg` ), 'jpeg', 90 ); await sleep( 250 ); }
	const w = pm.map( ( m ) => + m.water.toFixed( 2 ) );
	pristine = { pose, medium: w, split: pm.filter( split ).length, min: Math.min( ...w ), max: Math.max( ...w ) };
	check( 'pristine Tidewater at the same lens pose and 55° lens shows the same behaviour (the surface sweeps through the lens: split frames, fully-in and fully-out)', pristine.split >= 1 && pristine.max - pristine.min >= 0.5, pristine );

} catch ( e ) {

	check( 'pristine side-by-side captured', false, String( e ) );

} finally {

	enginePath = '/vendor/tidewater/src/engine';
	await navigate( url );
	await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 600000 } );

}

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) && ! /favicon/.test( l ) );
check( 'no console errors during the waterline trials', errors.length === 0, errors.slice( 0, 5 ) );

const summary = { url, at: new Date().toISOString(), passed: results.filter( ( r ) => r.ok ).length, total: results.length, results, pristine };
writeFileSync( resolve( OUT, 'waterline.json' ), JSON.stringify( summary, null, 2 ) );
console.log( `\n${ summary.passed }/${ summary.total } passed → eval/results/waterline.json` );
