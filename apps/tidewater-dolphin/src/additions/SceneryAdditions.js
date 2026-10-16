// SceneryAdditions — the optional, reversible scenery layer over the pristine Tidewater world
// (CP10 continuation, Phase D: asset curation).
//
// CURATION RESULT. The user's downloaded collection on this machine was audited (see the CP10
// report, "Assets"): character rigs (Sketchfab, various licences), the Kenney Modular Cave Kit
// (CC0, low-poly flat-shaded), the flight-demo props (stylized), the dolphin's own FBX / Blender
// variants and aircraft models — none of them is a realistic marine or coastal asset that
// belongs beside Tidewater's photoscans, procedural reef and vegetation. Tidewater's own reef
// already carries seagrass meadows, algae, conchs, sponges and thirty-odd coral kinds, and its
// island is densely planted; those categories are adequately represented and are left alone.
//
// What IS added — two small, coherent groups made of assets that are already in the scene, with
// certain provenance (Poly Haven, CC0 1.0; vendor/tidewater/public/models/debris/CREDITS.md) and
// rendered by Tidewater's own ScannedDebris material and LOD pipeline (shared textures, shared
// material, shared geometry attributes: no new texture memory, no new pipelines):
//   - sunkenWood   : waterlogged driftwood (trunks and branches) resting on the bare sand of the
//                    bay floor in 3.5–5.5 m of water, where the dolphin cruises — landmarks and
//                    fish shelter; the material's "wet" branch darkens and glosses them.
//   - seabedShells : lambis shells scattered in loose drifts on the shallow sand (2.5–4 m) between
//                    the beach and the reef, at the dolphin's eye level.
//
// Placement is DETERMINISTIC (mulberry32, fixed seeds, fixed anchor points) and additive: nothing
// of Tidewater's own placement, terrain or water is touched; every spot is checked against the
// reef's solid structures (bare sand only), the pier piles, the boat dock and the dolphin spawn,
// and the records are exported (manifest()) for the report. All categories off == the pristine
// scene exactly; `?original` forces that (the parity captures use it), `?enhanced` forces all on.
// Default: on.

import { Group, Vector3, Quaternion, Euler, Matrix4, Frustum, Sphere, BufferGeometry, InstancedBufferAttribute, InstancedMesh, DynamicDrawUsage } from '../../vendor/tidewater/src/engine/index.js';
import { bandFade } from '../../vendor/tidewater/src/materials/LODFade.js';
import { SCAN, SCAN_SIZE, SCAN_ASSETS } from '../../vendor/tidewater/src/world/debris/ScannedDebris.js';
import { WORLD } from '../../vendor/tidewater/src/world/WorldLayout.js';

const TAU = Math.PI * 2;
// ScannedDebris' own LOD distances / cross-fade band (module constants there; mirrored)
const LOD_DIST = [ 22, 70, 260 ];
const BAND = 0.12;

const SOURCE = {
	polyhaven: 'Poly Haven (https://polyhaven.com), CC0 1.0 — as shipped in Tidewater (vendor/tidewater/public/models/debris/, processed LODs per its CREDITS.md)',
};
const ASSET_INFO = {
	[ SCAN.TRUNK ]: { id: 'dead_quiver_trunk', path: 'vendor/tidewater/public/models/debris/dead_quiver_trunk.glb', source: 'https://polyhaven.com/a/dead_quiver_trunk', license: 'CC0 1.0', variant: 'Tidewater LOD export (4000 / 700 / 160 tris), 1K textures in the shared 2K atlas' },
	[ SCAN.BRANCH_A ]: { id: 'dead_quiver_branch_02', path: 'vendor/tidewater/public/models/debris/dead_quiver_branch_02.glb', source: 'https://polyhaven.com/a/dead_quiver_branch_02', license: 'CC0 1.0', variant: 'Tidewater LOD export (2600 / 500 / 120 tris)' },
	[ SCAN.BRANCH_B ]: { id: 'dead_quiver_branch_01', path: 'vendor/tidewater/public/models/debris/dead_quiver_branch_01.glb', source: 'https://polyhaven.com/a/dead_quiver_branch_01', license: 'CC0 1.0', variant: 'Tidewater LOD export (2600 / 500 / 120 tris)' },
	[ SCAN.SHELL ]: { id: 'lambis_shell', path: 'vendor/tidewater/public/models/debris/lambis_shell.glb', source: 'https://polyhaven.com/a/lambis_shell', license: 'CC0 1.0', variant: 'Tidewater LOD export (1400 / 300 / 80 tris)' },
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

	async load() {

		const source = this.app.debris && this.app.debris.scanned;
		if ( ! source ) return;
		const lists = { sunkenWood: this._placeSunkenWood(), seabedShells: this._placeSeabedShells() };
		for ( const c of ADDITION_CATEGORIES ) {

			const group = new Group();
			group.name = 'additions-' + c.id;
			group.matrixAutoUpdate = false;
			group.visible = !! this.enabled[ c.id ];
			this.group.add( group );
			const scan = new ScanInstances( { source, instances: lists[ c.id ], parent: group } );
			this.categories.set( c.id, { def: c, group, scan, instances: lists[ c.id ] } );

		}

		await Promise.all( [ ...this.categories.values() ].map( ( c ) => c.scan.load() ) );
		this.ready = true;

	}

	setCategory( id, on ) {

		const c = this.categories.get( id );
		this.enabled[ id ] = !! on;
		if ( ! c ) return;
		c.group.visible = !! on;
		c.scan.invalidate();

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

		for ( const c of this.categories.values() ) if ( c.group.visible ) c.scan.update( camera );

	}

	// the deterministic placement record (CP10 report "Assets")
	manifest() {

		const records = [];
		for ( const c of this.categories.values() ) for ( const r of c.instances ) {

			const a = ASSET_INFO[ r.asset ];
			records.push( {
				category: c.def.id, group: 'additions-' + c.def.id, asset: a.id, assetIndex: r.asset, path: a.path, source: a.source, sourceNote: SOURCE.polyhaven, license: a.license, variant: a.variant,
				position: [ + r.x.toFixed( 3 ), + r.y.toFixed( 3 ), + r.z.toFixed( 3 ) ], rotationYXZ: [ + r.yaw.toFixed( 4 ), + ( r.pitch || 0 ).toFixed( 4 ), + ( r.roll || 0 ).toFixed( 4 ) ], scale: [ + r.sx.toFixed( 3 ), + r.sy.toFixed( 3 ), + r.sz.toFixed( 3 ) ],
				rationale: c.def.rationale,
			} );

		}

		return { categories: ADDITION_CATEGORIES.map( ( c ) => ( { id: c.id, label: c.label, seed: c.seed, enabled: !! this.enabled[ c.id ], count: this.categories.get( c.id )?.instances.length ?? 0 } ) ), assets: SCAN_ASSETS, records };

	}

	stats() {

		const out = { ready: this.ready, categories: {} };
		for ( const c of this.categories.values() ) out.categories[ c.def.id ] = { enabled: c.group.visible, instances: c.instances.length, visibleTriangles: c.scan.triangles, drawCalls: c.group.visible ? c.scan.meshes.length : 0 };
		return out;

	}

}
