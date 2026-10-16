// Local collector for Tidewater's Bench.shots() / Bench.auto() uploads (core/Bench.js posts
// `tag-view[-k].bgra` images and `bench-tag.json` timings to http://127.0.0.1:5190/).
// Saves PNGs under <outDir>/<tag>/<view>[-k].png and JSON next to them. CORS-open: the page
// origin is 127.0.0.1:5189 / :5199.

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bgraUploadToPNG } from './png.mjs';

export function startCollector( { port = 5190, outDir, onFile = () => {} } = {} ) {

	const received = [];
	const server = createServer( ( req, res ) => {

		const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
		if ( req.method === 'OPTIONS' ) { res.writeHead( 204, cors ); return res.end(); }
		if ( req.method !== 'POST' ) { res.writeHead( 404, cors ); return res.end(); }
		const chunks = [];
		req.on( 'data', ( c ) => chunks.push( c ) );
		req.on( 'end', () => {

			try {

				const body = Buffer.concat( chunks );
				const name = decodeURIComponent( req.url.replace( /^\//, '' ) );
				let path;
				if ( name.endsWith( '.bgra' ) ) {

					// tag-view[-k].bgra → <outDir>/<tag>/<view[-k]>.png (tag = text before the first '-')
					const stem = name.slice( 0, - 5 );
					const dash = stem.indexOf( '-' );
					const tag = dash > 0 ? stem.slice( 0, dash ) : 'shot', view = dash > 0 ? stem.slice( dash + 1 ) : stem;
					const { width, height, png } = bgraUploadToPNG( body );
					path = resolve( outDir, tag, view + '.png' );
					mkdirSync( dirname( path ), { recursive: true } );
					writeFileSync( path, png );
					received.push( { name, path, width, height } );
					onFile( { name, path, width, height } );

				} else {

					path = resolve( outDir, name );
					mkdirSync( dirname( path ), { recursive: true } );
					writeFileSync( path, body );
					received.push( { name, path } );
					onFile( { name, path } );

				}

				res.writeHead( 200, cors );
				res.end( 'ok' );

			} catch ( err ) {

				res.writeHead( 500, cors );
				res.end( String( err ) );

			}

		} );

	} );
	return new Promise( ( ok ) => server.listen( port, '127.0.0.1', () => ok( { server, received, close: () => server.close() } ) ) );

}
