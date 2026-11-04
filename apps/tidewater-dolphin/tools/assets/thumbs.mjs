// Visual check of the converted runtime GLBs: renders each asset (all LOD nodes side by side,
// 1 m grid, 1.8 m reference post) with three.js in headless Chromium (WebGL, software rasteriser
// in the cloud) and writes <out>/<id>.png. Not Tidewater's renderer: this checks geometry, pivot,
// scale, alpha masks and textures of the files, not their look under water.
//
//   node thumbs.mjs --dir ../../public/models/additions --out /tmp/thumbs [--only a,b]

import { createRequire } from 'node:module';
const require = createRequire( import.meta.url );
let chromium;
try { ( { chromium } = require( 'playwright' ) ); } catch { ( { chromium } = require( '/home/user/posepuppet/apps/tidewater-dolphin/node_modules/@playwright/test' ) ); }
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const argv = process.argv.slice( 2 );
const opt = ( k, d ) => { const i = argv.indexOf( '--' + k ); return i >= 0 ? argv[ i + 1 ] : d; };
const dir = resolve( opt( 'dir', '../../public/models/additions' ) );
const out = resolve( opt( 'out', '/tmp/thumbs' ) );
const only = opt( 'only', '' ) ? new Set( opt( 'only', '' ).split( ',' ) ) : null;
mkdirSync( out, { recursive: true } );
const THREE_DIR = resolve( 'node_modules/three' );
const MIME = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.json': 'application/json' };
const HTML = `<!doctype html><html><body style="margin:0;background:#1d2630"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const W = 1200, H = 700;
const renderer = new THREE.WebGLRenderer( { antialias: true, preserveDrawingBuffer: true } );
renderer.setSize( W, H ); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild( renderer.domElement );
const scene = new THREE.Scene(); scene.background = new THREE.Color( 0x1d2630 );
scene.add( new THREE.HemisphereLight( 0xcfe3ff, 0x4a4030, 1.2 ) );
const sun = new THREE.DirectionalLight( 0xffffff, 2.2 ); sun.position.set( 3, 6, 4 ); scene.add( sun );
const camera = new THREE.PerspectiveCamera( 40, W / H, 0.05, 2000 );
const loader = new GLTFLoader();
window.__render = async ( url ) => {
	for ( const o of [ ...scene.children ] ) if ( o.userData.asset ) scene.remove( o );
	const gltf = await loader.loadAsync( url );
	const root = gltf.scene; root.userData.asset = true;
	const lods = root.children.filter( ( n ) => /^LOD\\d/.test( n.name ) ).sort( ( a, b ) => a.name.localeCompare( b.name ) );
	const box = new THREE.Box3().setFromObject( lods[ 0 ] || root );
	const size = box.getSize( new THREE.Vector3() ); const maxDim = Math.max( size.x, size.y, size.z );
	// LODs side by side along x
	let x = 0; const gap = size.x * 1.25 + maxDim * 0.1;
	for ( const l of lods ) { l.position.x = x; x += gap; }
	scene.add( root );
	const grid = new THREE.GridHelper( Math.max( 4, Math.ceil( maxDim * 1.5 ) * 2 ), Math.max( 4, Math.ceil( maxDim * 1.5 ) * 2 ), 0x667788, 0x3a4652 ); grid.userData.asset = true; grid.position.y = box.min.y; scene.add( grid );
	const post = new THREE.Mesh( new THREE.CylinderGeometry( 0.06, 0.06, 1.8, 12 ), new THREE.MeshStandardMaterial( { color: 0xe0b060 } ) ); post.position.set( - size.x * 0.75 - 0.3, box.min.y + 0.9, 0 ); post.userData.asset = true; scene.add( post );
	const all = new THREE.Box3().setFromObject( root ).union( new THREE.Box3().setFromObject( post ) );
	const c = all.getCenter( new THREE.Vector3() ); const s = all.getSize( new THREE.Vector3() ); const r = Math.max( s.x, s.y, s.z );
	camera.position.set( c.x + r * 0.9, c.y + r * 0.55, c.z + r * 1.25 ); camera.lookAt( c ); camera.near = r * 0.01; camera.far = r * 10; camera.updateProjectionMatrix();
	renderer.render( scene, camera );
	let tris = 0; root.traverse( ( o ) => { if ( o.isMesh ) tris += ( o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count ) / 3; } );
	return { size: [ size.x, size.y, size.z ].map( ( v ) => + v.toFixed( 2 ) ), minY: + box.min.y.toFixed( 3 ), lods: lods.map( ( l ) => l.name ), tris: Math.round( tris ), mats: [ ...new Set( [] ) ] };
};
window.__ready = true;
</script></body></html>`;
const server = createServer( ( req, res ) => {

	const url = decodeURIComponent( req.url.split( '?' )[ 0 ] );
	if ( url === '/' ) { res.setHeader( 'Content-Type', 'text/html' ); return res.end( HTML ); }
	const file = url.startsWith( '/three/' ) ? join( THREE_DIR, url.slice( 7 ) ) : url.startsWith( '/models/' ) ? join( dir, url.slice( 8 ) ) : null;
	if ( ! file || ! existsSync( file ) || ! statSync( file ).isFile() ) { res.statusCode = 404; return res.end(); }
	res.setHeader( 'Content-Type', MIME[ extname( file ) ] || 'application/octet-stream' );
	res.end( readFileSync( file ) );

} );
await new Promise( ( ok ) => server.listen( 0, '127.0.0.1', ok ) );
const port = server.address().port;
import { execSync } from 'node:child_process';
const CANDIDATES = [ process.env.TIDEWATER_CHROMIUM, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium/chrome' ].filter( Boolean );
let executablePath = CANDIDATES.find( ( c ) => existsSync( c ) && statSync( c ).isFile() );
if ( ! executablePath ) { try { executablePath = execSync( 'find /opt/pw-browsers -maxdepth 4 -type f -name chrome | head -1' ).toString().trim() || undefined; } catch {} }
console.log( 'chromium:', executablePath || '(playwright default)' );
const browser = await chromium.launch( { headless: true, executablePath, args: [ '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader' ] } );
const page = await browser.newPage( { viewport: { width: 1200, height: 700 } } );
page.on( 'console', ( m ) => { if ( m.type() === 'error' || m.type() === 'warning' ) console.log( '  [page]', m.text().slice( 0, 160 ) ); } );
await page.goto( `http://127.0.0.1:${ port }/` );
await page.waitForFunction( 'window.__ready === true', null, { timeout: 60000 } );
const files = readdirSync( dir ).filter( ( f ) => f.endsWith( '.glb' ) && ( ! only || only.has( f.replace( '.glb', '' ) ) ) ).sort();
for ( const f of files ) {

	try {

		const info = await page.evaluate( `window.__render( ${ JSON.stringify( '/models/' + f ) } )` );
		await page.screenshot( { path: join( out, f.replace( '.glb', '.png' ) ) } );
		console.log( `${ f.padEnd( 24 ) } size ${ info.size.join( ' × ' ) } m  minY ${ info.minY }  lods ${ info.lods.join( ',' ) }  tris(all lods) ${ info.tris }` );

	} catch ( e ) { console.log( `${ f }: ERROR ${ e.message.slice( 0, 200 ) }` ); }

}

await browser.close();
server.close();
