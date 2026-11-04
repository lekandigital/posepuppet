// Exports the scenery-additions placement for the standalone site preview (preview-sites.mjs):
// the deterministic records of every category (the same code path the app runs, on Tidewater's
// deterministic terrain and reef, no GPU), the swimmer loops, the fish zones, Tidewater's own
// solid reef / bay items as proxies, and a terrain height grid around each site.
//
//   node eval/preview/export-sites.mjs <out.json>

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const V = resolve( HERE, '..', '..', 'vendor', 'tidewater', 'src' ) + '/';
const { TerrainData } = await import( V + 'world/TerrainData.js' );
const { WORLD } = await import( V + 'world/WorldLayout.js' );
const { Reef } = await import( V + 'world/Reef.js' );
const { mulberry32, Noise2D } = await import( V + 'util/Noise.js' );
const { SceneryAdditions, MODELS, ADDITION_CATEGORIES } = await import( resolve( HERE, '..', '..', 'src', 'additions', 'SceneryAdditions.js' ) );

const T = new TerrainData();
const reef = Object.create( Reef.prototype );
reef.terrain = T; reef.center = WORLD.reef.center.clone(); reef.radius = WORLD.reef.radius;
reef.rng = mulberry32( 20260923 ); reef.noise = new Noise2D( 4242 ); reef.noise2 = new Noise2D( 977 ); reef.timings = {};
reef.buildKinds(); reef.initFields(); reef.items = { hard: [], soft: [] }; reef.placeLayers();
const app = { scene: { add() {} }, qs: new URLSearchParams( '' ), terrainData: T, reef, colliders: null, debris: null, terrainGPU: null, shoreField: null };
const add = new SceneryAdditions( app );

const out = { models: MODELS, categories: [], swimmers: [], fish: [], reefItems: [], terrain: {}, world: { pier: WORLD.pier, boatDock: WORLD.boatDock.position, spawn: [ 0, 66 ] } };
for ( const c of ADDITION_CATEGORIES ) {

	const P = add.placed[ c.id ];
	const models = {};
	for ( const id in P.models || {} ) models[ id ] = P.models[ id ].map( ( r ) => ( { x: r.x, y: r.y, z: r.z, yaw: r.yaw || 0, pitch: r.pitch || 0, roll: r.roll || 0, s: Array.isArray( r.s ) ? r.s : [ r.s ?? 1, r.s ?? 1, r.s ?? 1 ] } ) );
	out.categories.push( { id: c.id, label: c.label, models, scan: ( P.scan || [] ).map( ( r ) => ( { asset: r.asset, x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch || 0, roll: r.roll || 0, s: [ r.sx, r.sy, r.sz ] } ) ) } );
	for ( const sw of P.swimmers || [] ) out.swimmers.push( { id: sw.id, model: sw.model, path: sw.path } );
	for ( const f of P.fish || [] ) out.fish.push( { id: f.id, center: f.center, radius: f.radius } );

}

// Tidewater's own solid items (coral heads, rocks, slabs) east of the reef proper: proxies (the
// opaque batch also holds the meadow tufts and other plants / small life: left out)
const PLANT = new Set( [ 'meadow', 'halimeda', 'penicillus', 'sargassum', 'grass', 'rubble', 'urchin', 'starfish', 'cucumber', 'conch', 'rod', 'tube', 'whip', 'plume', 'fan' ] );
for ( const it of reef.items.hard ) if ( it.radius > 0.6 && it.x > - 40 && ! PLANT.has( it.name ) ) out.reefItems.push( [ + it.x.toFixed( 2 ), + T.heightAt( it.x, it.z ).toFixed( 2 ), + it.z.toFixed( 2 ), + it.radius.toFixed( 2 ), it.name ] );
// terrain height grid over the bay (1 m), x -60..260, z -60..200
const X0 = - 60, X1 = 260, Z0 = - 60, Z1 = 200, STEP = 1;
const W = ( X1 - X0 ) / STEP + 1, H = ( Z1 - Z0 ) / STEP + 1;
const heights = new Array( W * H );
for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) heights[ j * W + i ] = + T.heightAt( X0 + i * STEP, Z0 + j * STEP ).toFixed( 2 );
out.terrain = { x0: X0, z0: Z0, step: STEP, w: W, h: H, heights };
const file = resolve( process.argv[ 2 ] || resolve( HERE, 'sites.json' ) );
writeFileSync( file, JSON.stringify( out ) );
console.log( 'exported', file, 'categories', out.categories.length, 'reef proxies', out.reefItems.length, 'grid', W, 'x', H );
