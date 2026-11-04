// SceneryAdditions — the optional, reversible scenery layer over the pristine Tidewater world
// (CP10 continuation, Phase D: asset curation; asset-integration pass: the user's Ubuntu model
// library).
//
// Two kinds of additions, all deterministic (mulberry32, fixed seeds, fixed anchors), all
// additive (nothing of Tidewater's own placement, terrain, water or wildlife is touched), each
// toggled per category in the Play tab; all categories off == the pristine scene exactly
// (`?original` forces that, `?enhanced` forces all on; default on):
//
//   1. Tidewater's own Poly Haven scans re-instanced through its ScannedDebris pipeline
//      (sunkenWood, seabedShells — CP10 continuation, unchanged).
//   2. Imported models from the user's Ubuntu model-lab (CC0 / CC-BY, converted by
//      tools/assets/convert.mjs into public/models/additions/, provenance in its manifest.json
//      and CREDITS.md), drawn by GLBScenery.js through the engine's own loader, textures,
//      materials and LOD cross-fade; swimmers (Swimmers.js) and site fish communities made of
//      Tidewater's own procedural fish (SiteFish.js). The sites were authored on the headless
//      survey (eval/survey/bay-survey.mjs) of the bay:
//        seagrassMeadows — blade-clump beds on the shallow bay floor east of the spawn and on the
//                          east plateau, a sunken skiff, algae rocks;
//        kelpWall        — a kelp forest on the east wall of the deep channel (7–13 m), thickets
//                          and understory, boulders;
//        wreck           — a fishing boat listing at the foot of the wall (12.5 m), grown over;
//        drownedTemple   — a colonnade leading into the deep basin (11 → 18 m) to a temple, ruined
//                          walls, a carved head, fallen columns and slabs, boulders, kelp on the rim;
//        wildlife        — a manatee pair grazing the spawn meadow, a hammerhead patrolling the
//                          wall, reef-fish communities at the wreck and the temple;
//        headland        — a lighthouse on the eastern headland, Poly Haven scrub and debris on
//                          the back-beach (above water: visible from the surface cameras).
//
// Solid imported structures are rasterised into max-height fields (GLBScenery.StructureField):
// structureAt() is the contact surface the dolphin's sim and camera, Tidewater's walker and the
// fish see through the composite `ground` / `floor` objects (DolphinApp wires them in). Every
// solid top stays below −2.5 m, so the dolphin's swimmable mask (built once from the reef's
// field) is identical with the additions on or off; toggling only changes the contact surface.

import { Group, Vector3, Quaternion, Euler, Matrix4, Frustum, Sphere, BufferGeometry, InstancedBufferAttribute, InstancedMesh, DynamicDrawUsage } from '../../vendor/tidewater/src/engine/index.js';
import { bandFade } from '../../vendor/tidewater/src/materials/LODFade.js';
import { SCAN, SCAN_SIZE, SCAN_ASSETS } from '../../vendor/tidewater/src/world/debris/ScannedDebris.js';
import { WORLD } from '../../vendor/tidewater/src/world/WorldLayout.js';
import { SceneryModel, ModelInstances, StructureField, recordMatrix, ADDITIONS_BASE } from './GLBScenery.js';
import { Swimmer } from './Swimmers.js';
import { SiteFish } from './SiteFish.js';

const TAU = Math.PI * 2;
// ScannedDebris' own LOD distances / cross-fade band (module constants there; mirrored)
const LOD_DIST = [ 22, 70, 260 ];
const BAND = 0.12;
const TOP_LIMIT = - 2.5; // highest point of any solid addition (m): keeps the swimmable mask unchanged
const KELP_TOP = - 1.5; // highest frond tip of the kelp / weed (m)

const SOURCE = {
	polyhaven: 'Poly Haven (https://polyhaven.com), CC0 1.0 — as shipped in Tidewater (vendor/tidewater/public/models/debris/, processed LODs per its CREDITS.md)',
	library: 'the user\'s Ubuntu model-lab (CC0 / CC-BY; public/models/additions/CREDITS.md and manifest.json: title, author, source page, licence, lab path, SHA-256)',
};
const ASSET_INFO = {
	[ SCAN.TRUNK ]: { id: 'dead_quiver_trunk', path: 'vendor/tidewater/public/models/debris/dead_quiver_trunk.glb', source: 'https://polyhaven.com/a/dead_quiver_trunk', license: 'CC0 1.0', variant: 'Tidewater LOD export (4000 / 700 / 160 tris), 1K textures in the shared 2K atlas' },
	[ SCAN.BRANCH_A ]: { id: 'dead_quiver_branch_02', path: 'vendor/tidewater/public/models/debris/dead_quiver_branch_02.glb', source: 'https://polyhaven.com/a/dead_quiver_branch_02', license: 'CC0 1.0', variant: 'Tidewater LOD export (2600 / 500 / 120 tris)' },
	[ SCAN.BRANCH_B ]: { id: 'dead_quiver_branch_01', path: 'vendor/tidewater/public/models/debris/dead_quiver_branch_01.glb', source: 'https://polyhaven.com/a/dead_quiver_branch_01', license: 'CC0 1.0', variant: 'Tidewater LOD export (2600 / 500 / 120 tris)' },
	[ SCAN.SHELL ]: { id: 'lambis_shell', path: 'vendor/tidewater/public/models/debris/lambis_shell.glb', source: 'https://polyhaven.com/a/lambis_shell', license: 'CC0 1.0', variant: 'Tidewater LOD export (1400 / 300 / 80 tris)' },
};

// ---------------------------------------------------------------- the imported models
// kind / sway / tint: GLBScenery.buildMaterial (stone and tint models share one material per look,
// the stone palette rides in the instance data); solid: rasterised into the structure field;
// castShadow: shadow-pass pipelines only for the things whose shadows read (fewer pipelines);
// lodDist: LOD0 → LOD1, LOD1 → LOD2 (or out), fade out (m, + sizeDist x the instance radius);
// size (m, from manifest.json) is used by the placement before the GLB is loaded.
const GREEN = [ [ 0.14, 0.34, 0.1 ], [ 0.3, 0.5, 0.15 ] ];
export const MODELS = {
	kelp_tall: { kind: 'textured', sway: { height: 9.2, amp: 0.85, speed: 0.55 }, castShadow: false, lodDist: [ 16, 34, 60 ], sizeDist: 2, algae: 0, size: [ 4.5, 9.2, 4.5 ] },
	seaweed_a: { kind: 'tint', tint: GREEN, sway: { height: 2.8, amp: 0.3, speed: 0.8 }, castShadow: false, lodDist: [ 14, 30, 55 ], sizeDist: 3, algae: 0, size: [ 0.08, 1.89, 3.28 ] },
	seaweed_b: { kind: 'tint', tint: GREEN, sway: { height: 2.8, amp: 0.3, speed: 0.8 }, castShadow: false, lodDist: [ 14, 30, 55 ], sizeDist: 3, algae: 0, size: [ 0.69, 2.29, 1.69 ] },
	seaweed_c: { kind: 'tint', tint: GREEN, sway: { height: 2.8, amp: 0.3, speed: 0.8 }, castShadow: false, lodDist: [ 14, 30, 55 ], sizeDist: 3, algae: 0, size: [ 3.1, 2.81, 2.77 ] },
	kelp_bush: { kind: 'tint', tint: [ [ 0.07, 0.2, 0.05 ], [ 0.13, 0.3, 0.09 ] ], sway: { height: 4.9, amp: 0.45, speed: 0.6 }, castShadow: false, lodDist: [ 18, 40, 65 ], sizeDist: 2, algae: 0, size: [ 3.98, 4.91, 5.02 ] },
	wreck_boat: { kind: 'textured', solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.75, size: [ 4.36, 5.43, 7.88 ] },
	skiff: { kind: 'textured', solid: true, castShadow: false, lodDist: [ 25, 70, 300 ], algae: 0.75, size: [ 3.44, 1.0, 4.82 ] },
	temple: { kind: 'textured', solid: true, castShadow: true, lodDist: [ 40, 110, 500 ], algae: 0.6, size: [ 10.79, 7.89, 10.79 ] },
	column: { kind: 'textured', solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.6, size: [ 1.19, 5.97, 1.19 ] },
	slab: { kind: 'textured', solid: true, castShadow: false, lodDist: [ 20, 60, 200 ], algae: 0.6, size: [ 0.9, 2.14, 2.35 ] },
	statue_head: { kind: 'stone', stonePal: 0.62, stoneTile: 0.65, solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.6, size: [ 3.1, 3.69, 2.62 ] },
	ruin_wall: { kind: 'textured', solid: true, castShadow: true, lodDist: [ 40, 110, 500 ], algae: 0.6, size: [ 11.51, 7.79, 17.68 ] },
	rock_tall: { kind: 'stone', stonePal: 0.34, stoneTile: 0.65, solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.55, size: [ 4.73, 5.4, 5.84 ] },
	rock_slab: { kind: 'stone', stonePal: 0.42, stoneTile: 0.65, solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.55, size: [ 6.45, 2.87, 5.43 ] },
	rock_cluster: { kind: 'stone', stonePal: 0.3, stoneTile: 0.65, solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.55, size: [ 7.27, 8.2, 7.94 ] },
	rock_lump: { kind: 'stone', stonePal: 0.5, stoneTile: 0.65, solid: true, castShadow: false, lodDist: [ 24, 70, 300 ], algae: 0.55, size: [ 2.17, 1.86, 2.28 ] },
	rock_mossy: { kind: 'textured', solid: true, castShadow: false, lodDist: [ 20, 60, 200 ], algae: 0.3, size: [ 2.2, 1.1, 1.98 ] },
	boulder_layered: { kind: 'textured', solid: true, castShadow: true, lodDist: [ 30, 90, 400 ], algae: 0.55, size: [ 4.62, 6.17, 4.65 ] },
	manatee: { kind: 'textured', swim: true, bodyLength: 3.5, swimAxis: [ 0, 1, 0 ], swimAmp: 0.13, swimK: 3.2, halfHeight: 0.58, algae: 0, size: [ 1.68, 1.15, 3.49 ] },
	hammerhead: { kind: 'shark', swim: true, bodyLength: 3.6, swimAxis: [ 1, 0, 0 ], swimAmp: 0.2, swimK: 4.6, halfHeight: 0.7, algae: 0, size: [ 1.73, 1.4, 3.6 ] },
	lighthouse: { kind: 'textured', solid: false, castShadow: true, lodDist: [ 60, 200, 1400 ], sizeDist: 8, algae: 0, size: [ 14.65, 19.55, 7.02 ] },
	shrub_rooibos: { kind: 'textured', armIsAO: true, castShadow: true, lodDist: [ 20, 50, 160 ], sizeDist: 4, algae: 0, size: [ 0.72, 0.92, 0.84 ] },
	shrub_03: { kind: 'textured', armIsAO: true, castShadow: true, lodDist: [ 20, 50, 160 ], sizeDist: 4, algae: 0, size: [ 0.5, 1.01, 0.38 ] },
	dry_branches: { kind: 'textured', armIsAO: true, castShadow: false, lodDist: [ 18, 45, 140 ], sizeDist: 4, algae: 0, size: [ 0.45, 0.48, 1.82 ] },
	bark_debris: { kind: 'textured', armIsAO: true, castShadow: false, lodDist: [ 14, 35, 90 ], sizeDist: 4, algae: 0, size: [ 0.28, 0.1, 0.6 ] },
};

export const ADDITION_CATEGORIES = [
	{
		id: 'sunkenWood', label: 'Sunken driftwood', seed: 0x5EA11,
		tooltip: 'Waterlogged trunks and branches resting on the bay floor (Poly Haven CC0 scans already in Tidewater, its own material and LODs).',
		rationale: 'Landmarks and fish shelter on otherwise open sand along the dolphin\'s cruising depth; waterlogged driftwood sinks, so it belongs in a bay fed by a wrack line.',
	},
	{
		id: 'seabedShells', label: 'Seabed shells', seed: 0x5E115,
		tooltip: 'Lambis shells in loose drifts on the shallow sand between the beach and the reef (Poly Haven CC0 scan already in Tidewater).',
		rationale: 'Small-scale detail at the dolphin\'s eye level in the shallows; the beach wrack line already carries the same shell, so the species is in the world.',
	},
	{
		id: 'seagrassMeadows', label: 'Seagrass meadows', seed: 0x5EA6A,
		tooltip: 'Tall blade clumps in two beds — the shallow bay floor east of the spawn and the east plateau — with a sunken skiff and algae-covered rocks (imported: Sea Weed by rkuhlf CC-BY, Medieval Boat and Mossy Rock / Rock CC0).',
		rationale: 'Tidewater\'s own meadow tufts are ankle-high; taller clumps give the shallows a visible meadow the dolphin swims through and the manatees graze.',
	},
	{
		id: 'kelpWall', label: 'Kelp wall', seed: 0x4E1F0,
		tooltip: 'A kelp forest on the east wall of the deep channel (7–13 m): tall stalks swaying with the swell, thickets and blade understory, boulders (imported: Animated Kelp by JosephWPugsley and Kelp by Mazelya CC-BY, photogrammetric rocks CC0).',
		rationale: 'The one missing underwater biome: vertical structure with light coming through it, placed where the slope and the depth suit it, kept clear of the swimming corridor up the channel.',
	},
	{
		id: 'wreck', label: 'The wreck', seed: 0x3EC40,
		tooltip: 'A fishing boat listing at the foot of the kelp wall in 12.5 m, sail and oars gone, weed on the deck, boulders around it (imported: Fantasy Fishing Boat by eb78 CC-BY).',
		rationale: 'A destination at the bottom of the wall; its hull is in the contact surface, so the dolphin and the camera glide over it and the fish shelter in it.',
	},
	{
		id: 'drownedTemple', label: 'Drowned temple', seed: 0x7E31E,
		tooltip: 'A colonnade leads from the channel floor down into the deep basin (11 → 18 m) to an octagonal temple, ruined walls, a carved head, fallen columns and slabs, boulders and kelp on the rim (imported: Medieval Stone Temple, Figure Head, Broken Stone Slab, cathedral ruins, rocks CC0; Ancient Column by OdinTdh CC-BY).',
		rationale: 'The exploration landmark the bay lacked, in the empty basin where nothing of Tidewater\'s own scatter lives, approached along the dolphin\'s natural line south from the spawn.',
	},
	{
		id: 'wildlife', label: 'Added wildlife', seed: 0x1F15,
		tooltip: 'A manatee pair grazing the spawn meadow, a hammerhead patrolling the wall and the wreck, and reef-fish communities (Tidewater\'s own procedural fish) around the wreck and the temple (imported: Low Poly Manatee and Shark (low poly) CC0).',
		rationale: 'Animals the pristine bay does not have, in the places that explain them; the fish are Tidewater\'s so the new sites are populated by the same species as its reef.',
	},
	{
		id: 'headland', label: 'Lighthouse & shore scrub', seed: 0xC0A57,
		tooltip: 'A stone lighthouse with its keeper\'s house on the eastern headland, scrub, dry branches and bark debris on the back-beach (imported: 3TD Harbour Pack CC0, Poly Haven CC0 plants).',
		rationale: 'A coastal landmark for the Surface camera and the boat, and ground-level clutter where Tidewater\'s own planting is only grass.',
	},
];

// mulberry32 (the same generator Tidewater's BenchSeed uses)
function rng( seed ) {

	let s = seed >>> 0;
	return () => {

		s = ( s + 0x6d2b79f5 ) | 0;
		let t = Math.imul( s ^ ( s >>> 15 ), 1 | s );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// Instances of the photoscanned debris assets drawn with Tidewater's loaded ScannedDebris
// (same material, same textures, same LOD geometry; own InstancedMeshes so a category can be
// hidden on its own). Record format as ScannedDebris: { asset, x, y, z, yaw, pitch, roll, sx, sy, sz, rnd }.
class ScanInstances {

	constructor( { source, instances, parent } ) {

		this.source = source;
		this.instances = instances;
		this.parent = parent;
		this.meshes = [];
		this.levels = [];
		this.ready = false;
		this._lastCam = new Vector3( 1e9, 0, 0 );
		this._lastQuat = new Quaternion();
		this._frustum = new Frustum();
		this._m4 = new Matrix4();
		this._sphere = new Sphere();
		this._v = new Vector3();
		for ( const r of instances ) {

			const q = new Quaternion().setFromEuler( new Euler( r.roll || 0, r.yaw, r.pitch || 0, 'YXZ' ) );
			r.matrix = new Matrix4().compose( new Vector3( r.x, r.y, r.z ), q, new Vector3( r.sx, r.sy, r.sz ) );
			const s = SCAN_SIZE[ r.asset ];
			r.radius = Math.hypot( s[ 0 ] * r.sx, s[ 1 ] * r.sy, s[ 2 ] * r.sz ) / 2;

		}

	}

	async load() {

		await this.source.promise;
		if ( ! this.source.ready ) return;
		const n = Math.max( 1, this.instances.length );
		this.levels = this.source.levels.map( ( L, l ) => {

			const src = L.mesh.geometry;
			const geo = new BufferGeometry();
			for ( const name of [ 'position', 'normal', 'uv', 'aAsset' ] ) geo.setAttribute( name, src.getAttribute( name ) );
			geo.setIndex( src.index );
			const iData = new InstancedBufferAttribute( new Float32Array( n * 4 ), 4 );
			iData.setUsage( DynamicDrawUsage );
			geo.setAttribute( 'iData', iData );
			const mesh = new InstancedMesh( geo, this.source.material, n );
			mesh.name = 'additions-scan-lod' + l;
			mesh.count = 0;
			mesh.castShadow = l === 0;
			mesh.receiveShadow = true;
			mesh.frustumCulled = false;
			mesh.instanceMatrix.setUsage( DynamicDrawUsage );
			mesh.staticVelocity = true;
			this.parent.add( mesh );
			this.meshes.push( mesh );
			return { mesh, iData, tris: L.tris };

		} );
		this.ready = true;
		this._lastCam.set( 1e9, 0, 0 );

	}

	update( camera ) {

		if ( ! this.ready ) return;
		const cam = camera.getWorldPosition( this._v );
		if ( cam.distanceToSquared( this._lastCam ) < 0.25 && camera.quaternion.equals( this._lastQuat ) ) return;
		this._lastCam.copy( cam );
		this._lastQuat.copy( camera.quaternion );
		camera.updateMatrixWorld();
		this._m4.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
		this._frustum.setFromProjectionMatrix( this._m4, camera.coordinateSystem, camera.reversedDepth );
		const counts = [ 0, 0, 0 ];
		for ( const r of this.instances ) {

			this._sphere.center.set( r.x, r.y, r.z );
			this._sphere.radius = r.radius + 6;
			if ( ! this._frustum.intersectsSphere( this._sphere ) ) continue;
			const d = Math.hypot( r.x - cam.x, r.y - cam.y, r.z - cam.z ) - r.radius * 6;
			const [ a, b, c ] = LOD_DIST;
			const t01 = bandFade( d, a * ( 1 - BAND / 2 ), a * ( 1 + BAND / 2 ) );
			const t12 = bandFade( d, b * ( 1 - BAND / 2 ), b * ( 1 + BAND / 2 ) );
			const out = bandFade( d, c * ( 1 - BAND ), c );
			if ( out >= 1 ) continue;
			if ( t01 < 1 ) this._put( 0, counts, r, t01, 1 );
			if ( t01 > 0 && t12 < 1 ) this._put( 1, counts, r, t12 > 0 ? t12 : t01, t12 > 0 ? 1 : 0 );
			if ( t12 > 0 ) this._put( 2, counts, r, t12 * ( 1 - out ), 0 );

		}

		this.levels.forEach( ( L, l ) => {

			L.mesh.count = counts[ l ];
			L.mesh.instanceMatrix.clearUpdateRanges();
			L.mesh.instanceMatrix.addUpdateRange( 0, Math.max( 1, counts[ l ] ) * 16 );
			L.mesh.instanceMatrix.needsUpdate = true;
			L.iData.clearUpdateRanges();
			L.iData.addUpdateRange( 0, Math.max( 1, counts[ l ] ) * 4 );
			L.iData.needsUpdate = true;

		} );

	}

	_put( l, counts, r, fade, outgoing ) {

		const L = this.levels[ l ];
		const i = counts[ l ] ++;
		L.mesh.setMatrixAt( i, r.matrix );
		L.iData.array.set( [ r.asset, r.rnd, fade, outgoing ], i * 4 );

	}

	get triangles() {

		return this.ready ? this.levels.reduce( ( a, L ) => a + L.mesh.count * L.tris, 0 ) : 0;

	}

	// a camera moved far enough: re-bucket on the next update
	invalidate() {

		this._lastCam.set( 1e9, 0, 0 );

	}

	dispose() {

		for ( const m of this.meshes ) {

			m.geometry.dispose(); // own iData only: the shared attributes belong to the source
			this.parent.remove( m );

		}

	}

}

export class SceneryAdditions {

	constructor( app ) {

		this.app = app;
		this.group = new Group();
		this.group.name = 'SceneryAdditions';
		this.group.matrixAutoUpdate = false;
		app.scene.add( this.group );
		this.categories = new Map();
		this.enabled = {};
		const qs = app.qs;
		const dflt = qs.has( 'original' ) ? false : true;
		for ( const c of ADDITION_CATEGORIES ) this.enabled[ c.id ] = qs.has( 'enhanced' ) ? true : dflt;
		this.ready = false;
		// Loading switches (verification / low-end machines): ?noAdditions loads nothing (the layer
		// is placed but never drawn — the pristine scene with the pristine pipeline set);
		// ?additions=id,id loads only those categories' models (the others stay empty);
		// ?lazyAdditions keeps the meshes out of the scene until attach() — after Tidewater's
		// precompile — so their pipelines compile on first sight instead of all at start-up.
		this.loadNone = qs.has( 'noAdditions' );
		this.loadOnly = qs.has( 'additions' ) ? new Set( ( qs.get( 'additions' ) || '' ).split( ',' ).filter( Boolean ) ) : null;
		this.lazy = qs.has( 'lazyAdditions' );
		this.attached = false;
		this._pending = []; // meshes waiting for attach() (lazy)
		this.models = new Map();
		this.provenance = null; // public/models/additions/manifest.json (loaded in load())
		// ---- placement (CPU, deterministic, before anything loads: the fields and the records exist
		// from here on so the dolphin's world sampler can be built on them)
		this.placed = {};
		this.placed.sunkenWood = { scan: this._placeSunkenWood() };
		this.placed.seabedShells = { scan: this._placeSeabedShells() };
		this.placed.seagrassMeadows = this._placeSeagrassMeadows();
		this.placed.kelpWall = this._placeKelpWall();
		this.placed.wreck = this._placeWreck();
		this.placed.drownedTemple = this._placeDrownedTemple();
		this.placed.wildlife = this._placeWildlife();
		this.placed.headland = this._placeHeadland();
		// the composite contact surfaces (reef ∪ enabled solid additions) for the dolphin (ReefLike:
		// structureAt), Tidewater's walker (reef.floorHeightAt) and Tidewater's own fish
		const reef = app.reef;
		this.ground = { structureAt: ( x, z ) => Math.max( reef ? reef.structureAt( x, z ) : - Infinity, this.structureAt( x, z ) ) };
		this.floor = { floorHeightAt: ( x, z ) => Math.max( reef ? reef.floorHeightAt( x, z ) : app.terrainData.heightAt( x, z ), this.structureAt( x, z ) ), structureAt: this.ground.structureAt };
		if ( reef && reef.fish ) {

			const orig = reef.fish.floorAt;
			reef.fish.floorAt = ( x, z ) => Math.max( orig( x, z ), this.structureAt( x, z ) );

		}

	}

	// ---- placement helpers (bare sand only, clear of the reef's structures, the pier, the dock, the spawn)
	_sandAt( x, z ) {

		const app = this.app;
		const g = app.terrainData.heightAt( x, z );
		if ( app.reef && app.reef.structureAt && app.reef.structureAt( x, z ) > g + 0.02 ) return null; // a coral head / rock here
		return g;

	}

	_clear( x, z, r ) {

		const P = WORLD.pier;
		if ( Math.abs( x - P.x ) < P.width / 2 + 3 + r && z > P.zStart - 3 && z < P.zEnd + 3 ) return false;
		if ( Math.abs( x - P.x ) < P.headWidth / 2 + 3 + r && z > P.zEnd - P.headDepth - 3 && z < P.zEnd + 3 ) return false;
		const dock = WORLD.boatDock.position;
		if ( Math.hypot( x - dock.x, z - dock.z ) < 12 + r ) return false;
		if ( Math.hypot( x - 0, z - 66 ) < 6 + r ) return false; // the dolphin spawn
		const reef = WORLD.reef;
		if ( Math.hypot( x - reef.center.x, z - reef.center.z ) < reef.radius + 12 ) return false; // the reef proper and its apron
		return true;

	}

	// the highest point of Tidewater's own structures (reef heads, bay rocks) within r of x, z
	_reefTopAround( x, z, r ) {

		const app = this.app;
		if ( ! app.reef || ! app.reef.structureAt ) return - Infinity;
		let m = - Infinity;
		for ( let a = 0; a < 8; a ++ ) for ( const d of [ r * 0.5, r ] ) {

			const px = x + Math.cos( a / 8 * TAU ) * d, pz = z + Math.sin( a / 8 * TAU ) * d;
			const s = app.reef.structureAt( px, pz ) - app.terrainData.heightAt( px, pz );
			if ( s > m ) m = s;

		}

		return Math.max( m, app.reef.structureAt( x, z ) - app.terrainData.heightAt( x, z ) );

	}

	// a log / branch lying along yaw, resting on the sand under both halves, sunk a little
	_log( out, rand, asset, x, z, yaw, sx, sg, sink ) {

		const S = SCAN_SIZE[ asset ];
		const len = S[ 0 ] * sx, h = S[ 1 ] * sg;
		const dx = Math.cos( yaw ), dz = - Math.sin( yaw );
		const gA = this._sandAt( x - dx * len * 0.3, z - dz * len * 0.3 ), gB = this._sandAt( x + dx * len * 0.3, z + dz * len * 0.3 ), g0 = this._sandAt( x, z );
		if ( gA === null || gB === null || g0 === null ) return false;
		const pitch = Math.atan2( gB - gA, len * 0.6 );
		const y = Math.min( ( gA + gB ) / 2, g0 + 0.05 ) + h * ( 0.5 - sink );
		out.push( { asset, x, y, z, yaw, pitch, roll: ( rand() - 0.5 ) * 0.6 + ( rand() < 0.3 ? Math.PI : 0 ), sx, sy: sg, sz: sg * ( 0.9 + rand() * 0.2 ), rnd: rand() } );
		return true;

	}

	_placeSunkenWood() {

		const rand = rng( ADDITION_CATEGORIES[ 0 ].seed );
		const out = [];
		// two groups on the bay floor: east of the pier head on the sandy slope (4–5.5 m), and a
		// smaller one west of the spawn lane (3.5–4.5 m)
		const groups = [ { x: 80, z: 64, r: 9, trunks: 3, branches: 4 }, { x: - 8, z: 32, r: 6, trunks: 1, branches: 3 } ];
		for ( const gdef of groups ) {

			let placed = 0, tries = 0;
			const want = gdef.trunks + gdef.branches;
			while ( placed < want && tries ++ < 60 ) {

				const a = rand() * TAU, d = Math.sqrt( rand() ) * gdef.r;
				const x = gdef.x + Math.cos( a ) * d, z = gdef.z + Math.sin( a ) * d;
				const g = this._sandAt( x, z );
				if ( g === null || g > - 3.3 || g < - 6.0 || ! this._clear( x, z, 2.5 ) ) continue;
				if ( out.some( ( o ) => Math.hypot( o.x - x, o.z - z ) < 1.6 ) ) continue;
				const isTrunk = placed < gdef.trunks;
				const asset = isTrunk ? SCAN.TRUNK : rand() < 0.5 ? SCAN.BRANCH_A : SCAN.BRANCH_B;
				const sx = isTrunk ? 1.6 + rand() * 1.1 : 1.6 + rand() * 1.4;
				const sg = isTrunk ? 1.0 + rand() * 0.5 : sx * ( 0.8 + rand() * 0.3 );
				if ( this._log( out, rand, asset, x, z, rand() * TAU, sx, sg, 0.22 + rand() * 0.15 ) ) placed ++;

			}

		}

		return out;

	}

	_placeSeabedShells() {

		const rand = rng( ADDITION_CATEGORIES[ 1 ].seed );
		const out = [];
		// three loose drifts on the shallow sand off the beach, 2.5–4 m of water
		const drifts = [ { x: 14, z: 24, r: 7, n: 12 }, { x: 36, z: 42, r: 6, n: 9 }, { x: - 6, z: 20, r: 5, n: 9 } ];
		for ( const dr of drifts ) {

			let placed = 0, tries = 0;
			while ( placed < dr.n && tries ++ < 80 ) {

				const a = rand() * TAU, d = Math.sqrt( rand() ) * dr.r;
				const x = dr.x + Math.cos( a ) * d, z = dr.z + Math.sin( a ) * d;
				const g = this._sandAt( x, z );
				if ( g === null || g > - 2.3 || g < - 4.5 || ! this._clear( x, z, 0.5 ) ) continue;
				if ( out.some( ( o ) => Math.hypot( o.x - x, o.z - z ) < 0.6 ) ) continue;
				const s = 1.3 + rand() * 0.8; // 18–29 cm: a grown spider conch (Lambis truncata reaches 35 cm)
				const sz = SCAN_SIZE[ SCAN.SHELL ];
				out.push( { asset: SCAN.SHELL, x, y: g + sz[ 1 ] * s * 0.3, z, yaw: rand() * TAU, pitch: ( rand() - 0.5 ) * 0.4, roll: rand() < 0.3 ? Math.PI : ( rand() - 0.5 ) * 0.4, sx: s, sy: s, sz: s, rnd: rand() } );
				placed ++;

			}

		}

		return out;

	}

	// ---------------------------------------------------------------- imported-model placement
	// A site's record set: { models: { id: [ { x, y, z, yaw, pitch, roll, s, rnd, sway } ] }, swimmers, fish }

	_rec( models, id, r ) {

		( models[ id ] || ( models[ id ] = [] ) ).push( r );
		return r;

	}

	// a clump / stalk standing on the sand at x, z (scale s), its tip kept below `top`
	_stand( models, rand, id, x, z, s, top = KELP_TOP, extra = {} ) {

		const g = this._sandAt( x, z );
		if ( g === null ) return null;
		const h = MODELS[ id ].size[ 1 ];
		const sMax = ( top - g ) / h;
		if ( sMax < 0.25 ) return null;
		const sc = Math.min( s, sMax );
		return this._rec( models, id, { x, y: g - 0.04, z, yaw: rand() * TAU, pitch: ( rand() - 0.5 ) * 0.08, roll: ( rand() - 0.5 ) * 0.08, s: sc, rnd: rand(), sway: 0.7 + rand() * 0.6, ...extra } );

	}

	// a solid thing on the sand: footprint clear of Tidewater's structures, its top below TOP_LIMIT;
	// sunk a little into the sand; returns null when the spot does not work
	_settle( models, rand, id, x, z, { s = 1, yaw = rand() * TAU, pitch = 0, roll = 0, sink = 0.15, clearance = 1.5, top = TOP_LIMIT } = {} ) {

		const size = MODELS[ id ].size;
		const sx = Array.isArray( s ) ? Math.max( s[ 0 ], s[ 2 ] ) : s, sy = Array.isArray( s ) ? s[ 1 ] : s;
		const foot = Math.max( size[ 0 ], size[ 2 ] ) * sx * 0.5;
		const g = this._sandAt( x, z );
		if ( g === null || ! this._clear( x, z, foot ) ) return null;
		if ( this._reefTopAround( x, z, foot + clearance ) > 0.3 ) return null;
		// a thing lying on its side (pitch ~90°) is as tall as it is long
		const height = Math.abs( pitch ) > 1 ? Math.max( size[ 0 ] * sx, size[ 2 ] * sx ) * 0.5 : size[ 1 ] * sy;
		if ( g + height - sink > top ) return null;
		// rest on the lowest point of the footprint so nothing floats on a slope
		let gMin = g;
		for ( let a = 0; a < 8; a ++ ) { const gg = this.app.terrainData.heightAt( x + Math.cos( a / 8 * TAU ) * foot * 0.7, z + Math.sin( a / 8 * TAU ) * foot * 0.7 ); if ( gg < gMin ) gMin = gg; }
		return this._rec( models, id, { x, y: gMin - sink, z, yaw, pitch, roll, s, rnd: rand() } );

	}

	// a bed of blade clumps around (cx, cz): `n` clumps in `patches` gaussian patches
	_meadow( models, rand, cx, cz, r, n, patches, depth, scale ) {

		const centres = [];
		for ( let i = 0; i < patches; i ++ ) { const a = rand() * TAU, d = Math.sqrt( rand() ) * r * 0.75; centres.push( [ cx + Math.cos( a ) * d, cz + Math.sin( a ) * d, r * ( 0.25 + rand() * 0.3 ) ] ); }
		let placed = 0, tries = 0;
		const placedXZ = [];
		while ( placed < n && tries ++ < n * 12 ) {

			const c = centres[ Math.floor( rand() * centres.length ) ];
			const a = rand() * TAU, d = Math.abs( ( rand() + rand() - 1 ) ) * c[ 2 ];
			const x = c[ 0 ] + Math.cos( a ) * d, z = c[ 1 ] + Math.sin( a ) * d;
			const g = this._sandAt( x, z );
			if ( g === null || - g < depth[ 0 ] || - g > depth[ 1 ] || ! this._clear( x, z, 0.6 ) ) continue;
			if ( placedXZ.some( ( o ) => Math.hypot( o[ 0 ] - x, o[ 1 ] - z ) < 0.9 ) ) continue;
			const id = [ 'seaweed_a', 'seaweed_b', 'seaweed_c' ][ Math.floor( rand() * 3 ) ];
			if ( this._stand( models, rand, id, x, z, scale[ 0 ] + rand() * ( scale[ 1 ] - scale[ 0 ] ) ) ) { placed ++; placedXZ.push( [ x, z ] ); }

		}

		return placed;

	}

	_placeSeagrassMeadows() {

		const rand = rng( ADDITION_CATEGORIES[ 2 ].seed );
		const models = {};
		// bed A: the shallow bay floor east of the spawn (5–8 m), where Tidewater's own tufts grow,
		// the manatees' pasture; bed B: the east plateau (6–9 m)
		this._meadow( models, rand, 50, 74, 17, 150, 7, [ 4.5, 8.5 ], [ 0.3, 0.52 ] );
		this._meadow( models, rand, 100, 121, 14, 110, 6, [ 5.5, 9.5 ], [ 0.32, 0.55 ] );
		// the sunken skiff on the plateau, upright, half silted; a few algae rocks in both beds
		for ( const [ x, z ] of [ [ 104, 126 ], [ 101, 130 ], [ 108, 118 ] ] ) if ( this._settle( models, rand, 'skiff', x, z, { s: 1, yaw: 0.8 + rand() * 0.6, roll: 0.12, sink: 0.3 } ) ) break;
		for ( const [ cx, cz, r, n ] of [ [ 50, 74, 16, 5 ], [ 100, 121, 13, 4 ] ] ) {

			let placed = 0, tries = 0;
			while ( placed < n && tries ++ < 60 ) {

				const a = rand() * TAU, d = Math.sqrt( rand() ) * r;
				const id = rand() < 0.6 ? 'rock_mossy' : 'rock_lump';
				if ( this._settle( models, rand, id, cx + Math.cos( a ) * d, cz + Math.sin( a ) * d, { s: 0.8 + rand() * 0.6, sink: 0.25 } ) ) placed ++;

			}

		}

		return { models };

	}

	_placeKelpWall() {

		const rand = rng( ADDITION_CATEGORIES[ 3 ].seed );
		const models = {};
		// the east wall of the deep channel: x 54–76, z 94–134, 7–13 m. Tall stalks in the deeper
		// half (10–13 m), shorter ones on the shelf; the swimming corridor up the channel (x < 52)
		// stays open
		let stalks = 0, tries = 0;
		const placedXZ = [];
		while ( stalks < 64 && tries ++ < 900 ) {

			const x = 54 + rand() * 22, z = 94 + rand() * 40;
			const g = this._sandAt( x, z );
			if ( g === null || - g < 6.5 || - g > 13.5 || ! this._clear( x, z, 1 ) ) continue;
			// clumps: prefer the neighbourhood of an existing stalk (a forest, not a lattice)
			if ( placedXZ.length > 6 && rand() < 0.55 && ! placedXZ.some( ( o ) => Math.hypot( o[ 0 ] - x, o[ 1 ] - z ) < 6 ) ) continue;
			if ( placedXZ.some( ( o ) => Math.hypot( o[ 0 ] - x, o[ 1 ] - z ) < 1.8 ) ) continue;
			const deep = - g > 10;
			const s = deep ? 0.8 + rand() * 0.4 : 0.5 + rand() * 0.25;
			if ( this._stand( models, rand, 'kelp_tall', x, z, s ) ) { stalks ++; placedXZ.push( [ x, z ] ); }

		}

		// thickets and blade understory at the stalks' feet
		let bushes = 0; tries = 0;
		while ( bushes < 14 && tries ++ < 300 ) {

			const o = placedXZ[ Math.floor( rand() * placedXZ.length ) ];
			if ( ! o ) break;
			const x = o[ 0 ] + ( rand() - 0.5 ) * 6, z = o[ 1 ] + ( rand() - 0.5 ) * 6;
			const g = this._sandAt( x, z );
			if ( g === null || - g < 6.5 || ! this._clear( x, z, 1 ) ) continue;
			if ( this._stand( models, rand, 'kelp_bush', x, z, 0.55 + rand() * 0.4 ) ) bushes ++;

		}

		this._meadow( models, rand, 65, 114, 20, 70, 8, [ 6.5, 13.5 ], [ 0.5, 1.0 ] );
		// boulders on the slope (tops kept below −2.5 m), one tall outcrop
		for ( const [ id, x, z, s ] of [ [ 'rock_slab', 60, 98, 0.9 ], [ 'rock_slab', 66, 126, 1.0 ], [ 'boulder_layered', 58, 118, 0.7 ], [ 'rock_tall', 55, 128, 0.85 ], [ 'rock_lump', 70, 104, 1.2 ], [ 'rock_lump', 63, 108, 1.0 ] ] ) {

			for ( let k = 0; k < 6; k ++ ) if ( this._settle( models, rand, id, x + ( rand() - 0.5 ) * 4 * k, z + ( rand() - 0.5 ) * 4 * k, { s, sink: 0.35 } ) ) break;

		}

		return { models };

	}

	_placeWreck() {

		const rand = rng( ADDITION_CATEGORIES[ 4 ].seed );
		const models = {};
		// the boat lies at the foot of the wall in ~12.5 m, bow up the slope (north-east), heeled
		// to port, keel sunk into the sand; tried at a few spots so Tidewater's own bay rocks are
		// clear of the hull
		let hull = null;
		for ( const [ x, z ] of [ [ 56, 114 ], [ 54, 110 ], [ 58, 120 ], [ 52, 116 ], [ 57, 124 ] ] ) {

			hull = this._settle( models, rand, 'wreck_boat', x, z, { s: 1, yaw: 0.55, roll: 0.5, pitch: 0.08, sink: 0.55, clearance: 2.5 } );
			if ( hull ) break;

		}

		if ( ! hull ) return { models };
		// weed on and around the hull, a few boulders alongside
		for ( let i = 0, tries = 0; i < 22 && tries < 200; tries ++ ) {

			const a = rand() * TAU, d = 2.5 + Math.sqrt( rand() ) * 9;
			const x = hull.x + Math.cos( a ) * d, z = hull.z + Math.sin( a ) * d;
			if ( this._stand( models, rand, [ 'seaweed_a', 'seaweed_b', 'seaweed_c' ][ Math.floor( rand() * 3 ) ], x, z, 0.55 + rand() * 0.6 ) ) i ++;

		}

		for ( const [ id, dx, dz, s ] of [ [ 'rock_lump', 7, 4, 1.1 ], [ 'rock_lump', - 6, 6, 0.9 ], [ 'rock_slab', 9, - 7, 0.8 ] ] ) {

			for ( let k = 0; k < 5; k ++ ) if ( this._settle( models, rand, id, hull.x + dx + ( rand() - 0.5 ) * 3 * k, hull.z + dz + ( rand() - 0.5 ) * 3 * k, { s, sink: 0.3 } ) ) break;

		}

		return { models, hull: { x: hull.x, y: hull.y, z: hull.z } };

	}

	_placeDrownedTemple() {

		const rand = rng( ADDITION_CATEGORIES[ 5 ].seed );
		const models = {};
		// the colonnade: two rows 10 m apart, from the channel floor (z 124, ~11 m) south into the
		// basin (z 144, ~17 m); the dolphin coming down from the spawn passes between them
		const axis = { x: 4.5, z0: 124, z1: 144, half: 5 };
		const columns = [];
		for ( let i = 0; i < 5; i ++ ) for ( const side of [ - 1, 1 ] ) {

			const z = axis.z0 + ( axis.z1 - axis.z0 ) * i / 4, x = axis.x + side * axis.half;
			const r = rand();
			if ( r < 0.3 ) {

				// fallen: lying across the sand, pointing away from the axis, a little buried
				this._settle( models, rand, 'column', x + side * 2.5, z + ( rand() - 0.5 ) * 2, { s: 1, yaw: side > 0 ? 0.2 + rand() * 0.5 : Math.PI - 0.2 - rand() * 0.5, pitch: Math.PI / 2 - 0.04, sink: 0.35, clearance: 0.6 } );

			} else {

				const broken = r < 0.5;
				const c = this._settle( models, rand, 'column', x, z, { s: broken ? [ 1, 0.35 + rand() * 0.3, 1 ] : 1, yaw: rand() * TAU, roll: ( rand() - 0.5 ) * 0.06, pitch: ( rand() - 0.5 ) * 0.06, sink: 0.25, clearance: 0.6 } );
				if ( c ) columns.push( [ c.x, c.z ] );

			}

		}

		// the temple at the end of the colonnade on the basin floor (~18 m), the ruined walls to
		// its east, the carved head to its west, slabs about the colonnade
		const temple = this._settle( models, rand, 'temple', axis.x, 156, { s: 1, yaw: 0.3, sink: 0.4, clearance: 2 } ) || this._settle( models, rand, 'temple', axis.x, 160, { s: 1, yaw: 0.3, sink: 0.4, clearance: 2 } );
		const ruin = this._settle( models, rand, 'ruin_wall', 19, 150, { s: 1, yaw: - 0.5, sink: 0.5, clearance: 1.5 } ) || this._settle( models, rand, 'ruin_wall', 16, 154, { s: 1, yaw: - 0.7, sink: 0.5, clearance: 1.5 } );
		this._settle( models, rand, 'statue_head', - 9, 147, { s: 1, yaw: 0.9, pitch: 0.28, roll: - 0.12, sink: 1.1, clearance: 1 } );
		for ( const [ x, z ] of [ [ - 4, 130 ], [ 13, 136 ], [ - 2, 150 ], [ 10, 160 ], [ 0, 141 ] ] ) {

			const flat = rand() < 0.5;
			this._settle( models, rand, 'slab', x + ( rand() - 0.5 ) * 2, z + ( rand() - 0.5 ) * 2, { s: 0.9 + rand() * 0.3, yaw: rand() * TAU, pitch: flat ? Math.PI / 2 - 0.1 : ( rand() - 0.5 ) * 0.2, sink: flat ? 0.1 : 0.25, clearance: 0.5 } );

		}

		// boulders on the basin rim and floor
		for ( const [ id, x, z, s ] of [ [ 'rock_cluster', - 14, 136, 0.95 ], [ 'rock_cluster', 24, 162, 0.85 ], [ 'rock_tall', - 6, 164, 1 ], [ 'rock_tall', 15, 132, 0.8 ], [ 'rock_slab', - 3, 138, 1 ], [ 'rock_slab', 12, 160, 0.9 ], [ 'boulder_layered', - 12, 158, 0.8 ], [ 'rock_lump', 8, 150, 1.2 ], [ 'rock_lump', - 5, 156, 1 ] ] ) {

			for ( let k = 0; k < 6; k ++ ) if ( this._settle( models, rand, id, x + ( rand() - 0.5 ) * 4 * k, z + ( rand() - 0.5 ) * 4 * k, { s, sink: 0.4 } ) ) break;

		}

		// kelp on the basin's southern rim and weed among the ruins
		for ( let i = 0, tries = 0; i < 16 && tries < 200; tries ++ ) {

			const x = - 12 + rand() * 28, z = 160 + rand() * 9;
			const g = this._sandAt( x, z );
			if ( g === null || - g < 12 ) continue;
			if ( this._stand( models, rand, 'kelp_tall', x, z, 0.85 + rand() * 0.35 ) ) i ++;

		}

		this._meadow( models, rand, 4, 146, 22, 60, 7, [ 10, 20.5 ], [ 0.5, 1.0 ] );
		return { models, columns, temple: temple ? { x: temple.x, z: temple.z } : null, ruin: ruin ? { x: ruin.x, z: ruin.z } : null };

	}

	_placeWildlife() {

		const rand = rng( ADDITION_CATEGORIES[ 6 ].seed );
		// the manatee pair: a lazy loop over the spawn meadow at grazing height; the hammerhead:
		// a long patrol along the wall and over the wreck, mid-water. Depths are authored, then held
		// above the composite ground at runtime (Swimmer).
		const manateeLoop = [ [ 40, - 5.0, 66 ], [ 56, - 5.6, 70 ], [ 62, - 5.2, 80 ], [ 52, - 6.0, 86 ], [ 40, - 5.8, 82 ], [ 34, - 5.0, 72 ] ];
		const sharkLoop = [ [ 72, - 5.5, 92 ], [ 60, - 8.0, 104 ], [ 50, - 9.5, 118 ], [ 46, - 10.0, 132 ], [ 58, - 8.5, 136 ], [ 70, - 6.5, 126 ], [ 76, - 5.5, 108 ] ];
		const swimmers = [
			{ id: 'manatee-1', model: 'manatee', path: manateeLoop, speed: 0.55, phase: 0.0, clearance: 1.1, ceiling: - 2.5, bob: { amp: 0.25, freq: 0.05 }, drawDistance: 120 },
			{ id: 'manatee-2', model: 'manatee', path: manateeLoop.map( ( p ) => [ p[ 0 ] + 2.5, p[ 1 ] + 0.4, p[ 2 ] - 1.5 ] ), speed: 0.52, phase: 0.12, clearance: 1.3, ceiling: - 2.5, bob: { amp: 0.3, freq: 0.04 }, drawDistance: 120 },
			{ id: 'hammerhead', model: 'hammerhead', path: sharkLoop, speed: 1.7, phase: 0.4, clearance: 2.0, ceiling: - 3.0, drawDistance: 140 },
		];
		// reef-fish communities (Tidewater's species) at the wreck and the temple: homes picked by
		// the vendor's own spot search inside each zone (depth bands, anchors)
		const w = this.placed.wreck.hull, t = this.placed.drownedTemple;
		const fish = [];
		if ( w ) fish.push( { id: 'wreckFish', seed: 0x5F15, center: [ w.x, w.z ], radius: 22, anchors: [ [ w.x, w.z ], [ w.x + 3, w.z + 2 ], [ w.x - 3, w.z - 2 ] ], groups: [
			[ 'grunt', 24, { x: w.x, z: w.z, r: 10, band: [ 8, 16 ] }, true ],
			[ 'sergeant', 14, { x: w.x, z: w.z, r: 10, band: [ 8, 16 ] }, true ],
			[ 'chromis', 22, { x: w.x, z: w.z, r: 12, band: [ 8, 16 ] }, true ],
			[ 'wrasse', 10, { x: w.x, z: w.z, r: 14, band: [ 6, 16 ] } ],
			[ 'tang', 8, { x: w.x + 6, z: w.z - 4, r: 14, band: [ 6, 14 ] } ],
			[ 'grouper', 1, { x: w.x, z: w.z, r: 6, band: [ 8, 16 ] }, true ],
			[ 'barracuda', 1, { x: w.x, z: w.z, r: 14, band: [ 6, 16 ] } ],
			[ 'silverside', 120, { x: w.x, z: w.z - 6, r: 16, band: [ 6, 16 ] } ],
			[ 'jack', 6, { x: w.x + 8, z: w.z - 10, r: 20, band: [ 6, 16 ], path: sharkLoop.map( ( p ) => [ p[ 0 ], p[ 2 ] ] ) } ],
		] } );
		if ( t.temple ) fish.push( { id: 'templeFish', seed: 0x7F15, center: [ t.temple.x, t.temple.z - 8 ], radius: 28, anchors: t.columns.length ? t.columns : [ [ t.temple.x, t.temple.z ] ], groups: [
			[ 'chromis', 24, { x: t.temple.x, z: t.temple.z - 14, r: 16, band: [ 9, 20 ] }, true ],
			[ 'chromis', 20, { x: t.temple.x, z: t.temple.z - 14, r: 16, band: [ 9, 20 ] }, true ],
			[ 'grunt', 26, { x: t.temple.x, z: t.temple.z, r: 10, band: [ 12, 20 ] } ],
			[ 'sergeant', 12, { x: t.temple.x, z: t.temple.z - 10, r: 14, band: [ 9, 20 ] }, true ],
			[ 'yellowtail', 14, { x: t.temple.x, z: t.temple.z - 6, r: 18, band: [ 9, 20 ] } ],
			[ 'angel', 2, { x: t.temple.x, z: t.temple.z - 12, r: 14, band: [ 9, 20 ] }, true ],
			[ 'angel', 2, { x: t.temple.x + 10, z: t.temple.z, r: 14, band: [ 9, 20 ] } ],
			[ 'grouper', 1, { x: t.temple.x, z: t.temple.z, r: 6, band: [ 12, 20 ] } ],
			[ 'barracuda', 1, { x: t.temple.x, z: t.temple.z - 16, r: 16, band: [ 9, 20 ] } ],
			[ 'silverside', 140, { x: t.temple.x, z: t.temple.z - 16, r: 18, band: [ 9, 20 ] } ],
			[ 'tarpon', 3, { x: t.temple.x - 8, z: t.temple.z + 4, r: 20, band: [ 12, 21 ] } ],
		] } );
		rand();
		return { models: {}, swimmers, fish };

	}

	_placeHeadland() {

		const rand = rng( ADDITION_CATEGORIES[ 7 ].seed );
		const models = {};
		const T = this.app.terrainData;
		// the lighthouse: the first of the candidate headland tops (from the survey) whose 16 m
		// footprint is land, high and not too steep; its long axis along the coast, the base sunk
		// to the lowest corner
		let site = null;
		for ( const [ x, z ] of [ [ 222, 132 ], [ 218, 128 ], [ 236, 144 ], [ 226, 136 ], [ - 208, 44 ], [ - 206, 28 ] ] ) {

			let lo = Infinity, hi = - Infinity;
			for ( let a = 0; a < 8; a ++ ) for ( const d of [ 4, 8 ] ) { const h = T.heightAt( x + Math.cos( a / 8 * TAU ) * d, z + Math.sin( a / 8 * TAU ) * d ); lo = Math.min( lo, h ); hi = Math.max( hi, h ); }
			const h0 = T.heightAt( x, z );
			if ( h0 > 8 && lo > 5 && hi - lo < 7 ) { site = { x, z, y: lo - 0.4 }; break; }

		}

		if ( site ) {

			// long axis (x) along the local coast: face the lower side (toward the water)
			const e = 12;
			const gx = T.heightAt( site.x + e, site.z ) - T.heightAt( site.x - e, site.z ), gz = T.heightAt( site.x, site.z + e ) - T.heightAt( site.x, site.z - e );
			const downhill = Math.atan2( - gx, - gz ); // yaw (about y, +z forward) of the downhill direction
			this._rec( models, 'lighthouse', { x: site.x, y: site.y, z: site.z, yaw: downhill + Math.PI / 2, pitch: 0, roll: 0, s: 1, rnd: rand() } );

		}

		// back-beach scrub and debris at the ends of the beach, between the dune grass and the
		// forest edge (0.7–2.4 m above the sea), clear of the pier, the boardwalk and the village
		const P = WORLD.pier;
		const okLand = ( x, z, h ) => h > 0.7 && h < 2.4 && Math.abs( x - P.x ) > 14 && Math.hypot( x - WORLD.village.center.x, z - WORLD.village.center.z ) > 70 && Math.hypot( x - WORLD.start.position.x, z - WORLD.start.position.z ) > 12 && ( ! this.app.colliders || this.app.colliders.groundHeightAt( x, z, 50 ) <= h + 0.05 );
		const spans = [ [ - 125, - 40 ], [ 88, 160 ] ];
		let n = 0, tries = 0;
		const placedXZ = [];
		while ( n < 70 && tries ++ < 1400 ) {

			const span = spans[ Math.floor( rand() * spans.length ) ];
			const x = span[ 0 ] + rand() * ( span[ 1 ] - span[ 0 ] );
			// walk north from the water to the back-beach band
			let z = null;
			for ( let zz = 20; zz > - 160; zz -= 1.5 ) { const h = T.heightAt( x, zz ); if ( h > 0.7 ) { z = zz - rand() * 6; break; } }
			if ( z === null ) continue;
			const h = T.heightAt( x, z );
			if ( ! okLand( x, z, h ) ) continue;
			if ( placedXZ.some( ( o ) => Math.hypot( o[ 0 ] - x, o[ 1 ] - z ) < 2.2 ) ) continue;
			const r = rand();
			const id = r < 0.35 ? 'shrub_rooibos' : r < 0.62 ? 'shrub_03' : r < 0.8 ? 'dry_branches' : 'bark_debris';
			const s = id === 'bark_debris' ? 1.2 + rand() * 1.2 : id === 'dry_branches' ? 0.9 + rand() * 0.6 : 0.9 + rand() * 0.9;
			this._rec( models, id, { x, y: h - ( id === 'bark_debris' ? 0.01 : 0.03 ), z, yaw: rand() * TAU, pitch: ( rand() - 0.5 ) * 0.1, roll: ( rand() - 0.5 ) * 0.1, s, rnd: rand() } );
			placedXZ.push( [ x, z ] );
			n ++;

		}

		return { models, lighthouse: site };

	}

	// ---------------------------------------------------------------- contact surface

	// highest solid addition at x, z over the ENABLED categories (-Infinity where none)
	structureAt( x, z ) {

		let m = - Infinity;
		for ( const c of this.categories.values() ) {

			if ( ! c.field || ! this.enabled[ c.def.id ] ) continue;
			const v = c.field.at( x, z );
			if ( v > m ) m = v;

		}

		return m;

	}

	// ---------------------------------------------------------------- loading

	_model( id ) {

		if ( ! this.models.has( id ) ) this.models.set( id, new SceneryModel( id, MODELS[ id ] ) );
		return this.models.get( id );

	}

	async load() {

		const app = this.app;
		const source = app.debris && app.debris.scanned;
		const loadOpts = { terrainGPU: app.terrainGPU };
		const work = [];
		for ( const c of ADDITION_CATEGORIES ) {

			const group = new Group();
			group.name = 'additions-' + c.id;
			group.matrixAutoUpdate = false;
			group.visible = !! this.enabled[ c.id ];
			if ( this.lazy ) this._pending.push( group ); else this.group.add( group );
			const P = this.placed[ c.id ];
			const cat = { def: c, group, scan: null, models: [], swimmers: [], fish: [], field: null, instances: P.scan || [] };
			this.categories.set( c.id, cat );
			if ( this.loadNone || ( this.loadOnly && ! this.loadOnly.has( c.id ) ) ) continue;
			if ( P.scan ) {

				if ( source ) {

					cat.scan = new ScanInstances( { source, instances: P.scan, parent: group } );
					work.push( cat.scan.load() );

				}

				continue;

			}

			for ( const id in P.models ) {

				const model = this._model( id );
				const mi = new ModelInstances( { model, instances: P.models[ id ], parent: group, lodDist: MODELS[ id ].lodDist, castShadow: MODELS[ id ].castShadow !== false, sizeDist: MODELS[ id ].sizeDist ?? 6 } );
				cat.models.push( mi );
				work.push( model.load( loadOpts ).then( () => mi.load() ) );

			}

			for ( const s of P.swimmers || [] ) {

				const model = this._model( s.model );
				model.load( { ...loadOpts, mode: 'swim' } );
				const sw = new Swimmer( { ...s, model }, { parent: group, groundAt: ( x, z ) => this.floor.floorHeightAt( x, z ) } );
				cat.swimmers.push( sw );
				work.push( sw.load() );

			}

		}

		await Promise.all( work );
		// the structure fields of the solid instances (the geometry is loaded now)
		for ( const cat of this.categories.values() ) {

			let x0 = Infinity, z0 = Infinity, x1 = - Infinity, z1 = - Infinity;
			const solid = cat.models.filter( ( mi ) => MODELS[ mi.model.id ].solid && mi.model.ready );
			for ( const mi of solid ) for ( const r of mi.instances ) { x0 = Math.min( x0, r.center.x - r.radius ); z0 = Math.min( z0, r.center.z - r.radius ); x1 = Math.max( x1, r.center.x + r.radius ); z1 = Math.max( z1, r.center.z + r.radius ); }
			if ( ! solid.length || ! Number.isFinite( x0 ) ) continue;
			const field = new StructureField( x0 - 1, z0 - 1, x1 + 1, z1 + 1, 0.25 );
			for ( const mi of solid ) for ( const r of mi.instances ) field.stamp( mi.model, r.matrix, 1 );
			cat.field = field;

		}

		// the fish communities (Tidewater's own fish; after the fields: the vendor's spot search
		// and simulation see the wreck / temple as floor through floorAt)
		for ( const cat of this.categories.values() ) {

			const P = this.placed[ cat.def.id ];
			for ( const f of P.fish || [] ) {

				try {

					const fish = new SiteFish( {
						parent: cat.group, terrain: app.terrainData, center: new Vector3( f.center[ 0 ], 0, f.center[ 1 ] ), radius: f.radius, anchors: f.anchors, seed: f.seed,
						floorAt: ( x, z ) => this.floor.floorHeightAt( x, z ), shoreField: app.shoreField || null, site: { groups: f.groups },
					} );
					fish.siteId = f.id;
					cat.fish.push( fish );

				} catch ( e ) { console.error( 'SceneryAdditions fish ' + f.id, e ); }

			}

		}

		try {

			const res = await fetch( ADDITIONS_BASE + 'manifest.json' );
			if ( res.ok ) this.provenance = await res.json();

		} catch ( e ) { /* the provenance file is documentation only */ }

		this.ready = true;
		if ( ! this.lazy ) this.attached = true;

	}

	// lazy mode: put the category groups into the scene (DolphinApp calls this after Tidewater's
	// precompile, so the imported materials compile on first sight instead of all at start-up)
	attach() {

		if ( this.attached ) return;
		for ( const g of this._pending ) this.group.add( g );
		this._pending = [];
		this.attached = true;
		for ( const c of this.categories.values() ) { if ( c.scan ) c.scan.invalidate(); for ( const mi of c.models ) mi.invalidate(); }

	}

	setCategory( id, on ) {

		const c = this.categories.get( id );
		this.enabled[ id ] = !! on;
		if ( ! c ) return;
		c.group.visible = !! on;
		if ( c.scan ) c.scan.invalidate();
		for ( const mi of c.models ) mi.invalidate();

	}

	setAll( on ) {

		for ( const c of ADDITION_CATEGORIES ) this.setCategory( c.id, on );

	}

	get anyOn() {

		return ADDITION_CATEGORIES.some( ( c ) => this.enabled[ c.id ] );

	}

	get allOn() {

		return ADDITION_CATEGORIES.every( ( c ) => this.enabled[ c.id ] );

	}

	update( dt, camera ) {

		for ( const c of this.categories.values() ) {

			if ( ! c.group.visible ) continue;
			if ( c.scan ) c.scan.update( camera );
			for ( const mi of c.models ) mi.update( camera );
			for ( const sw of c.swimmers ) sw.update( dt, camera.position );
			for ( const f of c.fish ) {

				f.update( dt, camera.position );
				if ( f.mesh.visible ) {

					f.cull( camera );
					f.mesh.visible = f.batch.visibleInstances > 0;

				}

			}

		}

	}

	// the deterministic placement record (CP10 report "Assets"; eval/results/additions-manifest.json)
	manifest() {

		const records = [];
		const prov = ( id ) => ( this.provenance && this.provenance.assets && this.provenance.assets[ id ] ) || null;
		for ( const c of this.categories.values() ) {

			const P = this.placed[ c.def.id ];
			if ( P.scan ) for ( const r of P.scan ) {

				const a = ASSET_INFO[ r.asset ];
				records.push( {
					category: c.def.id, group: 'additions-' + c.def.id, asset: a.id, assetIndex: r.asset, path: a.path, source: a.source, sourceNote: SOURCE.polyhaven, license: a.license, variant: a.variant,
					position: [ + r.x.toFixed( 3 ), + r.y.toFixed( 3 ), + r.z.toFixed( 3 ) ], rotationYXZ: [ + r.yaw.toFixed( 4 ), + ( r.pitch || 0 ).toFixed( 4 ), + ( r.roll || 0 ).toFixed( 4 ) ], scale: [ + r.sx.toFixed( 3 ), + r.sy.toFixed( 3 ), + r.sz.toFixed( 3 ) ],
					rationale: c.def.rationale,
				} );

			}

			for ( const id in P.models || {} ) for ( const r of P.models[ id ] ) {

				const p = prov( id );
				const s = Array.isArray( r.s ) ? r.s : [ r.s, r.s, r.s ];
				records.push( {
					category: c.def.id, group: 'additions-' + c.def.id, asset: id, path: 'public/models/additions/' + id + '.glb', source: p ? p.provenance.url : null, sourceNote: SOURCE.library,
					license: p ? p.provenance.license : null, creator: p ? p.provenance.creator : null, title: p ? p.provenance.title : null, labSource: p ? p.provenance.labSource : null, sha256: p ? p.sha256 : null,
					position: [ + r.x.toFixed( 3 ), + r.y.toFixed( 3 ), + r.z.toFixed( 3 ) ], rotationYXZ: [ + ( r.yaw || 0 ).toFixed( 4 ), + ( r.pitch || 0 ).toFixed( 4 ), + ( r.roll || 0 ).toFixed( 4 ) ], scale: s.map( ( v ) => + v.toFixed( 3 ) ),
					rationale: c.def.rationale,
				} );

			}

			for ( const sw of P.swimmers || [] ) {

				const p = prov( sw.model );
				records.push( { category: c.def.id, group: 'additions-' + c.def.id, asset: sw.model, swimmer: sw.id, path: 'public/models/additions/' + sw.model + '.glb', source: p ? p.provenance.url : null, license: p ? p.provenance.license : null, creator: p ? p.provenance.creator : null, title: p ? p.provenance.title : null, path3d: sw.path, speed: sw.speed, rationale: c.def.rationale } );

			}

			for ( const f of P.fish || [] ) records.push( { category: c.def.id, group: 'additions-' + c.def.id, fish: f.id, source: 'Tidewater world/Fish.js (vendored, MIT)', center: f.center, radius: f.radius, groups: f.groups.map( ( g ) => [ g[ 0 ], g[ 1 ] ] ) } );

		}

		return {
			categories: ADDITION_CATEGORIES.map( ( c ) => ( { id: c.id, label: c.label, seed: c.seed, enabled: !! this.enabled[ c.id ], count: this._count( c.id ) } ) ),
			assets: SCAN_ASSETS, models: Object.keys( MODELS ), records,
		};

	}

	_count( id ) {

		const P = this.placed[ id ];
		if ( ! P ) return 0;
		let n = P.scan ? P.scan.length : 0;
		for ( const k in P.models || {} ) n += P.models[ k ].length;
		n += ( P.swimmers || [] ).length;
		return n;

	}

	stats() {

		const out = { ready: this.ready, attached: this.attached, loadMode: this.loadNone ? 'none' : this.loadOnly ? [ ...this.loadOnly ].join( ',' ) : 'all', lazy: this.lazy, categories: {} };
		for ( const c of this.categories.values() ) {

			const vis = c.group.visible;
			let tris = c.scan ? c.scan.triangles : 0, draws = c.scan && vis ? c.scan.meshes.length : 0;
			for ( const mi of c.models ) { tris += mi.triangles; draws += vis ? mi.drawCalls : 0; }
			for ( const sw of c.swimmers ) if ( sw.ready && sw.visible && vis ) { draws += sw.meshes.length; tris += sw.model.lods[ 0 ].tris; }
			let fish = 0;
			for ( const f of c.fish ) { fish += f.fishCount; if ( vis && f.mesh.visible ) draws += 1; }
			out.categories[ c.def.id ] = { enabled: vis, instances: this._count( c.def.id ), visibleTriangles: tris, drawCalls: draws, fish, fieldTop: c.field ? + c.field.top.toFixed( 2 ) : null };

		}

		return out;

	}

}
