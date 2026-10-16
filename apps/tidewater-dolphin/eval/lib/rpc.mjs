// Client for the review launcher's control endpoint (review.mjs). The launcher owns the one
// persistent headed Chrome window; scripts drive it through here.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';

const ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ), '..', '..', '..', '..' );
const ENDPOINT_FILE = resolve( ROOT, '.local', 'chrome-review-profile', 'endpoint.json' );

export function endpointPort() {

	if ( ! existsSync( ENDPOINT_FILE ) ) throw new Error( 'review window is not running: start `node review.mjs` (or `--pristine`) first' );
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
export const consoleLines = async ( n = 100 ) => ( await rpc( { op: 'console', n } ) ).lines;
export const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

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
