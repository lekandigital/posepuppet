// Standalone preview of the scenery-additions sites (placement, scale, orientation, ground
// contact, clearance to Tidewater's own structures), rendered with three.js in headless
// Chromium (WebGL). It uses the SAME placement records the app computes (export-sites.mjs), the
// SAME converted GLBs (public/models/additions/) and Tidewater's real terrain heights; Tidewater's
// own reef / bay structures are grey proxy spheres. It is NOT Tidewater's renderer: no water
// shading, caustics or underwater lighting — the look is approximate, the layout is exact.
//
//   node eval/preview/export-sites.mjs sites.json
//   node eval/preview/preview-sites.mjs --sites sites.json --out <dir> [--models ../../public/models/additions]

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire( import.meta.url );
let chromium;
try { ( { chromium } = require( 'playwright' ) ); } catch { ( { chromium } = require( '/home/user/posepuppet/apps/tidewater-dolphin/node_modules/@playwright/test' ) ); }
const HERE = dirname( fileURLToPath( import.meta.url ) );
const argv = process.argv.slice( 2 );
const opt = ( k, d ) => { const i = argv.indexOf( '--' + k ); return i >= 0 ? argv[ i + 1 ] : d; };
const sitesFile = resolve( opt( 'sites', join( HERE, 'sites.json' ) ) );
const out = resolve( opt( 'out', '/tmp/preview' ) );
const modelsDir = resolve( opt( 'models', join( HERE, '..', '..', 'public', 'models', 'additions' ) ) );
const THREE_DIR = resolve( HERE, '..', '..', 'tools', 'assets', 'node_modules', 'three' );
mkdirSync( out, { recursive: true } );
const MIME = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.json': 'application/json' };

const HTML = `<!doctype html><html><body style="margin:0;background:#0b2a3a"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const W = 1280, H = 720;
const renderer = new THREE.WebGLRenderer( { antialias: true, preserveDrawingBuffer: true } );
renderer.setSize( W, H ); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
document.body.appendChild( renderer.domElement );
const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight( 0xbfe0ff, 0x3a4a3a, 1.0 ); scene.add( hemi );
const sun = new THREE.DirectionalLight( 0xfff2e0, 2.6 ); sun.position.set( 60, 120, - 40 ); scene.add( sun );
const camera = new THREE.PerspectiveCamera( 55, W / H, 0.1, 3000 );
const S = await ( await fetch( '/sites.json' ) ).json();
// ---- terrain
{
	const { x0, z0, step, w, h, heights } = S.terrain;
	const geo = new THREE.PlaneGeometry( ( w - 1 ) * step, ( h - 1 ) * step, w - 1, h - 1 );
	geo.rotateX( - Math.PI / 2 );
	const pos = geo.attributes.position; const col = new Float32Array( pos.count * 3 );
	for ( let i = 0; i < pos.count; i ++ ) {
		const ix = i % w, iz = Math.floor( i / w );
		const y = heights[ iz * w + ix ];
		pos.setXYZ( i, x0 + ix * step, y, z0 + iz * step );
		// sand pale in the shallows, grey-blue deep, grass-green above 1.5 m
		const c = y > 1.5 ? [ 0.32, 0.45, 0.22 ] : y > - 0.3 ? [ 0.86, 0.8, 0.62 ] : ( () => { const t = Math.min( 1, - y / 20 ); return [ 0.8 - 0.5 * t, 0.76 - 0.38 * t, 0.6 - 0.2 * t ]; } )();
		col.set( c, i * 3 );
	}
	geo.setAttribute( 'color', new THREE.BufferAttribute( col, 3 ) ); geo.computeVertexNormals();
	scene.add( new THREE.Mesh( geo, new THREE.MeshStandardMaterial( { vertexColors: true, roughness: 1 } ) ) );
}
// ---- Tidewater's own solid items (proxies)
{
	const items = S.reefItems.filter( ( it ) => it[ 3 ] >= 1.0 );
	const n = items.length;
	const im = new THREE.InstancedMesh( new THREE.SphereGeometry( 1, 10, 8 ), new THREE.MeshStandardMaterial( { color: 0x7d7468, roughness: 0.95 } ), n );
	const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v = new THREE.Vector3(); const s = new THREE.Vector3();
	items.forEach( ( [ x, y, z, r ], i ) => { im.setMatrixAt( i, m.compose( v.set( x, y + r * 0.25, z ), q, s.set( r, r * 0.55, r ) ) ); } );
	scene.add( im );
}
// ---- pier and dock
{
	const P = S.world.pier;
	const deck = new THREE.Mesh( new THREE.BoxGeometry( P.width, 0.3, P.zEnd - P.zStart ), new THREE.MeshStandardMaterial( { color: 0x8a6a48 } ) );
	deck.position.set( P.x, P.deckHeight, ( P.zStart + P.zEnd ) / 2 ); scene.add( deck );
	const head = new THREE.Mesh( new THREE.BoxGeometry( P.headWidth, 0.3, P.headDepth ), deck.material ); head.position.set( P.x, P.deckHeight, P.zEnd - P.headDepth / 2 ); scene.add( head );
	const dock = new THREE.Mesh( new THREE.BoxGeometry( 3, 1.2, 9 ), new THREE.MeshStandardMaterial( { color: 0xd8d2c0 } ) ); dock.position.set( S.world.boatDock.x, 0.3, S.world.boatDock.z ); scene.add( dock );
}
// ---- water
const water = new THREE.Mesh( new THREE.PlaneGeometry( 1200, 1200 ), new THREE.MeshStandardMaterial( { color: 0x1f6f8f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 } ) );
water.rotation.x = - Math.PI / 2; water.position.set( 100, 0, 70 ); scene.add( water );
// ---- additions
const loader = new GLTFLoader();
const cache = new Map();
const KIND_MAT = { stone: new THREE.MeshStandardMaterial( { color: 0xc9cfd6, roughness: 0.92 } ), tint: new THREE.MeshStandardMaterial( { color: 0x2d6a2b, roughness: 0.75, side: THREE.DoubleSide } ), shark: new THREE.MeshStandardMaterial( { color: 0x6f7f8a, roughness: 0.5 } ) };
async function lod0( id ) {
	if ( ! cache.has( id ) ) cache.set( id, loader.loadAsync( '/models/' + id + '.glb' ).then( ( g ) => {
		const n = g.scene.children.find( ( c ) => c.name === 'LOD0' ) || g.scene;
		const kind = S.models[ id ] && S.models[ id ].kind;
		if ( KIND_MAT[ kind ] ) n.traverse( ( o ) => { if ( o.isMesh ) o.material = KIND_MAT[ kind ]; } );
		return n;
	} ) );
	return cache.get( id );
}
const additions = new THREE.Group(); scene.add( additions );
const perCategory = {};
for ( const c of S.categories ) {
	const g = new THREE.Group(); g.name = c.id; additions.add( g ); perCategory[ c.id ] = g;
	for ( const id in c.models ) {
		const proto = await lod0( id );
		for ( const r of c.models[ id ] ) {
			const o = proto.clone();
			o.position.set( r.x, r.y, r.z ); o.quaternion.setFromEuler( new THREE.Euler( r.pitch, r.yaw, r.roll, 'YXZ' ) ); o.scale.set( r.s[ 0 ], r.s[ 1 ], r.s[ 2 ] );
			g.add( o );
		}
	}
}
// swimmers at their loop starts + the loops; fish zones as rings
for ( const sw of S.swimmers ) {
	const proto = await lod0( sw.model ); const o = proto.clone(); const p0 = sw.path[ 0 ], p1 = sw.path[ 1 ];
	o.position.set( p0[ 0 ], p0[ 1 ], p0[ 2 ] ); o.lookAt( p1[ 0 ], p1[ 1 ], p1[ 2 ] ); perCategory.wildlife.add( o );
	const pts = [ ...sw.path, sw.path[ 0 ] ].map( ( p ) => new THREE.Vector3( p[ 0 ], p[ 1 ], p[ 2 ] ) );
	perCategory.wildlife.add( new THREE.Line( new THREE.BufferGeometry().setFromPoints( new THREE.CatmullRomCurve3( pts, true ).getPoints( 120 ) ), new THREE.LineBasicMaterial( { color: 0xffd060 } ) ) );
}
for ( const f of S.fish ) { const ring = new THREE.Mesh( new THREE.RingGeometry( f.radius - 0.3, f.radius, 48 ), new THREE.MeshBasicMaterial( { color: 0x60e0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 } ) ); ring.rotation.x = - Math.PI / 2; ring.position.set( f.center[ 0 ], - 3, f.center[ 1 ] ); perCategory.wildlife.add( ring ); }
// a 2.9 m dolphin-sized capsule at the eye position for scale
const dolphin = new THREE.Mesh( new THREE.CapsuleGeometry( 0.32, 2.2, 6, 12 ), new THREE.MeshStandardMaterial( { color: 0x9aa4ac, roughness: 0.5 } ) ); dolphin.rotation.x = Math.PI / 2; scene.add( dolphin );
window.__render = ( view ) => {
	const { x, y, z, tx, ty, tz, overhead, enhanced } = view;
	additions.visible = enhanced !== false;
	const camY = overhead ? y : y + 1.1;
	const under = camY < - 0.05;
	scene.fog = under ? new THREE.FogExp2( 0x1b5e78, 0.028 ) : new THREE.FogExp2( 0xbfd8e6, 0.0015 );
	scene.background = new THREE.Color( under ? 0x1b5e78 : 0x9fc8de );
	hemi.intensity = under ? 0.9 : 1.1; sun.intensity = under ? 1.8 : 2.6;
	if ( overhead ) { camera.position.set( x, y, z ); camera.lookAt( tx, ty, tz ); dolphin.visible = false; }
	else {
		// chase framing: the eye 1.1 m above and ~6 m behind the dolphin, looking at the target
		const d = new THREE.Vector3( tx - x, 0, tz - z ).normalize();
		camera.position.set( x - d.x * 6, y + 1.1, z - d.z * 6 ); camera.lookAt( tx, ty, tz );
		dolphin.visible = true; dolphin.position.set( x, y, z ); dolphin.lookAt( tx, y, tz ); dolphin.rotateX( Math.PI / 2 );
	}
	renderer.render( scene, camera );
	let tris = 0; additions.traverse( ( o ) => { if ( o.isMesh && o.visible && o.geometry.index ) tris += o.geometry.index.count / 3; } );
	return { tris: Math.round( tris ) };
};
window.__ready = true;
</script></body></html>`;

const server = createServer( ( req, res ) => {

	const url = decodeURIComponent( req.url.split( '?' )[ 0 ] );
	if ( url === '/' ) { res.setHeader( 'Content-Type', 'text/html' ); return res.end( HTML ); }
	if ( url === '/sites.json' ) { res.setHeader( 'Content-Type', 'application/json' ); return res.end( readFileSync( sitesFile ) ); }
	const file = url.startsWith( '/three/' ) ? join( THREE_DIR, url.slice( 7 ) ) : url.startsWith( '/models/' ) ? join( modelsDir, url.slice( 8 ) ) : null;
	if ( ! file || ! existsSync( file ) || ! statSync( file ).isFile() ) { res.statusCode = 404; return res.end(); }
	res.setHeader( 'Content-Type', MIME[ extname( file ) ] || 'application/octet-stream' );
	res.end( readFileSync( file ) );

} );
await new Promise( ( ok ) => server.listen( 0, '127.0.0.1', ok ) );
const port = server.address().port;
const CANDIDATES = [ process.env.TIDEWATER_CHROMIUM, '/opt/pw-browsers/chromium' ].filter( Boolean );
let executablePath = CANDIDATES.find( ( c ) => existsSync( c ) );
if ( ! executablePath ) { try { executablePath = execSync( 'find /opt/pw-browsers -maxdepth 4 -type f -name chrome | head -1' ).toString().trim() || undefined; } catch {} }
const browser = await chromium.launch( { headless: true, executablePath, args: [ '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader' ] } );
const page = await browser.newPage( { viewport: { width: 1280, height: 720 } } );
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) console.log( '  [page]', m.text().slice( 0, 160 ) ); } );
await page.goto( `http://127.0.0.1:${ port }/` );
await page.waitForFunction( 'window.__ready === true', null, { timeout: 300000 } );

// the dolphin-eye views (the app's shot list) and overheads of each site; Original = additions hidden
const eye = ( name, x, z, y, tx, tz, both = false ) => ( { name, x, y, z, tx, ty: y, tz, both } );
const over = ( name, cx, cz, h = 32, span = 26 ) => ( { name, x: cx, y: h, z: cz + span, tx: cx, ty: - 10, tz: cz, overhead: true } );
const VIEWS = [
	eye( 'meadow', 36, 78, - 3.6, 60, 72, true ), eye( 'kelpwall', 47, 112, - 9.5, 66, 110, true ), eye( 'kelptop', 72, 98, - 4.0, 58, 116 ),
	eye( 'wreck', 65, 100, - 8.5, 56, 114, true ), eye( 'colonnade', 4.5, 116, - 8.5, 4.5, 150 ), eye( 'temple', - 14, 146, - 12, 6, 156, true ),
	eye( 'statue', - 1, 139, - 14.5, - 9, 147 ), eye( 'plateau', 90, 134, - 4.5, 104, 124 ), eye( 'lighthouse', 150, 120, - 0.3, 222, 132 ), eye( 'shore', 112, 8, - 0.3, 118, - 30 ),
	over( 'over-wreck', 56, 114, - 2, 10 ), eye( 'wreck-bow', 50, 108, - 10.5, 56, 114 ), eye( 'wreck-side', 62, 122, - 10, 56, 114 ), eye( 'wreck-above', 56, 100, - 6, 56, 114 ),
	eye( 'statue-north', - 9, 139, - 13.5, - 9, 147 ), eye( 'temple-door', - 2, 150, - 15, 4.5, 156 ),
	eye( 'lighthouse-surface', 190, 118, 0.6, 226, 136 ), eye( 'lighthouse-beach', 150, 60, 0.6, 226, 136 ), eye( 'meadow-low', 44, 70, - 5.2, 60, 78 ), eye( 'shore-east', 112, - 10, 0.6, 118, - 30 ),
	over( 'over-temple', 6, 148, 34, 30 ), over( 'over-kelpwall', 62, 114, 30, 28 ), over( 'over-meadow', 50, 74, 26, 24 ), over( 'over-bay', 50, 110, 120, 110 ),
];
for ( const v of VIEWS ) {

	for ( const mode of v.both ? [ 'enhanced', 'original' ] : [ 'enhanced' ] ) {

		const info = await page.evaluate( ( vv ) => window.__render( vv ), { ...v, enhanced: mode === 'enhanced' } );
		await page.screenshot( { path: join( out, `preview-${ v.name }-${ mode }.jpg` ), type: 'jpeg', quality: 86 } );
		console.log( `${ v.name }-${ mode }: ${ info.tris } addition tris in the scene` );

	}

}

await browser.close();
server.close();
