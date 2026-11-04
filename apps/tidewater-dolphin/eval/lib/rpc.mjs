// Client for the review launcher's control endpoint (review.mjs). The launcher owns the one
// persistent headed Chrome window (or the one headless Chromium); scripts drive it through here.
//
// CP10 controls pass: the live suites pace themselves on the WORLD CLOCK (Tidewater's G.time,
// which advances by the engine's clamped frame dt — the same clamp the dolphin's 120 Hz loop
// uses), so a trial that waits "0.6 s" waits 0.6 s of game time whether the renderer runs at
// 70 fps on an Apple GPU or at 1 fps on Chrome's software WebGPU adapter. Wall-clock `sleep`
// remains for things that are wall-clock by nature (overlay fades, fps sampling).

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';

const ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );
const ENDPOINT_FILE = resolve( ROOT, '.local', 'chrome-review-profile', 'endpoint.json' );

export function endpointPort() {

	if ( ! existsSync( ENDPOINT_FILE ) ) throw new Error( 'review window is not running: start `node review.mjs` (or `--pristine`, or `--headless`) first' );
	return JSON.parse( readFileSync( ENDPOINT_FILE, 'utf8' ) ).port;

}

export function rpc( body, { timeoutMs = 0 } = {} ) {

	const port = endpointPort();
	return new Promise( ( ok, fail ) => {

		// long evaluations (Bench.shots / run) hold the request open for minutes: no socket timeout
		// unless the caller asks for one
		const req = request( { hostname: '127.0.0.1', port, path: '/rpc', method: 'POST', timeout: timeoutMs > 0 ? timeoutMs : 0 }, ( res ) => {

			let data = '';
			res.on( 'data', ( c ) => data += c );
			res.on( 'end', () => {

				try {

					const j = JSON.parse( data );
					if ( ! j.ok ) fail( new Error( j.error || 'rpc failed' ) ); else ok( j );

				} catch ( e ) { fail( e ); }

			} );

		} );
		req.on( 'error', fail );
		if ( timeoutMs > 0 ) req.on( 'timeout', () => { req.destroy(); fail( new Error( 'rpc timeout' ) ); } );
		else req.setTimeout( 0 );
		req.end( JSON.stringify( body ) );

	} );

}

export const evaluate = async ( expr ) => ( await rpc( { op: 'eval', expr } ) ).value;
export const navigate = ( url ) => rpc( { op: 'navigate', url } );
export const screenshot = ( path, type = 'png', quality ) => rpc( { op: 'screenshot', path, type, quality } );
export const press = ( key ) => rpc( { op: 'press', key } );
export const keydown = ( key ) => rpc( { op: 'keydown', key } );
export const keyup = ( key ) => rpc( { op: 'keyup', key } );
export const mouseMove = ( x, y, steps = 1 ) => rpc( { op: 'mousemove', x, y, steps } );
export const mouseDown = ( button = 'left' ) => rpc( { op: 'mousedown', button } );
export const mouseUp = ( button = 'left' ) => rpc( { op: 'mouseup', button } );
export const status = async () => rpc( { op: 'status' } );
export const consoleLines = async ( n = 100 ) => ( await rpc( { op: 'console', n } ) ).lines;
export const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

// ---------------------------------------------------------------- targets and output (overridable per machine)
export const baseUrl = () => ( process.env.TIDEWATER_DOLPHIN_URL ?? 'http://127.0.0.1:5199' ).replace( /\/$/, '' );
export const pristineUrl = () => ( process.env.TIDEWATER_PRISTINE_URL ?? 'http://127.0.0.1:5189' ).replace( /\/$/, '' );
/** extra query flags for every page the suites open, e.g. TIDEWATER_URL_FLAGS=scale=0.5 */
export const urlFlags = () => process.env.TIDEWATER_URL_FLAGS ? '&' + process.env.TIDEWATER_URL_FLAGS.replace( /^[?&]+/, '' ) : '';
/** where a suite writes its JSON / images; default = the committed eval/results (the Mac baseline) */
export const resultsDir = ( fallback ) => process.env.TIDEWATER_RESULTS_DIR ? resolve( process.cwd(), process.env.TIDEWATER_RESULTS_DIR ) : fallback;

// poll an expression until it is truthy
export async function waitFor( expr, { timeoutMs = 300000, everyMs = 1000, label = expr } = {} ) {

	const t0 = Date.now();
	for ( ;; ) {

		let v = null;
		try { v = await evaluate( expr ); } catch { /* page reloading */ }
		if ( v ) return v;
		if ( Date.now() - t0 > timeoutMs ) throw new Error( `timeout waiting for ${ label }` );
		await sleep( everyMs );

	}

}

// ---------------------------------------------------------------- the world clock
// The integrated app serves Tidewater's Globals at /vendor/tidewater/src/core/Globals.js, the
// pristine app at /src/core/Globals.js (Vite hands out one module instance per URL, shared with
// the running app, so G.time IS the app's clock).
let clockPath = '/vendor/tidewater/src/core/Globals.js';
export const setClockPath = ( p ) => { clockPath = p; };
export const gameTime = async () => Number( await evaluate( `(await import( '${ clockPath }' )).G.time.value` ) );

/** wait `seconds` of GAME time (resolves to the clock value); throws if the world clock stalls */
export async function gameSleep( seconds, { maxWallMs = Math.max( 30000, seconds * 1000 * 400 ) } = {} ) {

	const t0 = await gameTime();
	const wall0 = Date.now();
	const pollMs = Math.min( 200, Math.max( 15, seconds * 1000 / 4 ) );
	for ( ;; ) {

		await sleep( pollMs );
		const t = await gameTime();
		if ( t - t0 >= seconds - 1e-6 ) return t;
		if ( Date.now() - wall0 > maxWallMs ) throw new Error( `world clock stalled: ${ seconds } s of game time did not pass in ${ maxWallMs } ms` );

	}

}

/** sample `sample( tGame )` every `everyS` of game time for `seconds` of game time */
export async function gameRun( seconds, everyS, sample ) {

	const out = [];
	const t0 = await gameTime();
	let next = t0;
	const pollMs = Math.min( 100, Math.max( 10, everyS * 1000 / 3 ) );
	for ( ;; ) {

		const t = await gameTime();
		if ( t - t0 >= seconds - 1e-6 ) break;
		if ( t >= next - 1e-6 ) {

			out.push( await sample( t - t0 ) );
			next = Math.max( next + everyS, t );

		} else await sleep( pollMs );

	}

	return out;

}

/** what rendered this run: adapter, browser, viewport, headless flag (labels every result file) */
export async function environment() {

	const st = await status();
	// (requestAdapter can stall on a page whose GPU process has died — never let a suite hang here)
	const page = await Promise.race( [
		evaluate( `(async () => { const a = navigator.gpu ? await navigator.gpu.requestAdapter() : null; const i = a && ( a.info || {} ); return { userAgent: navigator.userAgent, devicePixelRatio, innerSize: [ innerWidth, innerHeight ], adapter: a ? { vendor: i.vendor, architecture: i.architecture, device: i.device, description: i.description } : null, hardwareConcurrency: navigator.hardwareConcurrency }; })()` ),
		sleep( 10000 ).then( () => ( { adapter: null, userAgent: 'unknown (adapter query timed out)' } ) ),
	] );
	return { ...page, headless: !! st.headless, display: st.display, viewport: st.viewport, software: !! ( page.adapter && /swiftshader|llvmpipe|software/i.test( `${ page.adapter.architecture } ${ page.adapter.description }` ) ) };

}
