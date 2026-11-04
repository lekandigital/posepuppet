// CP10 — play modes, fishing activity and scenery additions, verified live.
//
// Drives the review window (review.mjs, headed or --headless) running the integrated app: fresh launch
// is the dolphin with fishing off; Dolphin → Walking → Boat → Dolphin and repeated switching through
// the app's own menu action (the same `setPlayerMode` the Play tab's control calls), valid spawn /
// return positions, one input owner and one camera owner at a time, the lens following the owner,
// no world re-initialisation (the ocean clock, FFT, terrain, reef, whale, wildlife and the dolphin
// rig are the same objects before and after), no duplicated resources; fishing off by default, on
// through the menu in Walking, never in Dolphin mode, off again restores plain walking with the
// stalls still there; the scenery additions toggle (Original / Enhanced, per category) with
// deterministic placements. Paced on the world clock (CP10 controls pass). Results: modes.json in
// eval/results (or TIDEWATER_RESULTS_DIR), images under captures/modes/.
//
//   node test/modes.mjs        (review window up: node review.mjs [--headless]; dev server on :5199)

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep, screenshot, consoleLines, press, gameSleep, baseUrl, urlFlags, resultsDir, environment } from '../eval/lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resultsDir( resolve( HERE, '..', 'eval', 'results' ) );
const SHOTS = resolve( OUT, 'captures', 'modes' );
mkdirSync( OUT, { recursive: true } );
mkdirSync( SHOTS, { recursive: true } );

const results = [];
const check = ( name, ok, detail ) => { results.push( { name, ok: !! ok, detail } ); console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name }${ detail !== undefined ? ' — ' + ( typeof detail === 'string' ? detail : JSON.stringify( detail ) ) : '' }` ); };
const A = ( expr ) => evaluate( `(() => { const app = window.__app; const d = window.__TIDEWATER_DOLPHIN; return ( ${ expr } ); })()` );
const snapshot = () => A( `{
	mode: app.playerMode, displayed: app.displayedMode, player: app.player.mode, camMode: app.player.camMode, fishing: app.fishing, fishingActive: app.fishingActive,
	driven: app.boatCtl.driven, moored: app.boatCtl.moored, fov: app.camera.fov, freeCam: app.freeCam, locked: !! document.pointerLockElement,
	cam: [ app.camera.position.x, app.camera.position.y, app.camera.position.z ], camWater: app.cameraWaterHeight ?? 0,
	walker: [ app.player.position.x, app.player.position.y, app.player.position.z ], boat: [ app.boatCtl.position.x, app.boatCtl.position.y, app.boatCtl.position.z ],
	dolphin: d.state(), controlled: d.state().controlled, rodEquipped: app.game.rod.equipped, rodVisible: app.game.rod.rodMesh.visible,
	hud: !! app.game.hud, hudShown: app.game.hud ? app.game.hud.purse.style.display !== 'none' : null, minimapShown: app.game.minimap ? app.game.minimap.el.style.display !== 'none' : null,
	guideOpen: !! ( app.game.guide && app.game.guide.open ), stalls: !! ( app.stand && app.chandlery && app.vendors.length === 2 ),
	ground: Math.max( app.terrainData.heightAt( app.player.position.x, app.player.position.z ), app.colliders.groundHeightAt( app.player.position.x, app.player.position.z, 50 ) ),
	coast: app.terrainData.coastDistance( app.player.position.x, app.player.position.z ).d,
	additions: app.additions.stats(), switches: app.modeSwitches, chaseFov: d.controlPrefs().fov,
}` );
// identities of the world's systems: the same objects after every switch (nothing is rebuilt)
const worldIds = () => A( `(() => { const w = window; w.__ids = w.__ids || new WeakMap(); const id = ( o ) => { if ( ! w.__ids.has( o ) ) { w.__idN = ( w.__idN || 0 ) + 1; w.__ids.set( o, w.__idN ); } return w.__ids.get( o ); };
	return { fft: id( app.fft ), surface: id( app.surface ), ocean: id( app.ocean ), terrain: id( app.terrain ), reef: id( app.reef ), whale: app.whale ? id( app.whale ) : null, wildlife: id( app.wildlife ), sky: id( app.sky ), clouds: app.clouds ? id( app.clouds ) : null, post: id( app.post ), rig: id( app.dolphin.rig ), actor: id( app.dolphin.actor ), player: id( app.player ), boat: id( app.boatCtl ), game: id( app.game ), audio: app.audio ? id( app.audio ) : null, scene: app.scene.children.length, time: app.settings.timeOfDay }; })()` );
const setMode = ( m ) => A( `app.setPlayerMode( '${ m }' )` );
const panelSelect = async ( value ) => {

	// through the Play tab's segmented control itself (the real menu path)
	return evaluate( `(() => { const ui = window.__app.ui; const c = ui.modeCtl; const i = c.options.findIndex( ( o ) => o.value === '${ value }' ); c.btns[ i ].click(); return c.value; })()` );

};

const url = `${ baseUrl() }/?noAudio${ urlFlags() }`;
await navigate( url );
await waitFor( '!!(window.__TIDEWATER_DOLPHIN && window.__app && window.__app.ui)', { label: 'app ready', timeoutMs: 1800000 } );
await waitFor( `(() => { const s = document.querySelector( '.tw-start' ); return !! s && ! s.hidden && s.classList.contains( 'is-on' ); })()`, { label: 'start overlay', timeoutMs: 60000 } ).catch( () => {} );
await evaluate( `(() => { const s = document.querySelector( '.tw-start' ); if ( s ) s.click(); return true; })()` );
await sleep( 300 );
await gameSleep( 0.3 );
const env = await environment();
console.log( `[modes] ${ url } · ${ env.headless ? 'headless' : 'headed' } · adapter ${ env.adapter ? `${ env.adapter.vendor }/${ env.adapter.architecture }` : 'none' }` );

// ---------------------------------------------------------------- fresh launch
let s = await snapshot();
check( 'fresh launch: Dolphin mode, dolphin controlled, fishing off, no fishing HUD, chase lens = Dolphin Controls FOV (55° default)', s.mode === 'dolphin' && s.controlled && ! s.fishing && ! s.fishingActive && ! s.hud && s.fov === s.chaseFov, { mode: s.mode, fishing: s.fishing, hud: s.hud, fov: s.fov, chaseFov: s.chaseFov } );
check( 'fresh launch: Tidewater player and boat exist but idle (walker not driving, boat moored at the dock)', s.player === 'walk' && ! s.driven && s.moored, { player: s.player, driven: s.driven, moored: s.moored } );
check( 'fresh launch: stalls (Joe\'s stand, Marta\'s chandlery, both vendors) present as scenery', s.stalls );
check( 'Play tab present and first in the panel', ( await evaluate( `[ ...window.__app.ui.ui.tabs.keys() ]` ) )[ 0 ] === 'play' );
const ids0 = await worldIds();
await screenshot( resolve( SHOTS, '01-dolphin.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- Dolphin → Walking (through the panel control)
const picked = await panelSelect( 'walk' );
await gameSleep( 0.4 );
s = await snapshot();
const camToWalkerEye = Math.hypot( s.cam[ 0 ] - s.walker[ 0 ], s.cam[ 1 ] - ( s.walker[ 1 ] + 1.62 ), s.cam[ 2 ] - s.walker[ 2 ] );
check( 'Dolphin → Walking via the Play tab: walker is the player, dolphin released, lens 62°', picked === 'walk' && s.mode === 'walk' && s.player === 'walk' && ! s.controlled && s.fov === 62, { picked, mode: s.mode, player: s.player, controlled: s.controlled, fov: s.fov } );
check( 'walker spawned on Tidewater\'s start (boardwalk by the pier foot), on the ground, on land', Math.hypot( s.walker[ 0 ] - 53.6, s.walker[ 2 ] + 77 ) < 0.5 && Math.abs( s.walker[ 1 ] - s.ground ) < 0.3 && s.coast < 0, { walker: s.walker.map( ( v ) => + v.toFixed( 2 ) ), ground: + s.ground.toFixed( 2 ), coast: + s.coast.toFixed( 1 ) } );
check( 'camera is the walker\'s eye (no frame from the chase camera)', camToWalkerEye < 0.3, + camToWalkerEye.toFixed( 2 ) );
check( 'dolphin keeps simulating where it was (hovering, in water, animating)', s.dolphin.inWater && s.dolphin.simHz > 0 && s.dolphin.animation.running, { simHz: + s.dolphin.simHz.toFixed( 0 ), speed: + s.dolphin.speed.toFixed( 2 ), anim: s.dolphin.animation.base } );
// walker input works and the dolphin ignores it: hold W for a second of game time
const w0 = s.walker, d0 = s.dolphin;
await evaluate( `window.__app.input.keys.add( 'KeyW' )` );
await gameSleep( 1.0 );
await evaluate( `window.__app.input.keys.delete( 'KeyW' )` );
s = await snapshot();
// (the released dolphin glides to a stop on its own drag; what must not happen is a kick or a pitch /
// bank from the walker's W)
check( 'W moves the walker (> 1.5 m in 1 s) and not the dolphin (no kick, no acceleration, level)', Math.hypot( s.walker[ 0 ] - w0[ 0 ], s.walker[ 2 ] - w0[ 2 ] ) > 1.5 && s.dolphin.kickCount === d0.kickCount && s.dolphin.speed <= d0.speed + 0.01 && Math.abs( s.dolphin.pitch ) < 0.2, { walkerMoved: + Math.hypot( s.walker[ 0 ] - w0[ 0 ], s.walker[ 2 ] - w0[ 2 ] ).toFixed( 2 ), dolphinSpeed: [ + d0.speed.toFixed( 2 ), + s.dolphin.speed.toFixed( 2 ) ], kicks: s.dolphin.kickCount - d0.kickCount } );
check( 'HUD shows Tidewater\'s walker mode label', ( await evaluate( `window.__app.ui.ui._mode` ) ) === 'Walking', await evaluate( `window.__app.ui.ui._mode` ) );
await screenshot( resolve( SHOTS, '02-walking.jpg' ), 'jpeg', 84 );

// ---------------------------------------------------------------- Walking → Boat
await setMode( 'boat' );
await gameSleep( 0.4 );
s = await snapshot();
check( 'Walking → Boat: at the helm (Tidewater enterBoat), boat driven and unmoored, lens 62°', s.mode === 'boat' && s.player === 'boat' && s.driven && ! s.moored && s.fov === 62, { player: s.player, driven: s.driven, moored: s.moored } );
check( 'boat camera: Tidewater\'s 3rd-person orbit by default, within 6–40 m of the boat, above the water', s.camMode === 'third' && Math.hypot( s.cam[ 0 ] - s.boat[ 0 ], s.cam[ 2 ] - s.boat[ 2 ] ) < 40 && s.cam[ 1 ] > s.camWater, { camMode: s.camMode, dist: + Math.hypot( s.cam[ 0 ] - s.boat[ 0 ], s.cam[ 2 ] - s.boat[ 2 ] ).toFixed( 1 ), camY: + s.cam[ 1 ].toFixed( 2 ) } );
check( 'boat gauges on the HUD', await evaluate( `!! window.__app.ui.ui._boatOn` ) );
// throttle: W for 3 s of game time moves the boat
const b0 = s.boat;
await evaluate( `window.__app.input.keys.add( 'KeyW' )` );
await gameSleep( 3.0 );
await evaluate( `window.__app.input.keys.delete( 'KeyW' )` );
s = await snapshot();
check( 'W throttles the boat (moved > 2 m in 3 s with Tidewater\'s own controller), dolphin still idle', Math.hypot( s.boat[ 0 ] - b0[ 0 ], s.boat[ 2 ] - b0[ 2 ] ) > 2 && ! s.controlled, { moved: + Math.hypot( s.boat[ 0 ] - b0[ 0 ], s.boat[ 2 ] - b0[ 2 ] ).toFixed( 2 ) } );
await screenshot( resolve( SHOTS, '03-boat.jpg' ), 'jpeg', 84 );
// V: Tidewater's helm camera
await press( 'v' );
await gameSleep( 0.3 );
s = await snapshot();
check( 'V switches to the helm (1st person) camera', s.camMode === 'first', s.camMode );
await press( 'v' );

// ---------------------------------------------------------------- Boat → Dolphin
await setMode( 'dolphin' );
await gameSleep( 0.4 );
s = await snapshot();
const dist = Math.hypot( s.cam[ 0 ] - s.dolphin.x, s.cam[ 2 ] - s.dolphin.z );
check( 'Boat → Dolphin: dolphin controlled again, in valid water, chase camera behind it (3–9 m), chase lens, pointer unlocked', s.mode === 'dolphin' && s.controlled && s.dolphin.inWater && dist > 3 && dist < 9 && s.fov === s.chaseFov && ! s.locked, { dist: + dist.toFixed( 2 ), fov: s.fov, inWater: s.dolphin.inWater } );
check( 'leaving the helm: Tidewater\'s leaveHelm (walker stands on deck, engine off), boat left where it is, no competing controller', ! s.driven && s.player === 'deck', { driven: s.driven, player: s.player, moored: s.moored } );
check( 'dolphin never teleported onto land', s.dolphin.inWater && s.dolphin.depthHere > 1.5, { depth: + s.dolphin.depthHere.toFixed( 1 ) } );
check( 'back in Dolphin mode the keyboard is the idle input source (no stuck input from the other modes)', s.dolphin.source === 'keyboard' && s.dolphin.swimLevel === 0, { source: s.dolphin.source, swimLevel: s.dolphin.swimLevel } );

// ---------------------------------------------------------------- repeated switching: resources and world continuity
for ( let i = 0; i < 4; i ++ ) { await setMode( 'walk' ); await gameSleep( 0.1 ); await setMode( 'boat' ); await gameSleep( 0.1 ); await setMode( 'dolphin' ); await gameSleep( 0.1 ); }
s = await snapshot();
const ids1 = await worldIds();
const same = Object.keys( ids0 ).filter( ( k ) => ! [ 'scene', 'time', 'gTime' ].includes( k ) ).every( ( k ) => ids0[ k ] === ids1[ k ] );
check( '12 more switches: world systems are the same objects (ocean, FFT, terrain, reef, whale, wildlife, sky, post, dolphin rig, player, boat, game, audio)', same, { before: ids0, after: ids1 } );
check( 'no duplicated scene objects (scene child count unchanged)', ids0.scene === ids1.scene, { before: ids0.scene, after: ids1.scene } );
check( 'time of day untouched by switching', Math.abs( ids0.time - ids1.time ) < 1e-9, ids1.time );
check( 'back in Dolphin mode, controlled, in water', s.mode === 'dolphin' && s.controlled && s.dolphin.inWater );
check( 'the walker remembers where it was left (restored on the next switch, not re-spawned)', await A( `app._walkerPose !== null` ) );
check( 'no walker-pose teleport into water: remembered walker is on land / a deck', ( await A( `app._walkerPose && app.terrainData.coastDistance( app._walkerPose.x, app._walkerPose.z ).d` ) ) < 0.5 );

// ---------------------------------------------------------------- fishing
await setMode( 'walk' );
await gameSleep( 0.3 );
await A( `app.setFishing( true )` );
await gameSleep( 0.5 );
s = await snapshot();
check( 'fishing on in Walking: Game updates, HUD + minimap built and shown', s.fishing && s.fishingActive && s.hud && s.hudShown && s.minimapShown, { hud: s.hud, hudShown: s.hudShown, minimap: s.minimapShown } );
// Tidewater's first-play guide may open: close it (it would own the keyboard)
await A( `app.game.guide && app.game.guide.open && app.game.guide.close()` );
// R takes out the rod (Tidewater's own Game: R while on foot)
await press( 'r' );
await gameSleep( 0.4 );
s = await snapshot();
check( 'R takes out Tidewater\'s rod (walking, fishing on)', s.rodEquipped && s.rodVisible, { equipped: s.rodEquipped, visible: s.rodVisible } );
await screenshot( resolve( SHOTS, '04-fishing-rod.jpg' ), 'jpeg', 84 );
// switch to the dolphin with the rod out: rod away, HUD hidden, state kept
await setMode( 'dolphin' );
await gameSleep( 0.4 );
s = await snapshot();
check( 'Dolphin mode with fishing on: fishing inactive, rod away and hidden, fishing HUD and minimap hidden, setting kept', s.fishing && ! s.fishingActive && ! s.rodEquipped && ! s.rodVisible && s.hudShown === false && s.minimapShown === false, { fishing: s.fishing, active: s.fishingActive, rod: s.rodEquipped, hudShown: s.hudShown } );
await press( 'r' ); // R is the dolphin's recenter here, never the rod
await gameSleep( 0.2 );
s = await snapshot();
check( 'R in Dolphin mode never equips the rod', ! s.rodEquipped );
// back to walking: HUD returns; fishing off restores plain walking, stalls remain
await setMode( 'walk' );
await gameSleep( 0.4 );
s = await snapshot();
check( 'back to Walking: fishing active again, HUD shown', s.fishingActive && s.hudShown === true );
await A( `app.setFishing( false )` );
await gameSleep( 0.3 );
await press( 'r' );
await gameSleep( 0.3 );
s = await snapshot();
check( 'fishing off: Game idle, HUD hidden, R does nothing, stalls / vendors still in the world', ! s.fishing && ! s.fishingActive && s.hudShown === false && ! s.rodEquipped && s.stalls, { rod: s.rodEquipped, stalls: s.stalls } );
await setMode( 'dolphin' );
await gameSleep( 0.3 );

// ---------------------------------------------------------------- scenery additions
s = await snapshot();
check( 'scenery additions ready, both CP10 categories placed (deterministic counts)', s.additions.ready && s.additions.categories.sunkenWood.instances === 11 && s.additions.categories.seabedShells.instances === 30, s.additions.categories );
// asset-integration pass: the imported-model categories (public/models/additions/), their live
// structure fields and fish communities
const IMPORTED = { seagrassMeadows: 370, kelpWall: 141, wreck: 25, drownedTemple: 103, wildlife: 3, headland: 71 };
check( 'imported categories placed (pinned deterministic counts)', Object.entries( IMPORTED ).every( ( [ id, n ] ) => s.additions.categories[ id ] && s.additions.categories[ id ].instances === n ), Object.fromEntries( Object.keys( IMPORTED ).map( ( id ) => [ id, s.additions.categories[ id ]?.instances ] ) ) );
check( 'every imported GLB loaded (25 models, no loader error)', await A( `[ ...app.additions.models.values() ].length === 25 && [ ...app.additions.models.values() ].every( ( m ) => m.ready && ! m.error )` ), await A( `[ ...app.additions.models.values() ].filter( ( m ) => ! m.ready || m.error ).map( ( m ) => m.id )` ) );
check( 'solid sites have structure fields whose tops stay below −2.5 m (swimmable mask unchanged)', [ 'seagrassMeadows', 'kelpWall', 'wreck', 'drownedTemple' ].every( ( id ) => s.additions.categories[ id ].fieldTop !== null && s.additions.categories[ id ].fieldTop < - 2.5 ), Object.fromEntries( [ 'seagrassMeadows', 'kelpWall', 'wreck', 'drownedTemple' ].map( ( id ) => [ id, s.additions.categories[ id ].fieldTop ] ) ) );
check( 'site fish communities at the wreck and the temple (Tidewater\'s own species)', s.additions.categories.wildlife.fish > 300, s.additions.categories.wildlife.fish );
const hull = await A( `app.additions.placed.wreck.hull` );
const probeOn = await A( `app.additions.structureAt( ${ hull.x }, ${ hull.z } )` ), terrainAtHull = await A( `app.terrainData.heightAt( ${ hull.x }, ${ hull.z } )` );
check( 'the wreck is in the contact surface (structure above the sand under the hull)', probeOn > terrainAtHull + 0.2, { probeOn, terrainAtHull } );
const dolphinGround = await A( `d.world.terrainHeight( ${ hull.x }, ${ hull.z } )` );
check( 'the dolphin\'s world sampler sees the wreck (composite ground)', Math.abs( dolphinGround - Math.max( probeOn, terrainAtHull ) ) < 1e-6, { dolphinGround, probeOn } );
const m1 = await A( `JSON.stringify( app.additions.manifest().records.map( ( r ) => [ r.asset, ...r.position ] ) )` );
await A( `app.additions.setAll( false )` );
await gameSleep( 0.1 );
s = await snapshot();
check( 'Original Tidewater: every addition hidden (0 draw calls from the layer, no structure in the ground)', Object.values( s.additions.categories ).every( ( c ) => ! c.enabled && c.drawCalls === 0 ) && ( await A( `app.additions.structureAt( ${ hull.x }, ${ hull.z } )` ) ) === - Infinity, s.additions.categories );
await A( `app.additions.setCategory( 'seabedShells', true )` );
await gameSleep( 0.1 );
s = await snapshot();
check( 'per-category toggle: shells on, driftwood off', s.additions.categories.seabedShells.enabled && ! s.additions.categories.sunkenWood.enabled );
await A( `app.additions.setAll( true )` );
const m2 = await A( `JSON.stringify( app.additions.manifest().records.map( ( r ) => [ r.asset, ...r.position ] ) )` );
check( 'placements deterministic (identical manifest after toggling)', m1 === m2 );
const manifest = await A( `app.additions.manifest()` );
writeFileSync( resolve( OUT, 'additions-manifest.json' ), JSON.stringify( manifest, null, 2 ) );
// (the CP10 checks below are unchanged, scoped to the two CP10 scan categories: their records carry assetIndex)
const bare = await A( `app.additions.manifest().records.filter( ( r ) => r.assetIndex !== undefined ).every( ( r ) => { const [ x, y, z ] = r.position; const g = app.terrainData.heightAt( x, z ); return app.reef.structureAt( x, z ) <= g + 0.02 && y > g - 0.3 && y < g + 0.6 && g < - 2.2 && g > - 6.1; } )` );
check( 'every CP10 scan addition rests on bare sand (no reef structure under it), 2.2–6.1 m deep', bare );
const clear = await A( `app.additions.manifest().records.filter( ( r ) => r.position && r.category !== 'headland' ).every( ( r ) => { const [ x, , z ] = r.position; return Math.abs( x - 55 ) > 4 || z < - 67 || z > 43; } ) && app.additions.manifest().records.filter( ( r ) => r.position ).every( ( r ) => Math.hypot( r.position[ 0 ] - 64.5, r.position[ 2 ] - 36.5 ) > 12 )` );
check( 'additions clear of the pier, its head and the boat dock', clear );
check( 'every CP10 scan record carries source + licence (Poly Haven CC0, shipped in Tidewater)', manifest.records.filter( ( r ) => r.assetIndex !== undefined ).every( ( r ) => r.license === 'CC0 1.0' && /polyhaven/.test( r.source ) && /vendor\/tidewater\/public\/models\/debris/.test( r.path ) ) );
const imported = manifest.records.filter( ( r ) => r.assetIndex === undefined && r.asset );
check( 'every imported record carries title, creator, source page, CC0 / CC-BY licence, lab path and SHA-256', imported.length > 600 && imported.every( ( r ) => r.title && r.creator && /^https?:\/\//.test( r.source || '' ) && [ 'CC0', 'CC-BY' ].includes( r.license ) && /model-lab\/derived\/glb/.test( r.labSource || '' ) && /^[0-9a-f]{64}$/.test( r.sha256 || '' ) ), { imported: imported.length, missing: imported.filter( ( r ) => ! ( r.title && r.creator && r.source && r.license && r.sha256 ) ).slice( 0, 3 ) } );
// per-category toggles of the imported sites: hidden means 0 draw calls and no structure
for ( const id of [ 'kelpWall', 'wreck', 'drownedTemple', 'wildlife', 'headland', 'seagrassMeadows' ] ) {

	await A( `app.additions.setCategory( '${ id }', false )` );
	await gameSleep( 0.1 );
	s = await snapshot();
	check( `toggle ${ id } off: hidden (0 draw calls)`, ! s.additions.categories[ id ].enabled && s.additions.categories[ id ].drawCalls === 0, s.additions.categories[ id ] );
	await A( `app.additions.setCategory( '${ id }', true )` );

}

await gameSleep( 0.1 );
// look at the sunken wood from the dolphin's eye
await A( `d.test.placeAndFace( 70, 52, - 2.6, Math.atan2( 80 - 70, 64 - 52 ), 0 )` );
await A( `d.test.setIntent( { brake: true, kicks: 0, kickRate: 0, pitch: 0, roll: 0, burst: false, autopilot: false } )` );
await gameSleep( 1.8 );
await screenshot( resolve( SHOTS, '05-additions-wood.jpg' ), 'jpeg', 86 );
await A( `app.additions.setAll( false )` );
await gameSleep( 0.4 );
await screenshot( resolve( SHOTS, '05-additions-wood-off.jpg' ), 'jpeg', 86 );
await A( `app.additions.setAll( true )` );
await A( `d.test.placeAndFace( 8, 14, - 2.0, Math.atan2( 14 - 8, 24 - 14 ), 0 )` );
await gameSleep( 1.8 );
await screenshot( resolve( SHOTS, '06-additions-shells.jpg' ), 'jpeg', 86 );
await A( `app.additions.setAll( false )` );
await gameSleep( 0.4 );
await screenshot( resolve( SHOTS, '06-additions-shells-off.jpg' ), 'jpeg', 86 );
await A( `app.additions.setAll( true )` );
// the imported sites from the dolphin's eye (Enhanced, then Original at the same spot)
for ( const [ name, x, z, y, tx, tz ] of [ [ '07-additions-wreck', 65, 100, - 8.5, 56, 114 ], [ '08-additions-temple', - 14, 146, - 12, 6, 156 ], [ '09-additions-kelpwall', 47, 112, - 9.5, 66, 110 ] ] ) {

	await A( `d.test.placeAndFace( ${ x }, ${ z }, ${ y }, Math.atan2( ${ tx } - ${ x }, ${ tz } - ${ z } ), 0 )` );
	await gameSleep( 1.2 );
	await screenshot( resolve( SHOTS, name + '.jpg' ), 'jpeg', 86 );
	await A( `app.additions.setAll( false )` );
	await gameSleep( 0.4 );
	await screenshot( resolve( SHOTS, name + '-off.jpg' ), 'jpeg', 86 );
	await A( `app.additions.setAll( true )` );

}

await A( `d.test.setIntent( null )` );

// ---------------------------------------------------------------- performance by mode (wall clock; product numbers only on a real GPU in a visible window)
const fpsIn = async ( mode, ms = 4000 ) => {

	await setMode( mode );
	await sleep( 800 );
	const f = [];
	for ( let i = 0; i < ms / 1000; i ++ ) { await sleep( 1000 ); f.push( await evaluate( 'window.__app.fps' ) ); }
	return { fps: + f.sort( ( a, b ) => a - b )[ f.length >> 1 ].toFixed( 1 ), cpuMs: + ( await evaluate( 'window.__app.cpuMs' ) ).toFixed( 2 ) };

};
const perf = { dolphin: await fpsIn( 'dolphin' ), walk: await fpsIn( 'walk' ), boat: await fpsIn( 'boat' ) };
await setMode( 'walk' );
await A( `app.setFishing( true )` );
await gameSleep( 0.4 );
await A( `app.game.guide && app.game.guide.open && app.game.guide.close()` );
perf.walkFishing = await fpsIn( 'walk' );
await A( `app.setFishing( false )` );
await setMode( 'dolphin' );
await A( `app.additions.setAll( false )` );
perf.dolphinOriginal = await fpsIn( 'dolphin' );
await A( `app.additions.setAll( true )` );
check( `live fps by mode measured (${ env.headless ? 'headless' : 'visible' }${ env.software ? ', SOFTWARE adapter — not product numbers' : '' })`, Object.values( perf ).every( ( p ) => p.fps > 0 ), perf );

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) && ! /favicon/.test( l ) );
check( 'no console errors during the mode / fishing / additions trials', errors.length === 0, errors.slice( 0, 5 ) );

const summary = { url, at: new Date().toISOString(), environment: env, passed: results.filter( ( r ) => r.ok ).length, total: results.length, results, perf };
writeFileSync( resolve( OUT, 'modes.json' ), JSON.stringify( summary, null, 2 ) );
console.log( `\n${ summary.passed }/${ summary.total } passed → ${ resolve( OUT, 'modes.json' ) }` );
