// CP10 visual-parity comparison: pristine Tidewater (A) vs the integrated app (B / Bhidden),
// view by view, on the Bench reference shots (same pose, time of day, lens, clock, settle frames).
//
//   node eval/compare.mjs --a=A --b=Bhidden            # environment parity (dolphin not in the scene)
//   node eval/compare.mjs --a=A --b=B                  # dolphin visible: differences are the dolphin
//   node eval/compare.mjs --a=Aseq --b=Bhiddenseq      # moving-water sequences
//
// Metrics per view (8-bit RGB): mean absolute difference over all channels (MAD), PSNR, fraction of
// pixels whose max channel difference exceeds 8 and 32, the bounding box of pixels differing by
// more than 8, and an amplified |A−B| image (×8) written to captures/diff-<a>-<b>/<view>.png.
// Tolerances (documented, not tuned to pass): a view is "identical" at MAD < 0.05 and 0 pixels > 32;
// "within noise" at MAD < 0.5 and < 0.5 % pixels > 32 (temporal jitter / RNG); otherwise "differs".

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './lib/png.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const argv = process.argv.slice( 2 );
const opt = ( k, d ) => ( argv.find( ( a ) => a.startsWith( `--${ k }=` ) ) ?? `--${ k }=${ d }` ).split( '=' ).slice( 1 ).join( '=' );
const A = opt( 'a', 'A' ), B = opt( 'b', 'Bhidden' );
const root = resolve( HERE, opt( 'out', 'captures' ) );
const dirA = resolve( root, A ), dirB = resolve( root, B ), dirD = resolve( root, `diff-${ A }-${ B }` );
mkdirSync( dirD, { recursive: true } );

const views = readdirSync( dirA ).filter( ( f ) => f.endsWith( '.png' ) ).map( ( f ) => f.slice( 0, - 4 ) ).filter( ( v ) => existsSync( resolve( dirB, v + '.png' ) ) ).sort();
const rows = [];
for ( const v of views ) {

	const a = decodePNG( readFileSync( resolve( dirA, v + '.png' ) ) );
	const b = decodePNG( readFileSync( resolve( dirB, v + '.png' ) ) );
	if ( a.width !== b.width || a.height !== b.height || a.channels !== b.channels ) { rows.push( { view: v, verdict: 'size mismatch' } ); continue; }
	const n = a.width * a.height, c = a.channels;
	const diff = new Uint8Array( n * 3 );
	let sum = 0, sq = 0, gt8 = 0, gt32 = 0, maxd = 0;
	let x0 = a.width, y0 = a.height, x1 = - 1, y1 = - 1;
	for ( let p = 0; p < n; p ++ ) {

		let m = 0;
		for ( let k = 0; k < 3; k ++ ) {

			const d = Math.abs( a.data[ p * c + k ] - b.data[ p * c + k ] );
			sum += d; sq += d * d;
			if ( d > m ) m = d;
			diff[ p * 3 + k ] = Math.min( 255, d * 8 );

		}

		if ( m > maxd ) maxd = m;
		if ( m > 8 ) {

			gt8 ++;
			const x = p % a.width, y = ( p / a.width ) | 0;
			if ( x < x0 ) x0 = x; if ( x > x1 ) x1 = x; if ( y < y0 ) y0 = y; if ( y > y1 ) y1 = y;

		}

		if ( m > 32 ) gt32 ++;

	}

	const mad = sum / ( n * 3 ), mse = sq / ( n * 3 );
	const psnr = mse === 0 ? Infinity : 10 * Math.log10( 255 * 255 / mse );
	const f8 = gt8 / n, f32 = gt32 / n;
	const verdict = mad < 0.05 && gt32 === 0 ? 'identical' : mad < 0.5 && f32 < 0.005 ? 'within noise' : 'differs';
	writeFileSync( resolve( dirD, v + '.png' ), encodePNG( a.width, a.height, diff, 3 ) );
	rows.push( { view: v, mad: + mad.toFixed( 4 ), psnr: psnr === Infinity ? 'inf' : + psnr.toFixed( 2 ), maxDiff: maxd, pctOver8: + ( f8 * 100 ).toFixed( 3 ), pctOver32: + ( f32 * 100 ).toFixed( 3 ), bbox: x1 >= 0 ? [ x0, y0, x1, y1 ] : null, verdict } );
	console.log( `${ v.padEnd( 16 ) } MAD ${ mad.toFixed( 4 ).padStart( 7 ) }  PSNR ${ ( psnr === Infinity ? '   inf' : psnr.toFixed( 1 ).padStart( 6 ) ) }  >8: ${ ( f8 * 100 ).toFixed( 3 ).padStart( 7 ) }%  >32: ${ ( f32 * 100 ).toFixed( 3 ).padStart( 7 ) }%  max ${ String( maxd ).padStart( 3 ) }  ${ verdict }${ x1 >= 0 ? `  bbox ${ x0 },${ y0 }–${ x1 },${ y1 }` : '' }` );

}

const summary = { a: A, b: B, comparedAt: new Date().toISOString(), tolerances: { identical: 'MAD < 0.05 and no pixel > 32', withinNoise: 'MAD < 0.5 and < 0.5 % pixels > 32' }, rows };
writeFileSync( resolve( root, `compare-${ A }-${ B }.json` ), JSON.stringify( summary, null, 2 ) );
const counts = rows.reduce( ( m, r ) => ( m[ r.verdict ] = ( m[ r.verdict ] || 0 ) + 1, m ), {} );
console.log( `\n${ views.length } views: ${ JSON.stringify( counts ) } → compare-${ A }-${ B }.json, diffs in ${ dirD }` );
