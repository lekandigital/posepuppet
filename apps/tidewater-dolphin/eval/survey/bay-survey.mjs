// Headless survey of Tidewater's bay for environment-authoring work (asset-integration pass):
// bathymetry, Tidewater's own reef / bay-floor scatter occupancy, the big existing structures
// and the procedural reef model sizes. No GPU: TerrainData is built as the app builds it, and the
// reef's PLACEMENT methods are run on a bare object that borrows Reef.prototype (the GPU batches
// are never created). Everything printed is a pure function of the vendored Tidewater source.
//
//   node eval/survey/bay-survey.mjs            # maps + probes (≈8 s)
//   node eval/survey/bay-survey.mjs --models   # + reef model radii / tops (for height caps)
//
// Map legend: depth digits are metres (A 10–11, B 12–13, C 14–15, D 16–17, E 18+; # land);
// scatter: S big solid (r > 1.3 m), s solid (r > 0.9), c 3+ coral/sponge colonies, p 3+ plants,
// , sparse, . empty; P pier, D boat dock, @ dolphin spawn.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const V = resolve( dirname( fileURLToPath( import.meta.url ) ), '..', '..', 'vendor', 'tidewater', 'src' ) + '/';
const { TerrainData } = await import( V + 'world/TerrainData.js' );
const { WORLD } = await import( V + 'world/WorldLayout.js' );
const { Reef } = await import( V + 'world/Reef.js' );
const { mulberry32, Noise2D } = await import( V + 'util/Noise.js' );

const argv = process.argv.slice( 2 );
const t0 = performance.now();
const T = new TerrainData();
// the reef's placement, exactly as the app runs it (same seeds), without its render objects
const r = Object.create( Reef.prototype );
r.terrain = T; r.center = WORLD.reef.center.clone(); r.radius = WORLD.reef.radius;
r.rng = mulberry32( 20260923 ); r.noise = new Noise2D( 4242 ); r.noise2 = new Noise2D( 977 ); r.timings = {};
r.buildKinds(); r.initFields(); r.items = { hard: [], soft: [] }; r.placeLayers();
console.log( `terrain + reef placement ${ ( ( performance.now() - t0 ) / 1000 ).toFixed( 1 ) } s · hard ${ r.items.hard.length } · soft ${ r.items.soft.length } · reef region x ${ r.x0 }..${ r.x1 } z ${ r.z0 }..${ r.z1 }` );

if ( argv.includes( '--models' ) ) {

	console.log( '\nmodel: per variant radius | top (unit scale, LOD0) | lods | shadow proxy' );
	for ( const [ name, list ] of Object.entries( r.models ) ) console.log( name.padEnd( 11 ), list.map( ( m ) => `r${ m.radius.toFixed( 2 ) } top${ m.top.toFixed( 2 ) } lods${ m.lods }${ m.proxy >= 0 ? ' shadow' : '' }` ).join( ' | ' ) );

}

const PLANT = new Set( [ 'meadow', 'halimeda', 'penicillus', 'sargassum', 'grass' ] );
const SMALL = new Set( [ 'rubble', 'urchin', 'starfish', 'cucumber', 'conch' ] );
const SOLID = new Set( [ 'slab', 'rock', 'boulder', 'bayRock', 'baySlab', 'bayBoulder', 'shoreRock', 'lobes', 'brainWide', 'barrel', 'barrelDeep', 'pillar', 'plate', 'wallPlate', 'brain', 'starlet', 'knobby', 'elkhorn' ] );
const X0 = - 45, X1 = 150, Z0 = 30, Z1 = 175, C = 5;
const W = Math.ceil( ( X1 - X0 ) / C ), H = Math.ceil( ( Z1 - Z0 ) / C );
const cnt = { plant: new Uint16Array( W * H ), small: new Uint16Array( W * H ), solid: new Uint16Array( W * H ), coral: new Uint16Array( W * H ), big: new Uint16Array( W * H ) };
const bigList = [];
for ( const it of [ ...r.items.hard, ...r.items.soft ] ) {

	const i = Math.floor( ( it.x - X0 ) / C ), j = Math.floor( ( it.z - Z0 ) / C );
	if ( i < 0 || j < 0 || i >= W || j >= H ) continue;
	const k = j * W + i;
	if ( PLANT.has( it.name ) ) cnt.plant[ k ] ++;
	else if ( SMALL.has( it.name ) ) cnt.small[ k ] ++;
	else if ( SOLID.has( it.name ) && it.radius > 0.9 ) { cnt.solid[ k ] ++; if ( it.radius > 1.3 ) { cnt.big[ k ] ++; if ( it.x > 25 && it.z > 40 ) bigList.push( [ it.name, + it.x.toFixed( 1 ), + it.z.toFixed( 1 ), + it.radius.toFixed( 2 ), + ( - T.heightAt( it.x, it.z ) ).toFixed( 1 ) ] ); } }
	else cnt.coral[ k ] ++;

}

let cols = '     ';
for ( let i = 0; i < W; i ++ ) { const x = X0 + i * C; cols += ( x % 25 === 0 ) ? String( x ).slice( - 1 ) : ' '; }
const depthChar = ( d ) => d <= 0 ? '#' : d < 10 ? String( Math.floor( d ) ) : d < 12 ? 'A' : d < 14 ? 'B' : d < 16 ? 'C' : d < 18 ? 'D' : 'E';
console.log( '\nDEPTH (m)  columns every 5 m from x = -45 (ticks at x % 25 = 0)' );
console.log( cols );
for ( let j = 0; j < H; j ++ ) { const z = Z0 + j * C; let line = String( z ).padStart( 4 ) + ' '; for ( let i = 0; i < W; i ++ ) line += depthChar( - T.heightAt( X0 + i * C + C / 2, z + C / 2 ) ); console.log( line ); }
console.log( '\nTIDEWATER SCATTER per 5 m cell' );
console.log( cols );
for ( let j = 0; j < H; j ++ ) {

	const z = Z0 + j * C;
	let line = String( z ).padStart( 4 ) + ' ';
	for ( let i = 0; i < W; i ++ ) {

		const k = j * W + i, x = X0 + i * C + C / 2, d = - T.heightAt( x, z + C / 2 );
		let ch = d <= 0 ? '#' : '.';
		if ( d > 0 ) { if ( cnt.big[ k ] ) ch = 'S'; else if ( cnt.solid[ k ] ) ch = 's'; else if ( cnt.coral[ k ] >= 3 ) ch = 'c'; else if ( cnt.plant[ k ] >= 3 ) ch = 'p'; else if ( cnt.plant[ k ] + cnt.coral[ k ] + cnt.small[ k ] > 0 ) ch = ','; }
		if ( Math.abs( x - WORLD.pier.x ) < C / 2 && z + C / 2 < WORLD.pier.zEnd ) ch = 'P';
		if ( Math.hypot( x - WORLD.boatDock.position.x, z + C / 2 - WORLD.boatDock.position.z ) < 3 ) ch = 'D';
		if ( Math.hypot( x, z + C / 2 - 66 ) < 3 ) ch = '@';
		line += ch;

	}

	console.log( line );

}

console.log( '\nbig solid Tidewater items east of x = 25, south of z = 40 (name x z radius depth):' );
bigList.sort( ( a, b ) => a[ 2 ] - b[ 2 ] );
console.log( bigList.map( ( b ) => b.join( ' ' ) ).join( '\n' ) );
const probe = ( name, x, z ) => console.log( name.padEnd( 18 ), `x ${ x } z ${ z } depth ${ ( - T.heightAt( x, z ) ).toFixed( 2 ) } reefStruct ${ ( r.structureAt( x, z ) - T.heightAt( x, z ) ).toFixed( 2 ) } items<8m ${ [ ...r.items.hard, ...r.items.soft ].filter( ( it ) => Math.hypot( it.x - x, it.z - z ) < 8 ).length }` );
console.log( '\nprobes:' );
for ( const [ n, x, z ] of [ [ 'spawn', 0, 66 ], [ 'pier head', 55, 40 ], [ 'east wall', 57, 87 ], [ 'east plateau', 93, 128 ], [ 'basin floor', 12, 145 ], [ 'east shallows', 110, 90 ] ] ) probe( n, x, z );
console.log( '\ncounts', JSON.stringify( r.counts ) );
