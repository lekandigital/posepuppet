// Live frame rate of both apps in the SAME visible review window (normal mode, render loop
// running, 1440 × 760 at dpr 1), sampled from Tidewater's own fps counter (app.fps, 0.5 s
// windows) for 15 s each after the start overlay is dismissed. The Bench numbers in
// *-bench.json are the GPU-timestamped frame costs at 2560 × 1267; this is what a player sees.
//   node eval/livefps.mjs  → eval/results/livefps.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigate, evaluate, waitFor, sleep } from './lib/rpc.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const OUT = resolve( HERE, 'results' );
mkdirSync( OUT, { recursive: true } );

const targets = [
	{ name: 'pristine (walker at the start, free camera at the beach view)', url: 'http://127.0.0.1:5189/?noAudio', pose: true },
	{ name: 'integrated, dolphin chase camera at spawn (gliding)', url: 'http://127.0.0.1:5199/?noAudio', pose: false },
	{ name: 'integrated, free camera at the beach view (dolphin waiting)', url: 'http://127.0.0.1:5199/?noAudio', pose: true },
];
const out = [];
for ( const t of targets ) {

	await navigate( t.url );
	await waitFor( '!!(window.__app && window.__app.ui)', { timeoutMs: 600000 } );
	await sleep( 500 );
	await evaluate( `(() => { const b = document.querySelector( '.tw-start-cta' ); if ( b ) b.click(); return true; })()` );
	if ( t.pose ) await evaluate( `(() => { const app = window.__app; app.setFreeCam( true ); app.settings.timeOfDay = 16.2; app.fly.setPose( app.camera.position.clone().set( 15, 3, - 58 ), Math.PI, - 0.08 ); app.fly.velocity.set( 0, 0, 0 ); return true; })()` );
	await sleep( 4000 ); // settle
	const fps = [], cpu = [];
	for ( let i = 0; i < 30; i ++ ) { await sleep( 500 ); fps.push( await evaluate( 'window.__app.fps || 0' ) ); cpu.push( await evaluate( 'window.__app.cpuMs || 0' ) ); }
	const sorted = fps.slice().sort( ( a, b ) => a - b );
	const size = await evaluate( '[ window.__app.sceneRenderer.width, window.__app.sceneRenderer.height, innerWidth, innerHeight ]' );
	const dolphin = await evaluate( 'window.__TIDEWATER_DOLPHIN ? window.__TIDEWATER_DOLPHIN.state().simHz : null' );
	const r = { name: t.name, url: t.url, renderSize: size, fpsMedian: + sorted[ 15 ].toFixed( 1 ), fpsMin: + sorted[ 0 ].toFixed( 1 ), fpsMax: + sorted[ 29 ].toFixed( 1 ), cpuMsMedian: + cpu.slice().sort( ( a, b ) => a - b )[ 15 ].toFixed( 2 ), simHz: dolphin };
	console.log( JSON.stringify( r ) );
	out.push( r );

}

writeFileSync( resolve( OUT, 'livefps.json' ), JSON.stringify( { at: new Date().toISOString(), window: '1440×760 css px, dpr 1, built-in display, visible', runs: out }, null, 2 ) );
