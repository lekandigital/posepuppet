// CP10 reference / parity capture driver.
//
// Drives the persistent review window (review.mjs) through Tidewater's OWN reference-shot
// facility (vendor/tidewater/src/core/Bench.js): on a `?bench` load (seeded RNG, no render loop)
// each named view is rendered at 2560 × 1267 with the simulation clock stopped (dt = 0) for 64
// frames so the waves, clouds, particles, animals and temporal filters settle, then the final
// image is uploaded raw (BGRA) to the local collector, which writes PNGs. The same sequence on
// the same code gives the same images, so pristine (A) and integrated (B) shots compare pixel
// by pixel. A second pass with dt > 0 records a moving-water sequence.
//
//   node eval/capture.mjs --target=pristine        --tag=A            # pristine Tidewater :5189
//   node eval/capture.mjs --target=dolphin-hidden  --tag=Bhidden      # integrated, dolphin not in the scene, additions off
//   node eval/capture.mjs --target=dolphin         --tag=B            # integrated, dolphin visible, additions off
//   node eval/capture.mjs --target=enhanced        --tag=E            # integrated, dolphin visible, scenery additions on
//   options: --views=a,b,c  --seq  --perf  --out=eval/captures  --frames=64

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCollector } from './lib/collector.mjs';
import { navigate, evaluate, waitFor, sleep, consoleLines } from './lib/rpc.mjs';
import { ALL_VIEWS, CUSTOM_VIEWS, SEQUENCE_VIEWS } from './views.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const argv = process.argv.slice( 2 );
const opt = ( k, d ) => ( argv.find( ( a ) => a.startsWith( `--${ k }=` ) ) ?? `--${ k }=${ d }` ).split( '=' ).slice( 1 ).join( '=' );
const flag = ( k ) => argv.includes( `--${ k }` );

const target = opt( 'target', 'pristine' );
const tag = opt( 'tag', target === 'pristine' ? 'A' : target === 'dolphin-hidden' ? 'Bhidden' : target === 'enhanced' ? 'E' : 'B' );
const outDir = resolve( HERE, opt( 'out', 'captures' ) );
const views = opt( 'views', '' ) ? opt( 'views', '' ).split( ',' ) : ALL_VIEWS;
const frames = Number( opt( 'frames', 64 ) );

// (?original: the scenery-additions layer off — the pristine scene exactly; ?enhanced: all additions on)
const TARGETS = {
	'pristine': { url: 'http://127.0.0.1:5189/?bench&noAudio', debugViews: '/src/core/DebugViews.js' },
	'dolphin-hidden': { url: 'http://127.0.0.1:5199/?bench&noAudio&noDolphin&original', debugViews: '/vendor/tidewater/src/core/DebugViews.js' },
	'dolphin': { url: 'http://127.0.0.1:5199/?bench&noAudio&original', debugViews: '/vendor/tidewater/src/core/DebugViews.js' },
	'enhanced': { url: 'http://127.0.0.1:5199/?bench&noAudio&enhanced', debugViews: '/vendor/tidewater/src/core/DebugViews.js' },
};
const T = TARGETS[ target ];
if ( ! T ) throw new Error( 'unknown --target' );
// extra Tidewater URL flags for isolation runs (e.g. --flags=noVeg,noHaze)
if ( opt( 'flags', '' ) ) T.url += '&' + opt( 'flags', '' ).split( ',' ).join( '&' );

mkdirSync( outDir, { recursive: true } );
const collector = await startCollector( { port: 5190, outDir, onFile: ( f ) => console.log( '  saved', f.path.replace( outDir + '/', '' ), f.width ? `${ f.width }×${ f.height }` : '' ) } );

console.log( `[capture] ${ target } → ${ T.url }` );
await navigate( T.url );
await waitFor( '!!window.__bench && !!window.__app', { label: 'bench ready', timeoutMs: 600000 } );

// the same custom views in both apps (Vite serves one module instance per URL, shared with Bench.js)
await evaluate( `(async () => { const m = await import(${ JSON.stringify( T.debugViews ) }); Object.assign( m.VIEWS, ${ JSON.stringify( CUSTOM_VIEWS ) } ); return Object.keys( m.VIEWS ).length; })()` );

// environment record
const env = await evaluate( `(async () => {
	const a = await navigator.gpu.requestAdapter(); const i = a.info || {};
	const app = window.__app, fft = app.fft, shore = app.shore;
	return {
		userAgent: navigator.userAgent, devicePixelRatio, innerSize: [ innerWidth, innerHeight ],
		adapter: { vendor: i.vendor, architecture: i.architecture, timestampQuery: a.features.has( 'timestamp-query' ) },
		settings: { ...app.settings }, renderScale: app.post.scale, exposure: app.settings.exposure,
		sea: { windSpeed: fft.local.windSpeed, windDirection: fft.local.windDirection, fetch: fft.local.fetch, choppiness: fft.choppiness.value, swell: fft.swell.scale, foamBias: fft.foamBias.value, foamDecay: fft.foamDecay.value },
		shore: { amplitude: shore.amplitude.value, period: shore.period.value, gamma: shore.gamma.value, curl: shore.curl.value },
		clouds: app.clouds ? { coverage: app.clouds.coverage.value, cirrus: app.clouds.cirrus ? app.clouds.cirrus.value : null } : null,
		haze: app.haze ? { density: app.haze.density.value, shafts: app.haze.shafts.value } : null,
		caustics: app.caustics ? app.caustics.strength.value : null,
		post: { ao: app.post.params.aoStrength.value, bloom: app.post.params.bloom.value, sharpen: app.post.params.sharpen.value, saturation: app.post.params.saturation.value, contrast: app.post.params.contrast.value, vignette: app.post.params.vignette.value, grain: app.post.params.grain.value, aaMode: app.post.aaMode, motionBlur: app.post.motionBlur ? app.post.motionBlur.shutter.value : null },
		camera: { fov: app.camera.fov, near: app.camera.near, far: app.camera.far },
		dolphin: window.__TIDEWATER_DOLPHIN ? window.__TIDEWATER_DOLPHIN.state() : null,
		playerMode: app.playerMode ?? 'tidewater-player',
		additions: app.additions ? app.additions.stats() : null,
		flags: location.search,
	};
})()` );
env.target = target; env.tag = tag; env.capturedAt = new Date().toISOString(); env.benchSize = [ 2560, 1267 ]; env.frames = frames; env.views = views;
writeFileSync( resolve( outDir, `${ tag }-environment.json` ), JSON.stringify( env, null, 2 ) );
console.log( '[capture] environment recorded:', JSON.stringify( env.adapter ), 'fov', env.camera.fov, 'renderScale', env.renderScale );

// Normalize the adaptive post state the Bench's dt = 0 protocol freezes, identically in both apps,
// so the shots compare the ENVIRONMENT and not the history of the camera before the capture:
// Tidewater's auto-exposure multiplier (a GPU buffer adapted with k = 1 − exp(−dt·rate): with
// dt = 0 it keeps whatever the warm-up frames left — the walker's beach view in the pristine app,
// the dolphin's underwater view in the integrated one) and the lens droplets (wet = 1 on
// surfacing, dried by dt). Same free-camera pose for 20 running frames, then exposure := 1.0
// and a dry lens. Nothing in the renderers is changed; this is capture harness state only.
const normalize = async () => evaluate( `(() => {
	const app = window.__app;
	app.setFreeCam( true );
	app.settings.timeOfDay = 16.2;
	app.fly.setPose( app.camera.position.clone().set( 15, 3.0, - 58 ), Math.PI, - 0.08 );
	app.fly.velocity.set( 0, 0, 0 );
	for ( let i = 0; i < 20; i ++ ) app.frame( 1 / 60 );
	app.post.lens.wet.value = 0; app.post.lens.age.value = 100; app.post.lens._wasUnder = false;
	app.post.exposure.write( new Float32Array( [ 1 ] ) );
	return true;
})()` );
await normalize();
// Per-view normalization: Bench.pose() is wrapped (capture harness only) so every view starts from
// the same seeded RNG (BenchSeed's mulberry32, re-installed) and a dry lens. Otherwise the first
// surfacing in the view sequence (underwater → waterline) wets the lens with a random droplet
// pattern that dt = 0 never dries, and the two apps' seeded RNG streams have diverged by then
// (the pristine fishing HUD draws extra randoms), so every later above-water view would differ by
// droplets alone. Views whose name ends in "Drops" force a fresh surfacing instead (identical
// droplets in both apps: same seed).
await evaluate( `(() => {
	const bench = window.__bench, app = window.__app;
	if ( bench.__cp10wrapped ) return true;
	const orig = bench.pose.bind( bench );
	const preroll = ${ Number( opt( 'preroll', 90 ) ) };
	bench.pose = ( name ) => {
		orig( name );
		let s = 0x9e3779b9;
		Math.random = () => { s = ( s + 0x6d2b79f5 ) | 0; let t = Math.imul( s ^ ( s >>> 15 ), 1 | s ); t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t; return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296; };
		// pre-roll with the clock running so dt-driven transients (dithered vegetation LOD fades,
		// adaptation) complete at THIS view in both apps before the frozen settle frames; the
		// clock advances by the same 1.5 s per view in both apps, so wave phases stay matched
		// vegetation instance lists are refilled / far-sorted from the camera position at the time
		// the camera last moved far enough — camera history. Force a refill at this view in both apps.
		if ( ${ flag( 'noVegRefill' ) ? 'false' : 'true' } && app.vegetation ) for ( const t of app.vegetation.types ) { t.farX = Infinity; t.farZ = Infinity; t.lastX = Infinity; t.lastY = Infinity; t.lastZ = Infinity; }
		// the cascaded shadow fit snaps its texel grid in the light frame of the PREVIOUS fit (SunShadows._fit:
		// lookAt() keeps the old translation), so the grid phase is inherited from the first frame ever
		// rendered — the walker's view in the pristine app, the dolphin's in this one. Re-anchor both at the
		// world origin so the shadow texel phase is identical; the pristine game itself differs from
		// itself by this sub-texel phase depending on where it first looked.
		if ( ${ flag( 'noShadowAnchor' ) ? 'false' : 'true' } ) for ( const c of app.shadows.cascades ) { c.camera.matrixWorld.identity(); c.dirty = true; }
		for ( let i = 0; i < preroll; i ++ ) app.frame( 1 / 60 );
		const L = app.post.lens;
		L.wet.value = 0; L.age.value = 100; L._wasUnder = /Drops$/.test( name );
		app.post.exposure.write( new Float32Array( [ 1 ] ) );
	};
	bench.__cp10wrapped = true;
	return true;
})()` );
console.log( '[capture] adaptive post state normalized (exposure 1.0, lens dry, 20 frames at the beach view; per-view RNG reseed + dry lens)' );
// isolation hook: --pre="<js>" runs once in the page before the shots (e.g. --pre="__app.shadows.enabled=false")
if ( opt( 'pre', '' ) ) { await evaluate( `(() => { ${ opt( 'pre', '' ) }; return true; })()` ); console.log( '[capture] pre:', opt( 'pre', '' ) ); }

// still shots, clock stopped
console.log( `[capture] ${ views.length } still views, dt = 0, ${ frames } settle frames each …` );
const t0 = Date.now();
await evaluate( `window.__bench.shots( ${ JSON.stringify( views ) }, { tag: ${ JSON.stringify( tag ) }, dt: 0, frames: ${ frames } } )` );
console.log( `[capture] stills done in ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 0 ) } s` );

// moving water: the clock runs at 1/60 s per frame, 6 images every 20 frames after 64 warm frames
if ( flag( 'seq' ) ) {

	console.log( '[capture] moving-water sequence …' );
	await normalize();
	await evaluate( `window.__bench.shots( ${ JSON.stringify( SEQUENCE_VIEWS ) }, { tag: ${ JSON.stringify( tag + 'seq' ) }, dt: 1 / 60, frames: 64, seq: 6, every: 20 } )` );

}

// GPU / wall frame times per view (Tidewater's own benchmark; 2560 × 1267, 90 warm + 120 measured)
if ( flag( 'perf' ) ) {

	console.log( '[capture] benchmark …' );
	const perfViews = opt( 'perfViews', 'beach,pier,sunGlitter,village,underwater,aerial,palms,spawnArea,deepWater' ).split( ',' );
	const r = await evaluate( `window.__bench.run( { views: ${ JSON.stringify( perfViews ) }, top: 24 } )` );
	writeFileSync( resolve( outDir, `${ tag }-bench.json` ), JSON.stringify( r, null, 2 ) );
	for ( const v of perfViews ) console.log( `  ${ v.padEnd( 14 ) } gpu ${ r[ v ].gpu } ms (median ${ r[ v ].gpuMedian }) · wall ${ r[ v ].wall } ms · cpu ${ r[ v ].cpu } ms` );

}

const errors = ( await consoleLines( 400 ) ).filter( ( l ) => /\[(error|pageerror)\]/.test( l ) );
writeFileSync( resolve( outDir, `${ tag }-console.txt` ), ( await consoleLines( 400 ) ).join( '\n' ) );
console.log( `[capture] console errors: ${ errors.length }` );
for ( const e of errors.slice( 0, 10 ) ) console.log( '   ', e );
await sleep( 500 );
collector.close();
console.log( '[capture] done →', outDir );
