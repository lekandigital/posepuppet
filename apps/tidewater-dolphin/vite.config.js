import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// BodyArcade Tidewater Dolphin (Checkpoint 10).
//
// Tidewater is vendored *unmodified* at vendor/tidewater/ (pinned commit
// 4811ba4, see vendor/tidewater/BODYARCADE_SOURCE_RECORD.md). The app imports
// its engine / ocean / sky / world / post modules in place; its public assets
// (whale, characters, debris, props, audio, clouds, SMAA, key art) must be
// served at the same root-relative URLs the vendored code fetches them from
// (`models/whale/humpback.json`, `audio/*.ogg`, ...), and the app adds its own
// assets (the licensed GAMICO dolphin GLB) without copying 51 MB of vendor
// assets into a second tree. Vite has one publicDir, so this config serves an
// ordered list of static roots instead: app public/ first, vendor public/
// second (dev middleware), and copies both into dist/ at build.

const APP = fileURLToPath( new URL( '.', import.meta.url ) );
const APP_PUBLIC = resolve( APP, 'public' );
const VENDOR_PUBLIC = resolve( APP, 'vendor/tidewater/public' );
const DIST = resolve( APP, 'dist' );
const ROOTS = [ APP_PUBLIC, VENDOR_PUBLIC ];

const MIME = {
	'.glb': 'model/gltf-binary',
	'.gltf': 'model/gltf+json',
	'.bin': 'application/octet-stream',
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ogg': 'audio/ogg',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.wasm': 'application/wasm',
};

function staticRoots() {

	return {
		name: 'bodyarcade-static-roots',
		configureServer( server ) {

			server.middlewares.use( ( req, res, next ) => {

				const url = decodeURIComponent( ( req.url ?? '' ).split( '?' )[ 0 ] );
				if ( url === '/' || url.startsWith( '/src/' ) || url.startsWith( '/vendor/' ) || url.startsWith( '/@' ) || url.startsWith( '/node_modules/' ) ) return next();
				for ( const root of ROOTS ) {

					const file = normalize( join( root, url ) );
					if ( ! file.startsWith( root ) || ! existsSync( file ) || ! statSync( file ).isFile() ) continue;
					res.setHeader( 'Content-Type', MIME[ extname( file ).toLowerCase() ] ?? 'application/octet-stream' );
					res.setHeader( 'Cache-Control', 'no-cache' );
					createReadStream( file ).pipe( res );
					return;

				}

				next();

			} );

		},
		closeBundle() {

			// vendor first so app assets win on a path collision (there are none today)
			for ( const root of [ VENDOR_PUBLIC, APP_PUBLIC ] ) if ( existsSync( root ) ) cpSync( root, DIST, { recursive: true } );

		},
	};

}

export default defineConfig( {
	base: './',
	publicDir: false,
	plugins: [ staticRoots() ],
	resolve: {
		alias: {
			'@bodyarcade/body-input': fileURLToPath( new URL( '../../packages/body-input/src/index.ts', import.meta.url ) ),
		},
	},
	server: {
		port: 5199,
		strictPort: true,
		host: '127.0.0.1',
		fs: { allow: [ '..', '../..' ] },
	},
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
} );
