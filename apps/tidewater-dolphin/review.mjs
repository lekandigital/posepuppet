// Dedicated headed BodyArcade review launcher for the Tidewater dolphin app (CP10).
//
// One persistent Google Chrome window (the dedicated BodyArcade review profile at
// <repo>/.local/chrome-review-profile — never the personal profile), one tab, real
// WebGPU. A localhost control endpoint lets later invocations and the capture
// scripts drive the SAME window (navigate / evaluate / screenshot / key press)
// instead of opening new ones. Physical camera access is mocked off.
//
// Usage:
//   node review.mjs                                  # integrated app  http://127.0.0.1:5199/
//   node review.mjs --pristine                       # pristine Tidewater  http://127.0.0.1:5189/
//   node review.mjs --url=http://127.0.0.1:5199/?debug
//   node review.mjs --display=builtin|secondary      # window placement (default builtin)
//   node review.mjs --headless [--viewport=960x540]  # no window, no profile: Playwright's Chromium (or
//                                                    # TIDEWATER_CHROMIUM=/path/to/chrome) on whatever WebGPU
//                                                    # adapter it has; TIDEWATER_WEBGPU_ADAPTER=swiftshader forces
//                                                    # Chrome's software adapter (slow, but every pixel of
//                                                    # Tidewater's renderer — the cloud verification path).
//                                                    # The same RPC endpoint, so test/*.mjs run unchanged.
//
// Control API (POST JSON to http://127.0.0.1:<port>/rpc; port in the profile's endpoint.json):
//   { op: 'navigate', url }            { op: 'eval', expr }  (expr may be an async expression)
//   { op: 'screenshot', path, type?, quality? }               { op: 'press' | 'keydown' | 'keyup', key }
//   { op: 'click' | 'mousemove', x, y, steps? }  { op: 'mousedown' | 'mouseup', button? }   { op: 'console', n? }
//   { op: 'status' }

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createServer, request } from 'node:http';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const ROOT = resolve( HERE, '..', '..' );
const APP_PORT = process.env.TIDEWATER_DOLPHIN_PORT ?? '5199';
const PRISTINE_PORT = process.env.TIDEWATER_PRISTINE_PORT ?? '5189';

const argv = process.argv.slice( 2 );
const flag = ( name ) => argv.includes( `--${ name }` );
const opt = ( name, dflt ) => ( argv.find( ( a ) => a.startsWith( `--${ name }=` ) ) ?? `--${ name }=${ dflt }` ).split( '=' ).slice( 1 ).join( '=' );

const pristine = flag( 'pristine' );
const headless = flag( 'headless' );
const viewportArg = opt( 'viewport', '' ); // headless only, e.g. 960x540
const base = pristine ? `http://127.0.0.1:${ PRISTINE_PORT }` : `http://127.0.0.1:${ APP_PORT }`;
const urlArg = argv.find( ( a ) => a.startsWith( '--url=' ) )?.split( '=' ).slice( 1 ).join( '=' );
const reviewUrl = urlArg ? ( urlArg.startsWith( 'http' ) ? urlArg : `${ base }${ urlArg.startsWith( '/' ) ? '' : '/' }${ urlArg }` ) : `${ base }/`;

// Routine review window: 1440 × 853 outer (local rules). The secondary DELL display
// bounds from the local rules are kept as a preset for when it is connected.
const DISPLAY_PRESETS = {
	builtin: { name: 'builtin', label: 'built-in display', viewport: { width: 1440, height: 760 }, args: [ '--window-position=40,40', '--window-size=1440,853' ] },
	secondary: { name: 'secondary', label: 'secondary display', viewport: { width: 1440, height: 760 }, args: [ '--window-position=153,-2529', '--window-size=1440,853' ] },
};
const display = DISPLAY_PRESETS[ opt( 'display', 'builtin' ) ] ?? DISPLAY_PRESETS.builtin;

// --- singleton: reuse a running owner ---
const USER_DATA_DIR = resolve( ROOT, '.local', 'chrome-review-profile' );
mkdirSync( USER_DATA_DIR, { recursive: true } );
const ENDPOINT_FILE = resolve( USER_DATA_DIR, 'endpoint.json' );

async function rpc( port, body ) {

	return new Promise( ( res ) => {

		const req = request( { hostname: '127.0.0.1', port, path: '/rpc', method: 'POST', timeout: 3000 }, ( response ) => {

			let data = '';
			response.on( 'data', ( c ) => data += c );
			response.on( 'end', () => res( response.statusCode === 200 ? data : null ) );

		} );
		req.on( 'error', () => res( null ) );
		req.on( 'timeout', () => { req.destroy(); res( null ); } );
		req.end( JSON.stringify( body ) );

	} );

}

if ( existsSync( ENDPOINT_FILE ) ) {

	try {

		const { port } = JSON.parse( readFileSync( ENDPOINT_FILE, 'utf8' ) );
		if ( await rpc( port, { op: 'navigate', url: reviewUrl } ) !== null ) {

			console.log( `Directed the existing review window to ${ reviewUrl }` );
			process.exit( 0 );

		}

		console.log( 'Stale endpoint file; taking ownership of the review window.' );
		rmSync( ENDPOINT_FILE, { force: true } );

	} catch {

		rmSync( ENDPOINT_FILE, { force: true } );

	}

}

// --- dev server (started only when the target is not already serving) ---
async function serverUp( url ) {

	try { await fetch( url ); return true; } catch { return false; }

}

let devServer = null;
if ( ! urlArg || urlArg.startsWith( '/' ) ) {

	if ( ! ( await serverUp( base ) ) ) {

		const cwd = pristine ? resolve( HERE, 'vendor', 'tidewater' ) : HERE;
		console.log( `starting ${ pristine ? 'pristine Tidewater' : 'tidewater-dolphin' } dev server at ${ base } …` );
		devServer = spawn( 'npm', [ 'run', 'dev' ], { cwd, stdio: 'ignore', detached: true } );
		for ( let i = 0; i < 60 && ! ( await serverUp( base ) ); i ++ ) await new Promise( ( r ) => setTimeout( r, 500 ) );
		if ( ! ( await serverUp( base ) ) ) { console.error( 'dev server failed to start' ); process.exit( 1 ); }

	}

}

// --- one persistent Chrome window, one tab (or one headless Chromium, no profile) ---
let browser = null;
let context;
if ( headless ) {

	const m = /^(\d+)x(\d+)$/.exec( viewportArg );
	const viewport = m ? { width: Number( m[ 1 ] ), height: Number( m[ 2 ] ) } : display.viewport;
	const adapter = process.env.TIDEWATER_WEBGPU_ADAPTER; // 'swiftshader' | 'default' | 'compat'
	const args = [
		'--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-gpu-watchdog', '--disable-hang-monitor',
		'--disable-gpu-process-crash-limit', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
		'--autoplay-policy=no-user-gesture-required', '--deny-permission-prompts',
	];
	if ( adapter ) args.push( `--use-webgpu-adapter=${ adapter }` );
	if ( typeof process.getuid === 'function' && process.getuid() === 0 ) args.push( '--no-sandbox' ); // containers
	browser = await chromium.launch( { headless: true, executablePath: process.env.TIDEWATER_CHROMIUM || undefined, args } );
	context = await browser.newContext( { viewport, permissions: [] } );
	display.name = 'headless';
	display.label = `headless ${ viewport.width }×${ viewport.height }${ adapter ? ` · adapter ${ adapter }` : '' }`;
	display.viewport = viewport;

} else {

	context = await chromium.launchPersistentContext( USER_DATA_DIR, {
		channel: 'chrome',
		headless: false,
		viewport: display.viewport,
		args: [ '--deny-permission-prompts', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', ...display.args ],
		permissions: [],
	} );

}

await context.addInitScript( () => {

	window.__mockedCameraAttempted = false;
	if ( navigator.mediaDevices ) {

		navigator.mediaDevices.getUserMedia = async () => {

			window.__mockedCameraAttempted = true;
			return Promise.reject( new DOMException( 'Permission denied by the BodyArcade review launcher', 'NotAllowedError' ) );

		};

	}

} );

const pages = context.pages();
const page = pages.length > 0 ? pages[ 0 ] : await context.newPage();
for ( const p of context.pages() ) if ( p !== page ) await p.close();
page.setDefaultTimeout( 0 );
const consoleLog = [];
page.on( 'console', ( m ) => { consoleLog.push( `[${ m.type() }] ${ m.text() }` ); if ( consoleLog.length > 400 ) consoleLog.shift(); } );
page.on( 'pageerror', ( e ) => consoleLog.push( `[pageerror] ${ e.message }` ) );

console.log( `navigating to ${ reviewUrl }` );
await page.goto( reviewUrl ).catch( ( e ) => console.warn( 'goto:', e.message ) );

// --- control server ---
const server = createServer( ( req, res ) => {

	if ( req.method !== 'POST' || req.url !== '/rpc' ) { res.writeHead( 404 ); return res.end(); }
	let body = '';
	req.on( 'data', ( c ) => body += c );
	req.on( 'end', async () => {

		const reply = ( code, obj ) => { res.writeHead( code, { 'Content-Type': 'application/json' } ); res.end( JSON.stringify( obj ) ); };
		try {

			const m = JSON.parse( body );
			switch ( m.op ) {

				case 'navigate':
					for ( const p of context.pages() ) if ( p !== page ) await p.close();
					consoleLog.length = 0;
					await page.goto( m.url ).catch( () => {} );
					return reply( 200, { ok: true, url: page.url() } );
				case 'eval': {

					const value = await page.evaluate( `(async () => { return (${ m.expr }); })()` );
					return reply( 200, { ok: true, value } );

				}

				case 'screenshot': {

					mkdirSync( dirname( m.path ), { recursive: true } );
					await page.screenshot( { path: m.path, type: m.type ?? 'png', quality: m.type === 'jpeg' ? ( m.quality ?? 88 ) : undefined, fullPage: false } );
					return reply( 200, { ok: true, path: m.path } );

				}

				case 'press':
					await page.keyboard.press( m.key );
					return reply( 200, { ok: true } );
				case 'keydown':
					await page.keyboard.down( m.key );
					return reply( 200, { ok: true } );
				case 'keyup':
					await page.keyboard.up( m.key );
					return reply( 200, { ok: true } );
				case 'click':
					await page.mouse.click( m.x ?? 700, m.y ?? 400 );
					return reply( 200, { ok: true } );
				case 'mousemove':
					await page.mouse.move( m.x ?? 700, m.y ?? 400, { steps: m.steps ?? 1 } );
					return reply( 200, { ok: true } );
				case 'mousedown':
					await page.mouse.down( { button: m.button ?? 'left' } );
					return reply( 200, { ok: true } );
				case 'mouseup':
					await page.mouse.up( { button: m.button ?? 'left' } );
					return reply( 200, { ok: true } );
				case 'console':
					return reply( 200, { ok: true, lines: consoleLog.slice( - ( m.n ?? 100 ) ) } );
				case 'status':
					return reply( 200, { ok: true, url: page.url(), viewport: page.viewportSize(), display: display.name, headless, cameraMockHit: await page.evaluate( 'window.__mockedCameraAttempted' ).catch( () => null ) } );
				default:
					return reply( 400, { ok: false, error: 'unknown op' } );

			}

		} catch ( err ) {

			return reply( 500, { ok: false, error: String( err && err.message || err ) } );

		}

	} );

} );

await new Promise( ( r ) => server.listen( 0, '127.0.0.1', r ) );
writeFileSync( ENDPOINT_FILE, JSON.stringify( { port: server.address().port } ) );

console.log( `viewport: ${ display.viewport.width }×${ display.viewport.height } · display: ${ display.label }${ headless ? '' : ' · ' + display.args.join( ' ' ) }` );
console.log( `camera mock: installed · browser: ${ headless ? 'headless Chromium' : 'Chrome channel' } ${ context.browser()?.version?.() ?? '' } · control port: ${ server.address().port }` );
console.log( `\nReview is live. Press Ctrl-C to close.\n` );

await new Promise( ( r ) => { context.on( 'close', r ); process.on( 'SIGINT', r ); process.on( 'SIGTERM', r ); } );
console.log( '\nclosing…' );
rmSync( ENDPOINT_FILE, { force: true } );
server.close();
await context.close().catch( () => {} );
if ( browser ) await browser.close().catch( () => {} );
if ( devServer ) { try { process.kill( - devServer.pid, 'SIGTERM' ); } catch {} }
process.exit( 0 );
