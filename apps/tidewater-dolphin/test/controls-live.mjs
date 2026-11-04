// CP10 controls pass — the Modern scheme through REAL input events in the running app: Playwright
// key presses (the production keydown / keyup listeners), mouse drags on the canvas, a simulated
// standard-mapping gamepad injected over navigator.getGamepads, menu interaction and play-mode
// switches with keys held. Paced on the world clock. Results: controls-live.json in eval/results
// (or TIDEWATER_RESULTS_DIR).
//
//   node test/controls-live.mjs   (review window up: node review.mjs [--headless])

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep, press, keydown, keyup, mouseMove, mouseDown, mouseUp, screenshot, consoleLines, status, gameSleep, gameRun, baseUrl, urlFlags, resultsDir, environment } from '../eval/lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resultsDir( resolve( HERE, '..', 'eval', 'results' ) );
const SHOTS = resolve( OUT, 'captures', 'controls' );
mkdirSync( OUT, { recursive: true } );
mkdirSync( SHOTS, { recursive: true } );

const results = [];
const check = ( name, ok, detail ) => { results.push( { name, ok: !! ok, detail } ); console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name }${ detail !== undefined ? ' — ' + ( typeof detail === 'string' ? detail : JSON.stringify( detail ) ) : '' }` ); };
const D = ( expr ) => evaluate( `window.__TIDEWATER_DOLPHIN.${ expr }` );
const state = () => D( 'state()' );
const cam = () => D( 'camera()' );
const hud = () => D( 'hud()' );
const place = ( x, z, y, yaw, speed = 2 ) => D( `test.placeAndFace( ${ x }, ${ z }, ${ y }, ${ yaw }, ${ speed } )` );
const r2 = ( v ) => + v.toFixed( 2 );
const speeds = ( seconds, everyS = 0.25 ) => gameRun( seconds, everyS, async () => ( await state() ).speed );
const releaseAll = async () => { for ( const k of [ 'Space', 'ShiftLeft', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyX' ] ) await keyup( k ); };

const url = `${ baseUrl() }/?noAudio${ urlFlags() }`;
await navigate( url );
await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 1800000 } );
await waitFor( `(() => { const s = document.querySelector( '.tw-start' ); return !! s && ! s.hidden && s.classList.contains( 'is-on' ); })()`, { label: 'start overlay', timeoutMs: 60000 } ).catch( () => {} );
await evaluate( `(() => { const s = document.querySelector( '.tw-start' ); if ( s ) s.click(); return true; })()` );
await sleep( 300 );
await gameSleep( 0.3 );
const env = await environment();
const vp = ( await status() ).viewport || { width: 1440, height: 760 };
console.log( `[controls-live] ${ url } · ${ env.headless ? 'headless' : 'headed' } · adapter ${ env.adapter ? `${ env.adapter.vendor }/${ env.adapter.architecture }` : 'none' }` );
// the Modern scheme, defaults, whatever this browser profile stored before
await D( `setControlPrefs( { profile: 'ecco', inputSource: 'auto', invertY: false, steerSensitivity: 1, lookSensitivity: 1, cameraStyle: 'follow', cameraDistance: 1, fov: 55 } )` );
// keyboard focus on the page (a click on the canvas; in dolphin mode it only resumes audio)
await mouseMove( vp.width / 2, vp.height / 2 );
await mouseDown(); await mouseUp();

// ---------------------------------------------------------------- 1. fresh: keyboard is the idle source
let s = await state();
check( '1 fresh: dolphin controlled, keyboard the idle source, nothing held', s.controlled && s.source === 'keyboard' && s.swimLevel === 0 && s.tracking === 'keyboard', { source: s.source, tracking: s.tracking } );

// ---------------------------------------------------------------- 2. hold Space → cruise; release → glide
await place( 0, 66, - 2.5, Math.PI, 1 );
await keydown( 'Space' );
const rise = await speeds( 2.5, 0.25 );
s = await state();
check( '2 hold Space: cruise within 2.5 s (≥ 4.8 m/s), swimLevel 1, monotone rise', s.speed >= 4.8 && s.swimLevel === 1 && rise.slice( 1 ).every( ( v, i ) => v >= rise[ i ] - 0.05 ), { speeds: rise.map( r2 ), swimLevel: s.swimLevel } );
await keyup( 'Space' );
const glide = await speeds( 3, 0.25 );
check( '2 release Space: smooth glide (every 0.25 s sample lower, none by > 0.6 m/s), ≈ 3 m/s after 3 s', glide.slice( 1 ).every( ( v, i ) => v < glide[ i ] && glide[ i ] - v < 0.6 ) && glide.at( - 1 ) > 2.5 && glide.at( - 1 ) < 3.6, { speeds: glide.map( r2 ) } );
await screenshot( resolve( SHOTS, '01-glide.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- 3. turn, dive, climb (keys)
await keydown( 'Space' ); await gameSleep( 1.5 );
const yaw0 = ( await state() ).yaw;
await keydown( 'KeyD' ); await gameSleep( 1.5 ); await keyup( 'KeyD' );
s = await state();
check( '3 D while swimming: banks right and turns right (yaw +≥ 1.0 rad in 1.5 s)', s.yaw - yaw0 > 1.0 && s.roll > 0.3, { dyaw: r2( s.yaw - yaw0 ), roll: r2( s.roll ) } );
await gameSleep( 1.2 );
const y0 = ( await state() ).y;
await keydown( 'KeyW' ); await gameSleep( 1.0 ); await keyup( 'KeyW' );
s = await state();
check( '3 W: noses down and dives (> 1 m in 1 s)', s.pitch > 0.4 && y0 - s.y > 1, { pitch: r2( s.pitch ), dived: r2( y0 - s.y ) } );
await gameSleep( 1.5 );
s = await state();
check( '3 release W: full assist levels the dolphin (|pitch| < 0.15 after 1.5 s)', Math.abs( s.pitch ) < 0.15, r2( s.pitch ) );
const y1 = s.y;
await keydown( 'KeyS' ); await gameSleep( 0.8 ); await keyup( 'KeyS' );
await gameSleep( 0.6 );
s = await state();
check( '3 S: noses up and climbs', s.y > y1 + 0.3, { climbed: r2( s.y - y1 ), pitch: r2( s.pitch ) } );
await screenshot( resolve( SHOTS, '02-turn-dive.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- 4. charge and release
await place( 0, 70, - 2.5, Math.PI, 4 );
await gameSleep( 0.5 );
await keydown( 'ShiftLeft' );
await gameSleep( 2 );
s = await state();
check( '4 Shift (Space held): charge ≥ 8.5 m/s within 2 s', s.speed >= 8.5, r2( s.speed ) );
await keyup( 'ShiftLeft' );
const ease = await speeds( 3, 0.1 );
const drops = ease.slice( 1 ).map( ( v, i ) => ease[ i ] - v );
check( '4 release Shift (still swimming): eases back to cruise — max drop per 0.1 s < 0.8 m/s, > 5.8 m/s after 0.4 s, 5 ± 0.2 after 3 s', Math.max( ...drops ) < 0.8 && ease[ 4 ] > 5.8 && Math.abs( ease.at( - 1 ) - 5 ) < 0.2, { maxDrop: r2( Math.max( ...drops ) ), speeds: ease.filter( ( _, i ) => i % 4 === 0 ).map( r2 ) } );

// ---------------------------------------------------------------- 5. brake
await keydown( 'KeyX' ); await gameSleep( 1.2 );
s = await state();
check( '5 X (Space still held): brake wins — < 0.5 m/s within 1.2 s', s.speed < 0.5, r2( s.speed ) );
await keyup( 'KeyX' ); await gameSleep( 3 );
s = await state();
check( '5 release X: swims again (> 4 m/s after 3 s)', s.speed > 4, r2( s.speed ) );
await keyup( 'Space' );

// ---------------------------------------------------------------- 6. breach from keys alone
await place( 0, 90, - 3.0, Math.PI, 4 );
await keydown( 'Space' ); await gameSleep( 1.5 );
await keydown( 'KeyS' );
const breach = await gameRun( 3.5, 0.05, async () => { const st = await state(); return { phase: st.phase, y: st.y, breaches: st.breachCount }; } );
await keyup( 'KeyS' );
await gameSleep( 2 );
s = await state();
check( '6 cruise + hold S: breaches (phase air seen, apex > 0.2 m), then swims on', breach.some( ( b ) => b.phase === 'air' ) && Math.max( ...breach.map( ( b ) => b.y ) ) > 0.2 && s.phase === 'swim' && s.breachCount >= 1, { apex: r2( Math.max( ...breach.map( ( b ) => b.y ) ) ), breaches: s.breachCount } );
await keyup( 'Space' );
await screenshot( resolve( SHOTS, '03-after-breach.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- 7. camera keys: V cycles, R recenters
const styles = [];
for ( let i = 0; i < 3; i ++ ) { await press( 'v' ); await gameSleep( 0.2 ); styles.push( await D( 'cameraStyle()' ) ); }
check( '7 V cycles Follow → Remote → Surface → Follow (and the preference follows)', styles.join( ',' ) === 'remote,scenic,follow' && ( await D( 'controlPrefs()' ) ).cameraStyle === 'follow', styles );
await keydown( 'Space' ); await keydown( 'KeyA' ); await gameSleep( 1.2 ); await keyup( 'KeyA' );
const azBefore = ( await cam() ).azimuthErrorRad;
await press( 'r' ); await gameSleep( 0.9 );
const azAfter = ( await cam() ).azimuthErrorRad;
check( '7 R recenters the chase camera behind facing', azAfter < Math.max( 0.12, azBefore * 0.6 ), { before: r2( azBefore ), after: r2( azAfter ) } );

// ---------------------------------------------------------------- 8. mouse drag on the canvas looks; swimming on returns it
const o0 = ( await cam() ).orbitYawRad;
await mouseMove( vp.width / 2, vp.height / 2 );
await mouseDown();
await mouseMove( vp.width / 2 + 200, vp.height / 2, 8 );
await mouseUp();
await gameSleep( 0.1 );
const o1 = ( await cam() ).orbitYawRad;
check( '8 a left-button drag on the canvas orbits the camera (≈ −0.44 rad for 200 px)', Math.abs( ( o1 - o0 ) + 200 * 0.0022 ) < 0.08, { orbit: r2( o1 - o0 ) } );
await gameSleep( 5 );
check( '8 swimming on, the look returns behind the dolphin by itself (|orbit| < 0.12 rad after 5 s)', Math.abs( ( await cam() ).orbitYawRad ) < 0.12, r2( ( await cam() ).orbitYawRad ) );
await keyup( 'Space' );
await screenshot( resolve( SHOTS, '04-after-look.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- 9. a simulated standard gamepad
await evaluate( `(() => {
	const buttons = Array.from( { length: 17 }, () => ( { pressed: false, touched: false, value: 0 } ) );
	const pad = { id: 'Simulated Standard Gamepad (STANDARD GAMEPAD Vendor: 0000 Product: 0000)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [ 0, 0, 0, 0 ], buttons, vibrationActuator: null, hapticActuators: [] };
	const orig = navigator.getGamepads ? navigator.getGamepads.bind( navigator ) : () => [];
	window.__simPad = { pad, on: false };
	navigator.getGamepads = () => window.__simPad.on ? [ pad, null, null, null ] : orig();
	window.__padSet = ( i, v ) => { const b = pad.buttons[ i ]; b.pressed = v > 0.05; b.touched = v > 0; b.value = v; pad.timestamp = performance.now(); };
	window.__padAxis = ( i, v ) => { pad.axes[ i ] = v; pad.timestamp = performance.now(); };
	window.__padOn = ( on ) => { window.__simPad.on = !! on; };
	return true; })()` );
const padSet = ( i, v ) => evaluate( `window.__padSet( ${ i }, ${ v } )` );
const padAxis = ( i, v ) => evaluate( `window.__padAxis( ${ i }, ${ v } )` );
const padOn = ( on ) => evaluate( `window.__padOn( ${ on } )` );
const RT = 7, A = 0, LB = 4, LT = 6, Y = 3, START = 9, BACK = 8, RS = 11;
await place( 0, 66, - 2.5, Math.PI, 1 );
await padOn( true ); await gameSleep( 0.2 );
check( '9 pad connected (idle): reported, keyboard still the idle owner', ( await hud() ).padConnected && ( await state() ).source === 'keyboard' );
await padSet( RT, 1 ); await gameSleep( 2.5 );
s = await state();
check( '9 RT held: the pad owns the dolphin, cruise within 2.5 s', s.source === 'gamepad' && s.tracking === 'gamepad' && s.speed >= 4.8 && s.swimLevel === 1, { source: s.source, speed: r2( s.speed ) } );
await padSet( RT, 0.4 ); await gameSleep( 6 );
s = await state();
check( '9 RT at 40 %: sustained speed follows the trigger (≈ 3.0 m/s)', Math.abs( s.speed - 3.04 ) < 0.25 && s.swimLevel > 0.2 && s.swimLevel < 0.5, { speed: r2( s.speed ), level: r2( s.swimLevel ) } );
await padSet( RT, 1 ); await padSet( LB, 1 ); await gameSleep( 2 );
check( '9 LB: charge (> 8 m/s)', ( await state() ).speed > 8, r2( ( await state() ).speed ) );
await padSet( LB, 0 ); await padSet( LT, 1 ); await gameSleep( 1.2 );
check( '9 LT: brake (< 0.6 m/s in 1.2 s with RT still held)', ( await state() ).speed < 0.6, r2( ( await state() ).speed ) );
await padSet( LT, 0 ); await padSet( RT, 0 ); await padSet( A, 1 ); await gameSleep( 2.5 );
check( '9 A also swims (cruise again)', ( await state() ).speed > 4.5 && ( await state() ).swimLevel === 1, r2( ( await state() ).speed ) );
const yawP = ( await state() ).yaw;
await padAxis( 0, 1 ); await gameSleep( 1.2 ); await padAxis( 0, 0 );
check( '9 left stick right: turns right', ( await state() ).yaw - yawP > 0.8, r2( ( await state() ).yaw - yawP ) );
await gameSleep( 1 );
await padAxis( 1, - 1 ); await gameSleep( 0.6 );
check( '9 left stick forward: noses DOWN (dive), like W', ( await state() ).pitch > 0.3, r2( ( await state() ).pitch ) );
await padAxis( 1, 0 ); await gameSleep( 1.5 );
const oP = ( await cam() ).orbitYawRad;
await padAxis( 2, 1 ); await gameSleep( 0.5 ); await padAxis( 2, 0 );
check( '9 right stick looks (orbit moved ≥ 0.3 rad in 0.5 s)', Math.abs( ( await cam() ).orbitYawRad - oP ) > 0.3, r2( ( await cam() ).orbitYawRad - oP ) );
const style0 = await D( 'cameraStyle()' );
await padSet( Y, 1 ); await gameSleep( 0.15 ); await padSet( Y, 0 ); await gameSleep( 0.15 );
check( '9 Y cycles the camera style', ( await D( 'cameraStyle()' ) ) !== style0, await D( 'cameraStyle()' ) );
await D( `setCameraStyle( 'follow' )` );
await padSet( RS, 1 ); await gameSleep( 0.15 ); await padSet( RS, 0 );
check( '9 right-stick click recenters', ( await cam() ).recenterActiveS > 0 || Math.abs( ( await cam() ).orbitYawRad ) < 1e-6 );
await padSet( START, 1 ); await gameSleep( 0.15 ); await padSet( START, 0 ); await gameSleep( 0.15 );
const panelOpen = await evaluate( 'window.__ui.panelOpen' );
await padSet( START, 1 ); await gameSleep( 0.15 ); await padSet( START, 0 ); await gameSleep( 0.15 );
check( '9 Start toggles the settings panel (open, then closed)', panelOpen === true && ( await evaluate( 'window.__ui.panelOpen' ) ) === false );
await padSet( BACK, 1 ); await gameSleep( 0.15 ); await padSet( BACK, 0 ); await gameSleep( 0.15 );
const helpOpen = await evaluate( 'window.__ui.helpOpen' );
await padSet( BACK, 1 ); await gameSleep( 0.15 ); await padSet( BACK, 0 ); await gameSleep( 0.15 );
check( '9 Back toggles the controls sheet (open, then closed)', helpOpen === true && ( await evaluate( 'window.__ui.helpOpen' ) ) === false );
check( '9 the HUD prompt names the pad bindings while the pad swims', /RT|swims/.test( await evaluate( `window.__ui && window.__ui.promptEl ? window.__ui.promptEl.textContent : ''` ) ), await evaluate( `window.__ui && window.__ui.promptEl ? window.__ui.promptEl.textContent : ''` ) );
// keyboard camera keys never take the dolphin from the pad
await press( 'v' ); await press( 'r' ); await gameSleep( 0.2 );
check( '9 V / R on the keyboard while the pad swims leave the pad in control', ( await state() ).source === 'gamepad', ( await state() ).source );
await D( `setCameraStyle( 'follow' )` );
// unplug mid-hold
await padOn( false ); await gameSleep( 0.2 );
s = await state();
check( '9 pad unplugged mid-hold: keyboard owner, nothing stuck (swimLevel 0, pad gone)', s.source === 'keyboard' && s.swimLevel === 0 && ! ( await hud() ).padConnected, { source: s.source, swimLevel: s.swimLevel } );
await screenshot( resolve( SHOTS, '05-pad.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- 10. keyboard and pad together: last touched wins
await padOn( true ); await padSet( A, 1 ); await gameSleep( 0.5 );
await keydown( 'Space' ); await gameSleep( 0.3 );
check( '10 a key press takes the dolphin from a swimming pad', ( await state() ).source === 'keyboard' );
await keyup( 'Space' ); await gameSleep( 0.3 );
check( '10 key released, pad still held: the pad has it back at once', ( await state() ).source === 'gamepad' );
await padSet( A, 0 ); await padOn( false ); await gameSleep( 0.3 );

// ---------------------------------------------------------------- 11. menus while swimming
await press( 'h' ); await gameSleep( 0.2 );
await keydown( 'Space' ); await gameSleep( 1.5 );
s = await state();
check( '11 settings panel open: Space still swims the dolphin (panel does not steal game keys)', ( await evaluate( 'window.__ui.panelOpen' ) ) === true && s.swimLevel === 1 && s.speed > 3, { speed: r2( s.speed ) } );
await press( 'h' ); await gameSleep( 0.2 );
await press( 'F1' ); await gameSleep( 0.2 );
check( '11 F1 opens the controls sheet while swimming; Escape closes it', ( await evaluate( 'window.__ui.helpOpen' ) ) === true );
await press( 'Escape' ); await gameSleep( 0.2 );
check( '11 …closed', ( await evaluate( 'window.__ui.helpOpen' ) ) === false );

// ---------------------------------------------------------------- 12. play-mode switches with a key held
await evaluate( `window.__app.setPlayerMode( 'walk' )` ); await gameSleep( 0.4 );
s = await state();
check( '12 switch to Walking with Space held: dolphin released, no swim input leaks (swimLevel 0)', ! s.controlled && s.swimLevel === 0, { controlled: s.controlled, swimLevel: s.swimLevel } );
await evaluate( `window.__app.setPlayerMode( 'dolphin' )` ); await gameSleep( 0.4 );
s = await state();
check( '12 back to Dolphin with Space still physically held: nothing stuck — a fresh press is needed', s.controlled && s.swimLevel === 0, { swimLevel: s.swimLevel } );
await keyup( 'Space' ); await keydown( 'Space' ); await gameSleep( 1 );
check( '12 …and the fresh press swims', ( await state() ).swimLevel === 1 && ( await state() ).speed > 2 );
await keyup( 'Space' );

// ---------------------------------------------------------------- 13. Legacy scheme through the preferences
await D( `setControlPrefs( { profile: 'legacy' } )` ); await gameSleep( 0.2 );
const k0 = ( await state() ).kickCount;
await press( 'ShiftLeft' ); await gameSleep( 0.3 );
check( '13 Legacy: a Shift tap is one kick', ( await state() ).kickCount === k0 + 1, ( await state() ).kickCount - k0 );
const v0 = ( await state() ).speed;
await keydown( 'Space' ); await gameSleep( 1.5 ); await keyup( 'Space' );
check( '13 Legacy: Space is the burst (speed rose > 2 m/s in 1.5 s)', ( await state() ).speed > v0 + 2, { from: r2( v0 ), to: r2( ( await state() ).speed ) } );
await D( `setControlPrefs( { profile: 'ecco' } )` );
await releaseAll();

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) && ! /favicon/.test( l ) );
check( 'no console errors during the live control trials', errors.length === 0, errors.slice( 0, 5 ) );

const summary = { url, at: new Date().toISOString(), environment: env, passed: results.filter( ( r ) => r.ok ).length, total: results.length, results };
writeFileSync( resolve( OUT, 'controls-live.json' ), JSON.stringify( summary, null, 2 ) );
console.log( `\n${ summary.passed }/${ summary.total } passed → ${ resolve( OUT, 'controls-live.json' ) }` );
