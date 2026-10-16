// CP10 gameplay verification — drives the persistent review window (review.mjs) running the
// integrated app at http://127.0.0.1:5199/?noAudio and checks the dolphin's model, animation,
// swimming, breach, camera states, containment / collision and replay determinism through the
// eval handle (window.__TIDEWATER_DOLPHIN), the same way the shared-world specs used
// __SHARED_WORLD. Intents go through test.setIntent (deterministic; the keyboard path depends
// on OS key auto-repeat, which synthetic events do not produce). Results: eval/results/play.json.
//
//   node test/play.mjs            (review window must be up: node review.mjs)

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep, press, screenshot, consoleLines } from '../eval/lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resolve( HERE, '..', 'eval', 'results' );
const SHOTS = resolve( HERE, '..', 'eval', 'captures', 'play' );
mkdirSync( OUT, { recursive: true } );
mkdirSync( SHOTS, { recursive: true } );

const results = [];
const check = ( name, ok, detail ) => { results.push( { name, ok: !! ok, detail } ); console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name }${ detail !== undefined ? ' — ' + ( typeof detail === 'string' ? detail : JSON.stringify( detail ) ) : '' }` ); };
const D = ( expr ) => evaluate( `window.__TIDEWATER_DOLPHIN.${ expr }` );
const state = () => D( 'state()' );
const cam = () => D( 'camera()' );
const setIntent = ( p ) => D( `test.setIntent( ${ JSON.stringify( p ) } )` );
const kick = ( amp = 0.8 ) => D( `test.kick( ${ amp } )` );
const place = ( x, z, y, yaw, speed = 4 ) => D( `test.placeAndFace( ${ x }, ${ z }, ${ y }, ${ yaw }, ${ speed } )` );

// sample the state every `every` ms for `ms`, returning the samples
async function run( ms, every = 100 ) {

	const out = [];
	const t0 = Date.now();
	while ( Date.now() - t0 < ms ) {

		out.push( { t: ( Date.now() - t0 ) / 1000, s: await state(), c: await cam() } );
		await sleep( every );

	}

	return out;

}

const url = 'http://127.0.0.1:5199/?noAudio';
await navigate( url );
await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 600000 } );
// dismiss the start overlay once it is up (it appears after the loader fades), keep the keyboard focus on the page
await waitFor( `(() => { const s = document.querySelector( '.tw-start' ); return !! s && ! s.hidden && s.classList.contains( 'is-on' ); })()`, { label: 'start overlay', timeoutMs: 30000 } ).catch( () => {} );
await evaluate( `(() => { const s = document.querySelector( '.tw-start' ); if ( s ) s.click(); return true; })()` );
await sleep( 900 );

// ---------------------------------------------------------------- model / animation
const first = await D( 'firstFrame()' );
check( 'first rendered frame had SwimForward running (no rest pose)', first && first.actionRunning && first.base === 'SwimForward', first );
const model = await D( 'model' );
const clips = await D( 'model.clipNames' );
check( 'all 8 clips present', [ 'SwimForward', 'SwimForwardFast', 'SwimLeft', 'SwimRight', 'SwimUp', 'SwimDown', 'BreatheSurface', 'Jump' ].every( ( c ) => clips.includes( c ) ), clips );
check( '17 joints bound', model.joints === 17, model.joints );
const len = await D( 'model.measuredLengthM' );
check( 'measured SwimForward-frame-0 length within 2.89 m ± 2 %', Math.abs( len - 2.89 ) / 2.89 <= 0.02, len.toFixed( 4 ) );
const bounds = await D( 'model.bounds()' );
check( 'posed world bounds are finite and ~0.85 m wide', bounds.max[ 0 ] - bounds.min[ 0 ] > 0.7 && bounds.max[ 0 ] - bounds.min[ 0 ] < 1.1, bounds );
const add = await D( 'model.additive()' );
check( 'four additive layers (SwimLeft/Right/Up/Down) advancing', add.length === 4 && add.every( ( a ) => a.time >= 0 ), add.map( ( a ) => a.clip ) );

// ---------------------------------------------------------------- swimming
await place( 0, 66, - 2.5, Math.PI, 2 );
await setIntent( { kicks: 0, kickRate: 1.6, pitch: 0, roll: 0, burst: false, brake: false, autopilot: false } );
// steady kicks: exactly one kick every 0.6 s (test.kick is a one-shot, frame-rate independent)
let s0 = await state();
for ( let i = 0; i < 10; i ++ ) { await kick( 0.8 ); await sleep( 600 ); }
let s1 = await state();
check( 'kicks propel (10 kicks over 6 s → speed > 2.5 m/s, kickCount +10)', s1.speed > 2.5 && s1.kickCount - s0.kickCount === 10, { speed: + s1.speed.toFixed( 2 ), kicks: s1.kickCount - s0.kickCount, anim: s1.animation.base } );
check( 'travelled north toward the island (z decreased)', s1.z < s0.z - 8, { dz: + ( s1.z - s0.z ).toFixed( 1 ) } );
check( 'sim runs at 120 Hz', s1.simHz > 110 && s1.simHz < 130, + s1.simHz.toFixed( 1 ) );
check( 'camera NormalFollow while cruising', ( await cam() ).state === 'NormalFollow', ( await cam() ).state );
await screenshot( resolve( SHOTS, '01-cruise.jpg' ), 'jpeg', 86 );

// burst
await setIntent( { burst: true, kicks: 0, kickRate: 0, autopilot: false } );
await sleep( 2500 );
s1 = await state();
const c1 = await cam();
check( 'burst reaches > 8 m/s and SwimForwardFast', s1.speed > 8 && s1.animation.base === 'SwimForwardFast', { speed: + s1.speed.toFixed( 2 ), anim: s1.animation.base } );
check( 'camera FastTravel above 5 m/s', c1.state === 'FastTravel', c1.state );
check( 'follow distance grows with speed (> 6 m)', c1.desiredDistM > 6, + c1.desiredDistM.toFixed( 2 ) );
await screenshot( resolve( SHOTS, '02-burst.jpg' ), 'jpeg', 86 );

// brake → hover
await setIntent( { burst: false, brake: true, kicks: 0, kickRate: 0, autopilot: false } );
await sleep( 1500 );
s1 = await state();
await sleep( 1200 );
// (SurfaceTransition / ReEntryRecovery outrank SlowHover for ≤ 0.6 s: sample three times)
const hoverStates = [];
for ( let i = 0; i < 3; i ++ ) { hoverStates.push( ( await cam() ).state ); await sleep( 300 ); }
check( 'brake: cruise → < 0.5 m/s within 1.5 s', s1.speed < 0.5, + s1.speed.toFixed( 2 ) );
check( 'camera SlowHover when stopped', hoverStates.filter( ( s ) => s === 'SlowHover' ).length >= 2, hoverStates );

// turn: bank right with kicks
await setIntent( { brake: false, roll: 1, kicks: 0, kickRate: 1.6, autopilot: false } );
const yaw0 = ( await state() ).yaw;
for ( let i = 0; i < 5; i ++ ) { await kick( 0.8 ); await sleep( 500 ); }
s1 = await state();
const addT = await D( 'model.additive()' );
check( 'banking right turns right (yaw +) with roll ≈ ROLL_MAX', s1.yaw - yaw0 > 0.8 && s1.roll > 0.6, { dyaw: + ( s1.yaw - yaw0 ).toFixed( 2 ), roll: + s1.roll.toFixed( 2 ) } );
check( 'SwimRight additive layer weighted while banking right', addT.find( ( a ) => a.clip === 'SwimRight' ).weight > 0.5 && addT.find( ( a ) => a.clip === 'SwimLeft' ).weight === 0, addT.map( ( a ) => `${ a.clip }:${ a.weight.toFixed( 2 ) }` ) );
check( 'camera roll couples to bank (0.10 ×, opposite sign)', Math.abs( ( await cam() ).rollRad + s1.roll * 0.10 ) < 0.02, + ( await cam() ).rollRad.toFixed( 3 ) );
await screenshot( resolve( SHOTS, '03-bank.jpg' ), 'jpeg', 86 );

// dive and surface
await place( 0, 90, - 2.5, Math.PI, 4 );
await setIntent( { roll: 0, pitch: 1, kicks: 0, kickRate: 1.6, autopilot: false } );
await sleep( 2500 );
s1 = await state();
check( 'pitch + dives (y below −5 m in 2.5 s from −2.5 m)', s1.y < - 5, { y: + s1.y.toFixed( 2 ), depthHere: + s1.depthHere.toFixed( 1 ) } );
check( 'seabed clearance kept (y − floor ≥ 1.0 m)', s1.y + s1.depthHere >= 1.0, + ( s1.y + s1.depthHere ).toFixed( 2 ) );
// surface gently: expert assist (no auto-level), ~38° nose-up held, kick propulsion (~3 m/s, below the
// breach threshold of 3.75 m/s + 3.2 m/s vertical), then level and brake at the soft ceiling
await D( `test.setAssist( 'expert' )` );
await place( 0, 85, - 7.0, Math.PI, 3 ); // level pose at depth (the dive left the pitch at its +85° cap)
await setIntent( { pitch: - 1, kicks: 0, kickRate: 1.6, autopilot: false } );
await sleep( 450 );
await setIntent( { pitch: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
for ( let i = 0; i < 7; i ++ ) { await kick( 0.6 ); await sleep( 600 ); }
await setIntent( { pitch: 1, kicks: 0, kickRate: 0, autopilot: false } );
await sleep( 450 );
await setIntent( { pitch: 0, brake: true, kicks: 0, kickRate: 0, autopilot: false } );
await sleep( 600 );
s1 = await state();
check( 'gentle nose-up with kicks surfaces to the soft ceiling (y ≈ −0.4, no breach)', s1.y > - 1.0 && s1.y <= - 0.3 && s1.phase === 'swim', { y: + s1.y.toFixed( 2 ), breaches: s1.breachCount } );
check( 'swell ride: rendered y differs from sim y by the measured wave height near the surface', Math.abs( ( s1.renderY - s1.y ) - s1.waterlineM ) < 0.05, { renderY: + s1.renderY.toFixed( 2 ), y: + s1.y.toFixed( 2 ), wl: + s1.waterlineM.toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '04-surface.jpg' ), 'jpeg', 86 );

// surface breathing: hold near the surface slowly for > 2 s (|y| < 0.6 m, speed < 1.5 m/s)
await sleep( 2800 );
s1 = await state();
check( 'BreatheSurface after > 2 s slow near the surface', s1.animation.base === 'BreatheSurface', { anim: s1.animation.base, y: + s1.y.toFixed( 2 ), speed: + s1.speed.toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '04b-breathe.jpg' ), 'jpeg', 86 );
await D( `test.setAssist( 'full' )` );

// breach: burst at depth, then nose up hard near the surface
await place( 0, 100, - 4.0, Math.PI, 6 );
await setIntent( { brake: false, burst: true, pitch: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
await sleep( 700 );
await setIntent( { burst: true, pitch: - 1, kicks: 0, kickRate: 1.6, autopilot: false } );
const breachSamples = await run( 3500, 50 );
await setIntent( { burst: false, pitch: 0, kicks: 0, kickRate: 0, autopilot: false } );
const airS = breachSamples.filter( ( x ) => x.s.phase === 'air' );
const camStates = new Set( breachSamples.map( ( x ) => x.c.state ) );
const maxY = Math.max( ...breachSamples.map( ( x ) => x.s.y ) );
const sEnd = breachSamples[ breachSamples.length - 1 ].s;
check( 'breach: phase air observed, apex above the surface, back to swim', airS.length > 0 && maxY > 0.3 && sEnd.phase === 'swim' && sEnd.breachCount >= 1, { airFrames: airS.length, apexY: + maxY.toFixed( 2 ), breaches: sEnd.breachCount, splashes: sEnd.splashes } );
check( 'Jump clip during the breach, SwimForward after re-entry', airS.some( ( x ) => x.s.animation.base === 'Jump' ) && sEnd.animation.base !== 'Jump', [ ...new Set( breachSamples.map( ( x ) => x.s.animation.base ) ) ] );
check( 'camera Airborne / SurfaceTransition / ReEntryRecovery states seen', camStates.has( 'Airborne' ) && ( camStates.has( 'ReEntryRecovery' ) || camStates.has( 'SurfaceTransition' ) ), [ ...camStates ] );
check( 'camera lifted above the waterline while airborne', airS.some( ( x ) => x.c.y > x.s.waterlineM + 0.3 ), airS.length ? + Math.max( ...airS.map( ( x ) => x.c.y ) ).toFixed( 2 ) : null );
const maxStep = Math.max( ...breachSamples.slice( 1 ).map( ( x, i ) => Math.hypot( x.c.x - breachSamples[ i ].c.x, x.c.y - breachSamples[ i ].c.y, x.c.z - breachSamples[ i ].c.z ) ) );
check( 'camera path continuous through the breach (< 2.8 m per 50 ms sample)', maxStep < 2.8, + maxStep.toFixed( 2 ) );
await screenshot( resolve( SHOTS, '05-after-breach.jpg' ), 'jpeg', 86 );

// recenter: offset the camera azimuth with a hard turn, then R
await setIntent( { roll: 1, kicks: 0, kickRate: 1.6, burst: true, autopilot: false } );
await sleep( 900 );
await setIntent( { roll: 0, burst: false, kicks: 0, kickRate: 0, autopilot: false } );
const azBefore = ( await cam() ).azimuthErrorRad;
await press( 'r' );
await sleep( 900 );
const azAfter = ( await cam() ).azimuthErrorRad;
check( 'R recenter eases the camera behind facing', azAfter < Math.max( 0.12, azBefore * 0.6 ), { before: + azBefore.toFixed( 2 ), after: + azAfter.toFixed( 2 ) } );

// ---------------------------------------------------------------- containment
// toward the beach from the bay (north): the dolphin must stop short of the shallows and never leave the water
await place( 0, 40, - 2.0, Math.PI, 5 );
await setIntent( { burst: true, pitch: 0, roll: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
const shoreRun = await run( 9000, 150 );
await setIntent( { burst: false, kicks: 0, kickRate: 0, autopilot: false } );
const minZ = Math.min( ...shoreRun.map( ( x ) => x.s.z ) );
const shallowest = Math.min( ...shoreRun.map( ( x ) => x.s.depthHere ) );
check( 'beach approach: always in water, never shallower than ~1.6 m, turned back by the containment current', shoreRun.every( ( x ) => x.s.inWater ) && shallowest >= 1.55, { minZ: + minZ.toFixed( 1 ), shallowestDepth: + shallowest.toFixed( 2 ), minShoreDist: + Math.min( ...shoreRun.map( ( x ) => x.s.shoreDist ) ).toFixed( 1 ) } );
check( 'beach approach: no seabed penetration (y − floor ≥ 0.9 m throughout)', shoreRun.every( ( x ) => x.s.y + x.s.depthHere >= 0.9 ), + Math.min( ...shoreRun.map( ( x ) => x.s.y + x.s.depthHere ) ).toFixed( 2 ) );
check( 'beach approach: camera never clips the seabed (clearance ≥ 0.5 m)', shoreRun.every( ( x ) => x.c.bvhClearanceM === undefined || x.c.bvhClearanceM >= 0.5 ), + Math.min( ...shoreRun.map( ( x ) => x.c.bvhClearanceM ?? 99 ) ).toFixed( 2 ) );
await screenshot( resolve( SHOTS, '06-shallows.jpg' ), 'jpeg', 86 );

// reef: cross the reef westward at 2.3 m depth
await place( - 20, 70, - 2.3, - Math.PI / 2, 4 );
await setIntent( { pitch: 0, roll: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
const reefRun = await run( 9000, 120 );
const reefCorr = await D( 'world.obstacleStats()' );
check( 'reef crossing: no structure penetration (y − ground ≥ 0.8 m), always in water', reefRun.every( ( x ) => x.s.y + x.s.depthHere >= 0.8 && x.s.inWater ), { minClear: + Math.min( ...reefRun.map( ( x ) => x.s.y + x.s.depthHere ) ).toFixed( 2 ), xEnd: + reefRun.at( - 1 ).s.x.toFixed( 1 ), contact: await D( 'test.contactState()' ) } );
const camClip = Math.min( ...reefRun.map( ( x ) => x.c.bvhClearanceM ?? 99 ) );
check( 'reef crossing: camera clearance ≥ 0.5 m, no EmergencyRecenter', camClip >= 0.5 && reefRun.every( ( x ) => x.c.state !== 'EmergencyRecenter' ), { minCamClear: + camClip.toFixed( 2 ), states: [ ...new Set( reefRun.map( ( x ) => x.c.state ) ) ] } );
await screenshot( resolve( SHOTS, '07-reef.jpg' ), 'jpeg', 86 );

// pier piles: swim along the pier from its head toward the beach (piles at x ≈ 53.5 / 56.5)
await place( 55, 38, - 2.2, Math.PI, 3 );
await setIntent( { pitch: 0, roll: 0, kicks: 0, kickRate: 1.6, autopilot: false } );
for ( let i = 0; i < 6; i ++ ) { await kick( 0.8 ); await sleep( 700 ); }
const pierRun = await run( 3000, 120 );
const pierCorr = await D( 'world.obstacleStats()' );
const piles = await evaluate( `window.__app.colliders.cylinders.filter( ( c ) => c.tag === 'pile' ).map( ( c ) => [ c.x, c.z, c.radius ] )` );
const insidePile = pierRun.some( ( x ) => piles.some( ( [ px, pz, r ] ) => Math.hypot( x.s.x - px, x.s.z - pz ) < r + 0.2 ) );
check( 'pier: the dolphin\'s centre never enters a pile (obstacle correction active)', ! insidePile, { corrections: pierCorr.corrections - reefCorr.corrections, lastCorrectionM: + pierCorr.lastCorrectionM.toFixed( 3 ), usAvg: + pierCorr.usAvg.toFixed( 0 ) } );
await screenshot( resolve( SHOTS, '08-pier.jpg' ), 'jpeg', 86 );

// ---------------------------------------------------------------- tracking loss / autopilot
await setIntent( null );
await sleep( 2000 );
s1 = await state();
check( 'no input → tracking "none", autopilot glide (pitch/roll level, speed decaying, still in water)', s1.tracking === 'none' && Math.abs( s1.pitch ) < 0.2 && Math.abs( s1.roll ) < 0.2 && s1.inWater, { tracking: s1.tracking, speed: + s1.speed.toFixed( 2 ) } );
const tr = await D( 'transport()' );
check( 'body-input transport listening (BroadcastChannel + postMessage), nothing received', tr.gotBroadcast === false && tr.gotMessage === false && tr.lastTs === - 1, tr );

// ---------------------------------------------------------------- determinism
const script = [ { steps: 240, intent: { kicks: 1, kickRate: 1.6, kickAmp: 0.8 } }, { steps: 240, intent: { burst: true } }, { steps: 240, intent: { roll: 1 } }, { steps: 240, intent: { pitch: 1 } }, { steps: 480, intent: { pitch: - 1, burst: true } }, { steps: 240, intent: {} } ];
const d1 = await D( `test.runScript( ${ JSON.stringify( script ) } )` );
const d2 = await D( `test.runScript( ${ JSON.stringify( script ) } )` );
check( 'fixed-step replay digest identical across two runs', d1 === d2, d1.slice( 0, 60 ) + '…' );
const dNo = await D( `test.runScript( ${ JSON.stringify( script ) }, false )` );
check( 'replay digest with obstacle correction = bare sim away from obstacles (spawn run)', dNo === d1, dNo === d1 ? 'identical' : 'differs (obstacle contact in the script path)' );

// ---------------------------------------------------------------- live performance (visible window)
await place( 0, 66, - 2.5, Math.PI, 4 );
await setIntent( { kicks: 0, kickRate: 1.6, autopilot: false } );
const fpsSamples = [];
for ( let i = 0; i < 10; i ++ ) { await sleep( 1000 ); fpsSamples.push( await evaluate( 'window.__app.fps' ) ); }
const cpuMs = await evaluate( 'window.__app.cpuMs' );
const size = await evaluate( '[ window.__app.sceneRenderer.width, window.__app.sceneRenderer.height, innerWidth, innerHeight, devicePixelRatio ]' );
const fpsMed = fpsSamples.slice().sort( ( a, b ) => a - b )[ 5 ];
check( 'live fps measured (visible 1440×760 review window)', fpsMed > 0, { median: + fpsMed.toFixed( 1 ), min: + Math.min( ...fpsSamples ).toFixed( 1 ), cpuMs: + cpuMs.toFixed( 2 ), renderSize: size } );
const camCost = ( await cam() ).updateUsAvg;
check( 'camera rig update cost < 400 µs', camCost < 400, + camCost.toFixed( 0 ) );

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) && ! /favicon/.test( l ) );
check( 'no console errors during the trials', errors.length === 0, errors.slice( 0, 5 ) );

const summary = { url, at: new Date().toISOString(), passed: results.filter( ( r ) => r.ok ).length, total: results.length, results, fps: { samples: fpsSamples, median: fpsMed, cpuMs, size } };
writeFileSync( resolve( OUT, 'play.json' ), JSON.stringify( summary, null, 2 ) );
console.log( `\n${ summary.passed }/${ summary.total } passed → eval/results/play.json` );
