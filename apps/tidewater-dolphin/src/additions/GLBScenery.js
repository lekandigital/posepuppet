// GLBScenery — imported static models drawn as instanced, LOD-faded scenery through Tidewater's
// own engine (asset-integration pass over CP10).
//
// The models are the user's Ubuntu model-lab GLBs (CC0 / CC-BY, see public/models/additions/
// CREDITS.md and manifest.json), converted offline by tools/assets/convert.mjs into plain binary
// glTF: Y-up, metres, origin at the ground contact (or the body centre for swimmers), root nodes
// `LOD0`, `LOD1`, ... sharing the materials, embedded textures, no extensions required. They are
// read by the engine's glTF reader (engine/loaders/GLTF.js), uploaded as engine Textures and lit
// by the engine's scene lighting through Materials built here — so they get Tidewater's
// underwater attenuation, caustics, tinted ambient, shadows and TAA motion vectors like every
// vendored object, with none of the vendored code changed.
//
// Material kinds (per model, see MODELS in SceneryAdditions.js):
//   textured : glTF PBR (base colour, normal, ORM) — boats, temple, columns, slab, lighthouse, plants
//   tint     : untextured blades (sea weed, kelp thicket): per-instance green, lit through
//   stone    : untextured scans (boulders, the statue head): Tidewater's own debris stone surface
//              (NatureMaterial.stoneSurfaceModule over the shared terrain detail texture)
//   shark    : procedural counter-shaded skin
// Vertex stage: optional swell sway (kelp / weed: world-space offset growing with height, with
// the previous frame's offset for motion vectors) or the swimmers' body wave (Swimmers.js).
// Fragment stage: Bayer screen-door LOD cross-fade (materials/LODFade.js, as the debris scans),
// an algae film on the upward faces of anything under water.
//
// Instancing: one InstancedMesh per (model, LOD, material); instances are re-bucketed into the
// LODs and frustum / distance culled on the CPU when the camera moves (ScannedDebris' scheme).
// StructureField: the solid instances rasterised into a 0.25 m max-height field — the contact
// surface for the dolphin, the walker, the camera and the fish (SceneryAdditions.structureAt).

import {
	Vector3, Quaternion, Euler, Matrix3, Matrix4, Frustum, Sphere, BufferGeometry, BufferAttribute, InstancedBufferAttribute,
	InstancedMesh, DynamicDrawUsage, Color,
} from '../../vendor/tidewater/src/engine/index.js';
import { Texture } from '../../vendor/tidewater/src/engine/gpu/Texture.js';
import { generateMipmaps } from '../../vendor/tidewater/src/engine/gpu/Mipmaps.js';
import { loadGLB, decodeImage } from '../../vendor/tidewater/src/engine/loaders/GLTF.js';
import { commonModule } from '../../vendor/tidewater/src/engine/render/wgsl/common.js';
import { lodFadeModule, bandFade } from '../../vendor/tidewater/src/materials/LODFade.js';
import { standard } from '../../vendor/tidewater/src/materials/Materials.js';
import { srgb, terrainShadingModule } from '../../vendor/tidewater/src/world/terrain/TerrainShading.js';
import { stoneSurfaceModule } from '../../vendor/tidewater/src/world/debris/NatureMaterial.js';
import { WORLD } from '../../vendor/tidewater/src/world/WorldLayout.js';

export const ADDITIONS_BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/additions/';
const BAND = 0.12; // LOD cross-fade band, share of the switch distance (as ScannedDebris)
const SWELL = ( () => { const v = WORLD.swellDir.clone().normalize(); return [ v.x, v.y ]; } )();

// ---------------------------------------------------------------- WGSL

const VERTEX_COMMON = /* wgsl */`
	o.vLocal = v.position;
`;

// swell sway: a world-space offset growing with the square of the height, per-instance phase
// (iData.z) and amplitude (iData.w); the previous frame's offset keeps the motion vectors right
const VERTEX_SWAY = /* wgsl */`
	let hN = clamp( v.position.y / mat.swayHeight, 0.0, 1.0 );
	let bend = hN * hN * mat.swayAmp * v.iData.w;
	let ph = v.iData.z * 6.2832 + frame.time * mat.swaySpeed + v.position.y * 0.3;
	let php = ph - frame.dt * mat.swaySpeed;
	let dir = vec3f( ${ SWELL[ 0 ].toFixed( 4 ) }, 0.0, ${ SWELL[ 1 ].toFixed( 4 ) } );
	let side = vec3f( ${ ( - SWELL[ 1 ] ).toFixed( 4 ) }, 0.0, ${ SWELL[ 0 ].toFixed( 4 ) } );
	v.worldOffset = ( dir * ( sin( ph ) * 0.75 + sin( ph * 2.13 ) * 0.25 ) + side * cos( ph * 0.61 ) * 0.45 ) * bend;
	v.prevWorldOffset = ( dir * ( sin( php ) * 0.75 + sin( php * 2.13 ) * 0.25 ) + side * cos( php * 0.61 ) * 0.45 ) * bend;
`;

// swimmers: a travelling body wave along +z (head), amplitude growing toward the tail, along
// mat.swimAxis (x: sharks, y: sirenians); current and previous phase for the motion vectors
const VERTEX_SWIM = /* wgsl */`
	let tail = clamp( 0.5 - v.position.z / mat.bodyLength, 0.0, 1.0 );
	let env = mat.swimAmp * ( 0.12 + tail * tail * 0.88 );
	let wave = sin( mat.swimPhase - tail * mat.swimK ) * env;
	let wavePrev = sin( mat.swimPhase - mat.swimDPhase - tail * mat.swimK ) * env;
	v.worldOffset = ( v.model * vec4f( mat.swimAxis * wave, 0.0 ) ).xyz;
	v.prevWorldOffset = ( v.prevModel * vec4f( mat.swimAxis * wavePrev, 0.0 ) ).xyz;
`;

const SURFACE = /* wgsl */`
	let iData = in.vs.vIData;
#if INSTANCED_FADE
	if ( ! lodFadeVisible( in.pixel, iData.x, iData.y > 0.5 ) ) { discard; }
#endif
	let p = in.P;
	let N = in.N;
	let uv = in.uv;
#if HAS_ALBEDO
	let ca = textureSample( texAlbedo, smpAnisoRepeat, uv );
	s.albedo *= ca.rgb;
	s.alpha *= ca.a;
#endif
#if HAS_ORM
	let orm = textureSample( texOrm, smpAnisoRepeat, uv );
	s.roughness *= orm.g;
	s.metalness *= orm.b;
#if ARM_AO
	s.ao = orm.r;
#endif
#endif
#if HAS_NORMAL
	let nm = textureSample( texNormal, smpAnisoRepeat, uv ).xyz * 2.0 - 1.0;
	s.normal = perturbNormalByMap( p, N, uv, nm );
#endif
#if FOLIAGE
	// thin fronds / leaves: part of the direct light comes through from behind
	s.translucency = s.albedo * 0.45;
#endif
#if KIND_TINT
	// untextured blades: a per-instance green between two tones, darker toward the base, lit
	// through from behind like thin foliage
	var col = mix( mat.tintA, mat.tintB, iData.z );
	col = col * ( 0.72 + 0.28 * clamp( in.vs.vLocal.y / mat.swayHeight, 0.0, 1.0 ) );
	s.albedo = col;
	s.translucency = col * 0.4;
	s.roughness = 0.72;
#endif
#if KIND_STONE
	// Tidewater's debris stone (NatureMaterial): triplanar detail texture, per-instance tone
	let seed = iData.z * 7.0 + 1.0;
	let tile = mat.stoneTile;
	let so = vec2f( debrisHashS( seed, 3.1 ), debrisHashS( seed, 7.9 ) );
	let uvA = p.zy / tile + so;
	let uvB = p.xz / tile + 0.37 + so.yx;
	let uvC = p.xy / tile + 0.71;
	let A = textureSample( terrainDetailTex, smpAniso4Repeat, uvA );
	let B = textureSample( terrainDetailTex, smpAniso4Repeat, uvB );
	let Cc = textureSample( terrainDetailTex, smpAniso4Repeat, uvC );
	let w = terrainTriWeights( N );
	let T3 = A * w.x + B * w.y + Cc * w.z;
	let S = debrisStoneSurface( T3, N, iData.w, 0.0, seed, tile );
	s.albedo = S.albedo * mat.color;
	s.roughness = S.rough;
	s.normal = terrainPerturbNormal( p, N, S.hd * 2.0, 1.0 );
#endif
#if KIND_SHARK
	// counter-shaded skin: slate back, pale belly (local height), faint mottling
	let yN = in.vs.vLocal.y / mat.swayHeight;
	let back = ${ srgb( 0.27, 0.34, 0.39 ) };
	let belly = ${ srgb( 0.84, 0.86, 0.84 ) };
	let mottle = sin( in.vs.vLocal.z * 9.0 + in.vs.vLocal.x * 7.0 ) * 0.04;
	s.albedo = mix( belly, back, smoothstep( - 0.35, 0.3, yN ) ) * ( 1.0 + mottle );
	s.roughness = 0.42;
	s.specularIntensity = 0.7;
#endif
	// under water: a film of algae / silt on the upward faces of anything resting on the bottom
	let under = smoothstep( 0.0, - 2.0, p.y ) * mat.algae;
	let upK = smoothstep( 0.1, 0.7, s.normal.y );
	s.albedo = mix( s.albedo, s.albedo * ${ srgb( 0.6, 0.8, 0.56 ) } + ${ srgb( 0.035, 0.07, 0.025 ) }, under * upK );
	s.roughness = mix( s.roughness, 0.92, under * upK * 0.5 );
`;

const SHADOW = /* wgsl */`
#if HAS_ALBEDO
	if ( textureSample( texAlbedo, smpAnisoRepeat, in.uv ).a < mat.alphaTest ) { return false; }
#endif
#if INSTANCED_FADE
	return lodFadeVisible( in.pixel, in.vs.vIData.x, in.vs.vIData.y > 0.5 );
#else
	return true;
#endif
`;

// ---------------------------------------------------------------- materials

// opts: { kind: 'textured' | 'tint' | 'stone' | 'shark', mode: 'instanced' | 'swim', sway: { height, amp, speed },
//         tint: [ colorA, colorB ], stonePal, stoneTile, algae, armIsAO, bodyLength, swimAxis, swimAmp, swimK,
//         castShadow, terrainGPU }
export function buildMaterial( gm, T, opts, name ) {

	const pbr = gm.pbrMetallicRoughness || {};
	const kind = opts.kind || 'textured';
	const swim = opts.mode === 'swim';
	const uniforms = {
		swayHeight: [ 'f32', opts.sway ? opts.sway.height : ( opts.halfHeight || 1 ) ],
		swayAmp: [ 'f32', opts.sway ? opts.sway.amp : 0 ],
		swaySpeed: [ 'f32', opts.sway ? opts.sway.speed : 0 ],
		tintA: [ 'vec3f', new Color( ...( opts.tint ? opts.tint[ 0 ] : [ 0.2, 0.4, 0.15 ] ) ) ],
		tintB: [ 'vec3f', new Color( ...( opts.tint ? opts.tint[ 1 ] : [ 0.3, 0.5, 0.2 ] ) ) ],
		stonePal: [ 'f32', opts.stonePal ?? 0.45 ],
		stoneTile: [ 'f32', opts.stoneTile ?? 0.6 ],
		algae: [ 'f32', opts.algae ?? 0.55 ],
		bodyLength: [ 'f32', opts.bodyLength || 1 ],
		swimAxis: [ 'vec3f', new Vector3( ...( opts.swimAxis || [ 1, 0, 0 ] ) ) ],
		swimAmp: [ 'f32', opts.swimAmp ?? 0 ],
		swimK: [ 'f32', opts.swimK ?? 4 ],
		swimPhase: [ 'f32', 0 ],
		swimDPhase: [ 'f32', 0 ],
	};
	const textures = {};
	if ( kind === 'textured' ) {

		if ( T.albedo ) textures.texAlbedo = T.albedo;
		if ( T.normal ) textures.texNormal = T.normal;
		if ( T.orm ) textures.texOrm = T.orm;

	}

	const alphaMode = gm.alphaMode || 'OPAQUE';
	const modules = [ commonModule, lodFadeModule ];
	const defines = {
		INSTANCED_FADE: swim ? 0 : 1,
		HAS_ALBEDO: textures.texAlbedo ? 1 : 0, HAS_NORMAL: textures.texNormal ? 1 : 0, HAS_ORM: textures.texOrm ? 1 : 0,
		ARM_AO: opts.armIsAO ? 1 : 0,
		KIND_TINT: kind === 'tint' ? 1 : 0, KIND_STONE: kind === 'stone' ? 1 : 0, KIND_SHARK: kind === 'shark' ? 1 : 0, FOLIAGE: opts.foliage ? 1 : 0,
	};
	let appliesHillShadow = false;
	if ( kind === 'stone' ) {

		modules.push( terrainShadingModule(), stoneSurfaceModule );
		if ( opts.terrainGPU ) {

			// the heightfield sun shadow on the key light, as the debris (NatureMaterial)
			modules.push( opts.terrainGPU.module, opts.terrainGPU.sunModulationModule );
			defines.MATERIAL_SUN_MODULATION = 1;
			appliesHillShadow = true;

		}

	}

	const base = pbr.baseColorFactor || [ 1, 1, 1, 1 ];
	const mat = standard( {
		name,
		modules,
		uniforms,
		textures,
		color: new Color( base[ 0 ], base[ 1 ], base[ 2 ] ),
		roughness: kind === 'textured' ? ( pbr.roughnessFactor ?? 1 ) : 0.9,
		metalness: kind === 'textured' ? ( pbr.metallicFactor ?? 0 ) : 0,
		attributes: swim ? {} : { iData: 'vec4f' }, // iData: LOD fade, outgoing, random, sway amplitude
		varyings: { vIData: 'vec4f', vLocal: 'vec3f' },
		vertex: ( swim ? '\to.vIData = vec4f( 1.0, 0.0, 0.0, 0.0 );\n' : '\to.vIData = v.iData;\n' ) + VERTEX_COMMON + ( swim ? VERTEX_SWIM : opts.sway ? VERTEX_SWAY : '' ),
		surface: SURFACE,
		shadow: SHADOW,
		side: gm.doubleSided || kind === 'tint' ? 'double' : 'front',
		alphaTest: alphaMode === 'MASK' || alphaMode === 'BLEND' ? ( gm.alphaCutoff ?? 0.5 ) : 0,
		defines,
		appliesHillShadow,
	} );
	return mat;

}

// Untextured kinds share one material per look (the per-model palette rides in the instance
// data): one set of pipelines for every scanned rock and the statue, one for the weed clumps —
// fewer pipelines to compile at start-up (Tidewater precompiles every material of every pass).
const SHARED_MATERIALS = new Map();

function sharedMaterialKey( def, opts ) {

	if ( opts.mode === 'swim' ) return null;
	if ( def.kind === 'stone' ) return 'stone:' + ( def.stoneTile ?? 0.6 ) + ':' + ( def.algae ?? 0.55 );
	if ( def.kind === 'tint' ) return 'tint:' + JSON.stringify( def.tint ) + ':' + JSON.stringify( def.sway ) + ':' + ( def.algae ?? 0 );
	return null;

}

// ---------------------------------------------------------------- model

// A converted GLB: per LOD, the engine geometries with their materials. Textures are decoded
// once per image; the glTF materials become engine Materials through buildMaterial.
export class SceneryModel {

	constructor( id, def ) {

		this.id = id;
		this.def = def;
		this.lods = []; // [ { prims: [ { geometry, material, tris } ], tris } ]
		this.textures = [];
		this.materials = [];
		this.bounds = null; // local, LOD0: { min, max }
		this.center = new Vector3();
		this.radius = 0;
		this.ready = false;
		this.error = null;
		this.promise = null;

	}

	load( opts = {} ) {

		return this.promise || ( this.promise = this._load( opts ).catch( ( e ) => { this.error = e; console.error( 'SceneryModel ' + this.id, e ); } ) );

	}

	async _load( opts ) {

		const g = await loadGLB( ADDITIONS_BASE + this.id + '.glb' );
		this.gltf = g;
		const texCache = new Map();
		const tex = async ( info, isSrgb ) => {

			if ( ! info ) return null;
			const src = g.textures[ info.index ].source;
			const key = src + ( isSrgb ? 's' : 'l' );
			if ( ! texCache.has( key ) ) {

				const im = g.images[ src ];
				const px = await decodeImage( im.bytes, im.mimeType );
				const t = new Texture( { label: 'add_' + this.id + '_' + src, width: px.width, height: px.height, format: isSrgb ? 'rgba8unorm-srgb' : 'rgba8unorm', data: px.data, mips: true, usage: [ 'sample', 'copyDst' ], sampler: 'anisoRepeat' } );
				t.getGPU();
				generateMipmaps( t );
				texCache.set( key, t );
				this.textures.push( t );

			}

			return texCache.get( key );

		};

		const matCache = new Map();
		const material = async ( index ) => {

			if ( matCache.has( index ) ) return matCache.get( index );
			const gm = g.materials[ index ] || {};
			const pbr = gm.pbrMetallicRoughness || {};
			const T = this.def.kind === 'textured' || ! this.def.kind ? {
				albedo: await tex( pbr.baseColorTexture, true ),
				orm: await tex( pbr.metallicRoughnessTexture, false ),
				normal: await tex( gm.normalTexture, false ),
			} : {};
			const key = sharedMaterialKey( this.def, opts );
			if ( key && SHARED_MATERIALS.has( key ) ) { matCache.set( index, SHARED_MATERIALS.get( key ) ); return SHARED_MATERIALS.get( key ); }
			const m = buildMaterial( gm, T, { ...this.def, mode: opts.mode || 'instanced', terrainGPU: opts.terrainGPU }, key ? 'additions-' + key : 'additions-' + this.id + '-' + ( gm.name || index ) );
			matCache.set( index, m );
			if ( key ) SHARED_MATERIALS.set( key, m ); else this.materials.push( m );
			return m;

		};

		const roots = g.roots.map( ( i ) => g.nodes[ i ] ).filter( ( n ) => /^LOD\d+$/.test( n.name ) ).sort( ( a, b ) => a.name.localeCompare( b.name ) );
		if ( ! roots.length ) throw new Error( 'no LOD nodes' );
		const m4 = new Matrix4(), q = new Quaternion(), tv = new Vector3(), sv = new Vector3();
		let min = null, max = null;
		for ( const node of roots ) {

			m4.compose( tv.set( ...node.t ), q.set( ...node.r ), sv.set( ...node.s ) );
			const identity = m4.elements.every( ( v, i ) => Math.abs( v - ( i % 5 === 0 ? 1 : 0 ) ) < 1e-6 );
			const prims = [];
			for ( const p of g.meshes[ node.mesh ] || [] ) {

				const A = p.attributes;
				if ( ! A.POSITION ) continue;
				const geo = new BufferGeometry();
				const pos = new BufferAttribute( toFloat( A.POSITION ), 3 );
				if ( ! identity ) pos.applyMatrix4( m4 );
				geo.setAttribute( 'position', pos );
				if ( A.NORMAL ) {

					const nrm = new BufferAttribute( toFloat( A.NORMAL ), 3 );
					if ( ! identity ) nrm.applyNormalMatrix( new Matrix3().getNormalMatrix( m4 ) );
					geo.setAttribute( 'normal', nrm );

				}

				if ( A.TEXCOORD_0 ) geo.setAttribute( 'uv', new BufferAttribute( toFloat( A.TEXCOORD_0 ), 2 ) );
				if ( p.indices ) geo.setIndex( new BufferAttribute( p.indices instanceof Uint8Array ? new Uint16Array( p.indices ) : p.indices, 1 ) );
				geo.computeBoundingSphere();
				const tris = Math.round( ( p.indices ? p.indices.length : pos.count ) / 3 );
				prims.push( { geometry: geo, material: await material( p.material ?? 0 ), tris, materialIndex: p.material ?? 0 } );
				if ( node === roots[ 0 ] ) {

					const a = pos.array;
					for ( let i = 0; i < a.length; i += 3 ) {

						if ( ! min ) { min = [ a[ i ], a[ i + 1 ], a[ i + 2 ] ]; max = [ a[ i ], a[ i + 1 ], a[ i + 2 ] ]; continue; }
						for ( let k = 0; k < 3; k ++ ) { if ( a[ i + k ] < min[ k ] ) min[ k ] = a[ i + k ]; if ( a[ i + k ] > max[ k ] ) max[ k ] = a[ i + k ]; }

					}

				}

			}

			this.lods.push( { prims, tris: prims.reduce( ( s, p ) => s + p.tris, 0 ) } );

		}

		this.bounds = { min, max };
		this.center.set( ( min[ 0 ] + max[ 0 ] ) / 2, ( min[ 1 ] + max[ 1 ] ) / 2, ( min[ 2 ] + max[ 2 ] ) / 2 );
		this.radius = Math.hypot( max[ 0 ] - min[ 0 ], max[ 1 ] - min[ 1 ], max[ 2 ] - min[ 2 ] ) / 2;
		this.ready = true;

	}

	// triangles of a LOD (positions in local space, indexed) for the structure field
	triangles( lod = 0 ) {

		const L = this.lods[ Math.min( lod, this.lods.length - 1 ) ];
		const out = [];
		for ( const p of L.prims ) {

			const pos = p.geometry.getAttribute( 'position' ).array;
			const idx = p.geometry.index ? p.geometry.index.array : null;
			out.push( { pos, idx } );

		}

		return out;

	}

	dispose() {

		for ( const L of this.lods ) for ( const p of L.prims ) p.geometry.dispose();
		for ( const m of this.materials ) m.dispose();
		for ( const t of this.textures ) t.destroy();
		this.lods = [];

	}

}

function toFloat( a ) {

	if ( a.array instanceof Float32Array ) return a.array;
	const f = new Float32Array( a.array.length );
	const k = a.normalized ? 1 / ( { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535 }[ a.array.constructor.name ] || 1 ) : 1;
	for ( let i = 0; i < f.length; i ++ ) f[ i ] = a.array[ i ] * k;
	return f;

}

// ---------------------------------------------------------------- instances

// record: { x, y, z, yaw, pitch, roll, s | [ sx, sy, sz ], rnd, sway }
export function recordMatrix( r, out = new Matrix4() ) {

	const q = new Quaternion().setFromEuler( new Euler( r.pitch || 0, r.yaw || 0, r.roll || 0, 'YXZ' ) );
	const s = Array.isArray( r.s ) ? r.s : [ r.s ?? 1, r.s ?? 1, r.s ?? 1 ];
	return out.compose( new Vector3( r.x, r.y, r.z ), q, new Vector3( s[ 0 ], s[ 1 ], s[ 2 ] ) );

}

export class ModelInstances {

	// lodDist: [ LOD0 → LOD1, LOD1 → LOD2 (or fade out), fade out ] in metres (+ 6 x the instance radius)
	constructor( { model, instances, parent, lodDist = [ 22, 60, 110 ], castShadow = true, sizeDist = 6 } ) {

		this.model = model;
		this.instances = instances;
		this.parent = parent;
		this.lodDist = lodDist;
		this.castShadow = castShadow;
		this.sizeDist = sizeDist;
		this.levels = [];
		this.meshes = [];
		this.ready = false;
		this._lastCam = new Vector3( 1e9, 0, 0 );
		this._lastQuat = new Quaternion();
		this._frustum = new Frustum();
		this._m4 = new Matrix4();
		this._sphere = new Sphere();
		this._v = new Vector3();
		this._c = new Vector3();

	}

	async load() {

		await this.model.load();
		if ( ! this.model.ready ) return;
		const M = this.model;
		for ( const r of this.instances ) {

			r.matrix = recordMatrix( r );
			const s = Array.isArray( r.s ) ? Math.max( ...r.s ) : ( r.s ?? 1 );
			r.radius = M.radius * s;
			r.center = this._c.copy( M.center ).applyMatrix4( r.matrix ).clone();
			// iData.w: the sway amplitude of a swaying model, the stone palette of a scanned rock
			if ( M.def.kind === 'stone' ) r.sway = M.def.stonePal ?? 0.45;

		}

		const n = Math.max( 1, this.instances.length );
		this.levels = M.lods.map( ( L, l ) => {

			const iData = new InstancedBufferAttribute( new Float32Array( n * 4 ), 4 );
			iData.setUsage( DynamicDrawUsage );
			const meshes = L.prims.map( ( p ) => {

				const geo = new BufferGeometry();
				for ( const name of [ 'position', 'normal', 'uv' ] ) if ( p.geometry.getAttribute( name ) ) geo.setAttribute( name, p.geometry.getAttribute( name ) );
				geo.setIndex( p.geometry.index );
				geo.boundingSphere = p.geometry.boundingSphere;
				geo.setAttribute( 'iData', iData );
				const mesh = new InstancedMesh( geo, p.material, n );
				mesh.name = `additions-${ M.id }-lod${ l }`;
				mesh.count = 0;
				mesh.castShadow = l === 0 && this.castShadow;
				mesh.receiveShadow = true;
				mesh.frustumCulled = false;
				mesh.instanceMatrix.setUsage( DynamicDrawUsage );
				mesh.staticVelocity = true;
				mesh.visible = false;
				this.parent.add( mesh );
				this.meshes.push( mesh );
				return mesh;

			} );
			return { meshes, iData, tris: L.tris };

		} );
		this.ready = true;
		this.invalidate();

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
		const nL = this.levels.length;
		const counts = new Array( nL ).fill( 0 );
		const [ a, b, c ] = this.lodDist;
		for ( const r of this.instances ) {

			this._sphere.center.copy( r.center );
			this._sphere.radius = r.radius + 4;
			if ( ! this._frustum.intersectsSphere( this._sphere ) ) continue;
			const d = Math.hypot( r.center.x - cam.x, r.center.y - cam.y, r.center.z - cam.z ) - r.radius * this.sizeDist;
			const out = bandFade( d, c * ( 1 - BAND ), c );
			if ( out >= 1 ) continue;
			if ( nL === 1 ) { this._put( 0, counts, r, 1 - out, 0 ); continue; }
			const t01 = bandFade( d, a * ( 1 - BAND / 2 ), a * ( 1 + BAND / 2 ) );
			if ( nL === 2 ) {

				if ( t01 < 1 ) this._put( 0, counts, r, t01, 1 );
				if ( t01 > 0 ) this._put( 1, counts, r, t01 * ( 1 - out ), 0 );
				continue;

			}

			const t12 = bandFade( d, b * ( 1 - BAND / 2 ), b * ( 1 + BAND / 2 ) );
			if ( t01 < 1 ) this._put( 0, counts, r, t01, 1 );
			if ( t01 > 0 && t12 < 1 ) this._put( 1, counts, r, t12 > 0 ? t12 : t01, t12 > 0 ? 1 : 0 );
			if ( t12 > 0 ) this._put( 2, counts, r, t12 * ( 1 - out ), 0 );

		}

		this.levels.forEach( ( L, l ) => {

			const n = counts[ l ];
			for ( const mesh of L.meshes ) {

				mesh.count = n;
				mesh.visible = n > 0;
				mesh.instanceMatrix.clearUpdateRanges();
				mesh.instanceMatrix.addUpdateRange( 0, Math.max( 1, n ) * 16 );
				mesh.instanceMatrix.needsUpdate = true;

			}

			L.iData.clearUpdateRanges();
			L.iData.addUpdateRange( 0, Math.max( 1, n ) * 4 );
			L.iData.needsUpdate = true;

		} );

	}

	_put( l, counts, r, fade, outgoing ) {

		const L = this.levels[ l ];
		const i = counts[ l ] ++;
		for ( const mesh of L.meshes ) mesh.setMatrixAt( i, r.matrix );
		L.iData.array.set( [ fade, outgoing, r.rnd ?? 0, r.sway ?? 0 ], i * 4 );

	}

	get triangles() {

		return this.ready ? this.levels.reduce( ( a, L ) => a + ( L.meshes[ 0 ] ? L.meshes[ 0 ].count : 0 ) * L.tris, 0 ) : 0;

	}

	get drawCalls() {

		return this.ready ? this.levels.reduce( ( a, L ) => a + L.meshes.filter( ( m ) => m.visible ).length, 0 ) : 0;

	}

	invalidate() {

		this._lastCam.set( 1e9, 0, 0 );

	}

	dispose() {

		for ( const m of this.meshes ) { m.geometry.dispose(); this.parent.remove( m ); }
		this.meshes = [];
		this.levels = [];

	}

}

// ---------------------------------------------------------------- structure field

// Max-height field (0.25 m cells) of the solid instances of a category: the contact surface
// for the dolphin's sim and camera, Tidewater's walker and the fish (like the reef's own field).
export class StructureField {

	constructor( x0, z0, x1, z1, cell = 0.25 ) {

		this.cell = cell;
		this.x0 = Math.floor( x0 / cell ) * cell;
		this.z0 = Math.floor( z0 / cell ) * cell;
		this.w = Math.max( 1, Math.ceil( ( x1 - this.x0 ) / cell ) + 1 );
		this.h = Math.max( 1, Math.ceil( ( z1 - this.z0 ) / cell ) + 1 );
		this.data = new Float32Array( this.w * this.h ).fill( - Infinity );
		this.top = - Infinity;
		this.count = 0;

	}

	// rasterise a model's triangles (local positions, indexed) under an instance matrix
	stamp( model, matrix, lod = 1 ) {

		const e = matrix.elements;
		const cell = this.cell;
		const tx = ( x, y, z ) => e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ];
		const ty = ( x, y, z ) => e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ];
		const tz = ( x, y, z ) => e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ];
		for ( const { pos, idx } of model.triangles( lod ) ) {

			const n = idx ? idx.length : pos.length / 3;
			const P = [];
			for ( let t = 0; t < n; t += 3 ) {

				for ( let k = 0; k < 3; k ++ ) {

					const i = ( idx ? idx[ t + k ] : t + k ) * 3;
					const x = pos[ i ], y = pos[ i + 1 ], z = pos[ i + 2 ];
					P[ k * 3 ] = tx( x, y, z ); P[ k * 3 + 1 ] = ty( x, y, z ); P[ k * 3 + 2 ] = tz( x, y, z );

				}

				this._tri( P );

			}

		}

		this.count ++;

	}

	_set( i, j, y ) {

		if ( i < 0 || j < 0 || i >= this.w || j >= this.h ) return;
		const k = j * this.w + i;
		if ( y > this.data[ k ] ) { this.data[ k ] = y; if ( y > this.top ) this.top = y; }

	}

	_tri( P ) {

		const cell = this.cell;
		const ax = P[ 0 ], ay = P[ 1 ], az = P[ 2 ], bx = P[ 3 ], by = P[ 4 ], bz = P[ 5 ], cx = P[ 6 ], cy = P[ 7 ], cz = P[ 8 ];
		// the vertices' own cells (thin / vertical triangles still register)
		this._set( Math.round( ( ax - this.x0 ) / cell ), Math.round( ( az - this.z0 ) / cell ), ay );
		this._set( Math.round( ( bx - this.x0 ) / cell ), Math.round( ( bz - this.z0 ) / cell ), by );
		this._set( Math.round( ( cx - this.x0 ) / cell ), Math.round( ( cz - this.z0 ) / cell ), cy );
		const area = ( bx - ax ) * ( cz - az ) - ( bz - az ) * ( cx - ax );
		if ( Math.abs( area ) < 1e-6 ) return;
		const i0 = Math.max( 0, Math.floor( ( Math.min( ax, bx, cx ) - this.x0 ) / cell ) ), i1 = Math.min( this.w - 1, Math.ceil( ( Math.max( ax, bx, cx ) - this.x0 ) / cell ) );
		const j0 = Math.max( 0, Math.floor( ( Math.min( az, bz, cz ) - this.z0 ) / cell ) ), j1 = Math.min( this.h - 1, Math.ceil( ( Math.max( az, bz, cz ) - this.z0 ) / cell ) );
		const inv = 1 / area;
		const tol = - 0.35 * cell * Math.sqrt( Math.abs( area ) ) * 0; // exact test; vertex cells cover the edges
		for ( let j = j0; j <= j1; j ++ ) {

			const pz = this.z0 + j * cell;
			for ( let i = i0; i <= i1; i ++ ) {

				const px = this.x0 + i * cell;
				const w0 = ( ( bx - px ) * ( cz - pz ) - ( bz - pz ) * ( cx - px ) ) * inv;
				const w1 = ( ( cx - px ) * ( az - pz ) - ( cz - pz ) * ( ax - px ) ) * inv;
				const w2 = 1 - w0 - w1;
				if ( w0 < tol || w1 < tol || w2 < tol ) continue;
				this._set( i, j, w0 * ay + w1 * by + w2 * cy );

			}

		}

	}

	// highest solid at x, z (the 4 cells around the point: conservative), -Infinity where none
	at( x, z ) {

		const fx = ( x - this.x0 ) / this.cell, fz = ( z - this.z0 ) / this.cell;
		const i = Math.floor( fx ), j = Math.floor( fz );
		if ( i < - 1 || j < - 1 || i >= this.w || j >= this.h ) return - Infinity;
		let m = - Infinity;
		for ( let dj = 0; dj <= 1; dj ++ ) for ( let di = 0; di <= 1; di ++ ) {

			const ii = i + di, jj = j + dj;
			if ( ii < 0 || jj < 0 || ii >= this.w || jj >= this.h ) continue;
			const v = this.data[ jj * this.w + ii ];
			if ( v > m ) m = v;

		}

		return m;

	}

}
