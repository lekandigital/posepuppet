// BodyArcade asset pass — Ubuntu model-lab GLB → Tidewater runtime GLB.
//
// Input: the lab's normalised GLBs (`/home/o/model-lab/derived/glb/<lab id>.glb` on the asset
// server, copied into --in directories together with their `<lab id>__asset.json` cards).
// Output: one runtime GLB per recipe in --out (public/models/additions/), Y-up, metres, origin at
// the recipe's pivot, with the levels of detail as root nodes `LOD0`, `LOD1`, ... sharing the
// materials, textures resized / re-encoded, no extensions required (Tidewater's own glTF
// reader: no Draco / meshopt / quantisation, embedded images only), plus `manifest.json`
// (provenance, licence, transforms, statistics, SHA-256 of source and output).
//
//   node convert.mjs --in <dir> [--in <dir>] --out <dir> [--only id,id] [--manifest path]
//
// Per recipe (recipes.mjs): drop nodes / primitives by name, bake the node transforms and the
// skinned REST pose into the vertices (skeletons, animations and morph targets are removed:
// motion is done at runtime in the vertex stage), override materials, weld, join primitives per
// material, re-pivot / rotate / scale, decimate (meshoptimizer) into LODs, resize textures (sharp).

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weldPrimitive, simplifyPrimitive, joinPrimitives, transformPrimitive, listTextureSlots } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mat4, vec3 } from 'gl-matrix';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice( 2 );
const ins = [];
let out = null, only = null, manifestPath = null, recipesPath = './recipes.mjs';
for ( let i = 0; i < argv.length; i ++ ) {

	if ( argv[ i ] === '--in' ) ins.push( resolve( argv[ ++ i ] ) );
	else if ( argv[ i ] === '--out' ) out = resolve( argv[ ++ i ] );
	else if ( argv[ i ] === '--only' ) only = new Set( argv[ ++ i ].split( ',' ) );
	else if ( argv[ i ] === '--manifest' ) manifestPath = resolve( argv[ ++ i ] );
	else if ( argv[ i ] === '--recipes' ) recipesPath = argv[ ++ i ];

}

// --recipes <file>: another recipe table (e.g. recipes-future.mjs for the staged future-game assets)
const { RECIPES } = await import( recipesPath.startsWith( '.' ) ? new URL( recipesPath, import.meta.url ).href : pathToFileURL( resolve( recipesPath ) ).href );

if ( ! ins.length || ! out ) throw new Error( 'usage: node convert.mjs --in <dir> --out <dir> [--only a,b]' );
mkdirSync( out, { recursive: true } );
manifestPath = manifestPath || join( out, 'manifest.json' );
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions( ALL_EXTENSIONS );
const sha256 = ( buf ) => createHash( 'sha256' ).update( buf ).digest( 'hex' );
const findIn = ( name ) => { for ( const d of ins ) { const p = join( d, name ); if ( existsSync( p ) ) return p; } return null; };
const f3 = ( a ) => Array.from( a, ( v ) => + ( + v ).toFixed( 3 ) );

// ---- helpers ------------------------------------------------------------------------------

function triCount( prim ) {

	const idx = prim.getIndices();
	const n = idx ? idx.getCount() : prim.getAttribute( 'POSITION' ).getCount();
	return Math.round( n / 3 );

}

function meshTris( mesh ) {

	return mesh.listPrimitives().reduce( ( a, p ) => a + triCount( p ), 0 );

}

// the skinned rest pose: v' = sum_k w_k ( jointWorld_k * inverseBind_k ) v  (the skinned mesh
// node's own transform is ignored, as in glTF)
function bakeSkin( doc, prim, skin ) {

	const joints = skin.listJoints();
	const ibm = skin.getInverseBindMatrices().getArray();
	const M = joints.map( ( j, k ) => mat4.multiply( mat4.create(), j.getWorldMatrix(), ibm.subarray( k * 16, k * 16 + 16 ) ) );
	const pos = prim.getAttribute( 'POSITION' ), nrm = prim.getAttribute( 'NORMAL' );
	const J = prim.getAttribute( 'JOINTS_0' ), W = prim.getAttribute( 'WEIGHTS_0' );
	if ( ! J || ! W ) return;
	const n = pos.getCount();
	const P = new Float32Array( n * 3 ), N = nrm ? new Float32Array( n * 3 ) : null;
	const p = [ 0, 0, 0 ], nn = [ 0, 0, 0 ], j4 = [ 0, 0, 0, 0 ], w4 = [ 0, 0, 0, 0 ];
	const S = mat4.create(), v = vec3.create();
	for ( let i = 0; i < n; i ++ ) {

		pos.getElement( i, p ); J.getElement( i, j4 ); W.getElement( i, w4 );
		let ws = w4[ 0 ] + w4[ 1 ] + w4[ 2 ] + w4[ 3 ];
		if ( ws <= 0 ) { w4[ 0 ] = 1; ws = 1; }
		for ( let e = 0; e < 16; e ++ ) S[ e ] = 0;
		for ( let k = 0; k < 4; k ++ ) {

			const w = w4[ k ] / ws;
			if ( w === 0 ) continue;
			const m = M[ j4[ k ] ];
			for ( let e = 0; e < 16; e ++ ) S[ e ] += m[ e ] * w;

		}

		vec3.transformMat4( v, p, S );
		P.set( v, i * 3 );
		if ( N ) {

			nrm.getElement( i, nn );
			// normal: 3x3 of S (uniform-ish scale in rest poses), renormalised
			const x = S[ 0 ] * nn[ 0 ] + S[ 4 ] * nn[ 1 ] + S[ 8 ] * nn[ 2 ];
			const y = S[ 1 ] * nn[ 0 ] + S[ 5 ] * nn[ 1 ] + S[ 9 ] * nn[ 2 ];
			const z = S[ 2 ] * nn[ 0 ] + S[ 6 ] * nn[ 1 ] + S[ 10 ] * nn[ 2 ];
			const l = Math.hypot( x, y, z ) || 1;
			N.set( [ x / l, y / l, z / l ], i * 3 );

		}

	}

	const buffer = doc.getRoot().listBuffers()[ 0 ];
	prim.setAttribute( 'POSITION', doc.createAccessor().setType( 'VEC3' ).setArray( P ).setBuffer( buffer ) );
	if ( N ) prim.setAttribute( 'NORMAL', doc.createAccessor().setType( 'VEC3' ).setArray( N ).setBuffer( buffer ) );

}

// Everything drawn in the scene -> one mesh of world-space primitives under a root node 'LOD0'.
function bake( doc, recipe ) {

	const root = doc.getRoot();
	const scene = root.listScenes()[ 0 ];
	const buffer = root.listBuffers()[ 0 ];
	const prims = [];
	const dropAttr = recipe.dropAttributes || [ 'COLOR_0', '_COLOR_0', 'TANGENT', 'TEXCOORD_1' ];
	const visit = ( node, keep ) => {

		const name = node.getName();
		let k = keep;
		if ( recipe.keepNodes && ! recipe.keepNodes.test( name ) && ! keep ) k = false; else k = true;
		if ( recipe.dropNodes && recipe.dropNodes.test( name ) ) return;
		const mesh = node.getMesh();
		if ( mesh && k ) {

			const world = node.getWorldMatrix();
			const skin = node.getSkin();
			for ( const prim of mesh.listPrimitives() ) {

				if ( prim.getMode() !== 4 ) continue; // triangles only
				const matName = prim.getMaterial()?.getName() || '';
				if ( recipe.dropMaterials && recipe.dropMaterials.test( matName ) ) continue;
				const p = prim.clone();
				for ( const t of p.listTargets() ) p.removeTarget( t );
				if ( skin ) bakeSkin( doc, p, skin ); else {

					// own copies of the shared accessors before transforming
					for ( const sem of [ 'POSITION', 'NORMAL' ] ) {

						const a = p.getAttribute( sem );
						if ( a ) p.setAttribute( sem, doc.createAccessor().setType( a.getType() ).setArray( Float32Array.from( a.getArray() ) ).setBuffer( buffer ) );

					}

					transformPrimitive( p, world );

				}

				for ( const sem of [ 'JOINTS_0', 'WEIGHTS_0', 'JOINTS_1', 'WEIGHTS_1', ...dropAttr ] ) if ( p.getAttribute( sem ) ) p.setAttribute( sem, null );
				prims.push( p );

			}

		}

		for ( const c of node.listChildren() ) visit( c, k && ! recipe.keepNodes ? true : k );

	};

	for ( const n of scene.listChildren() ) visit( n, ! recipe.keepNodes );
	for ( const n of root.listNodes() ) n.dispose();
	for ( const m of root.listMeshes() ) m.dispose();
	for ( const s of root.listSkins() ) s.dispose();
	for ( const a of root.listAnimations() ) a.dispose();
	for ( const c of root.listCameras() ) c.dispose();
	const mesh = doc.createMesh( 'LOD0' );
	for ( const p of prims ) mesh.addPrimitive( p );
	const node = doc.createNode( 'LOD0' ).setMesh( mesh );
	scene.addChild( node );
	return { mesh, node };

}

function applyMaterials( doc, recipe ) {

	const rules = recipe.materials || {};
	for ( const m of doc.getRoot().listMaterials() ) {

		for ( const e of m.listExtensions() ) e.dispose(); // KHR_materials_specular / ior / specGloss: not read at runtime
		const r = { ...( rules[ '*' ] || {} ), ...( rules[ m.getName() ] || {} ) };
		if ( r.baseColor ) m.setBaseColorFactor( r.baseColor );
		if ( r.metallic !== undefined ) m.setMetallicFactor( r.metallic );
		if ( r.roughness !== undefined ) m.setRoughnessFactor( r.roughness );
		if ( r.alphaMode ) m.setAlphaMode( r.alphaMode );
		if ( r.alphaCutoff !== undefined ) m.setAlphaCutoff( r.alphaCutoff );
		if ( r.doubleSided !== undefined ) m.setDoubleSided( r.doubleSided );
		if ( r.dropTextures ) { m.setBaseColorTexture( null ); m.setNormalTexture( null ); m.setMetallicRoughnessTexture( null ); m.setOcclusionTexture( null ); m.setEmissiveTexture( null ); }
		if ( r.dropNormal ) m.setNormalTexture( null );
		if ( r.dropMR ) m.setMetallicRoughnessTexture( null );
		m.setEmissiveTexture( null ); m.setEmissiveFactor( [ 0, 0, 0 ] ); m.setOcclusionTexture( null );

	}

}

// weld + join primitives per (material, attribute set)
function joinPerMaterial( doc, mesh ) {

	const groups = new Map();
	for ( const p of mesh.listPrimitives() ) {

		weldPrimitive( p );
		const key = ( p.getMaterial()?.getName() || '' ) + '|' + p.listSemantics().sort().join( ',' );
		if ( ! groups.has( key ) ) groups.set( key, [] );
		groups.get( key ).push( p );

	}

	for ( const [ , list ] of groups ) {

		if ( list.length < 2 ) continue;
		try {

			const joined = joinPrimitives( list );
			for ( const p of list ) { mesh.removePrimitive( p ); p.dispose(); }
			mesh.addPrimitive( joined );

		} catch ( e ) { console.warn( '   join skipped:', e.message ); }

	}

}

function simplifyMesh( mesh, byMaterial, dflt, lockBorder = false ) {

	for ( const p of mesh.listPrimitives() ) {

		const name = p.getMaterial()?.getName() || '';
		const r = byMaterial && byMaterial[ name ] !== undefined ? byMaterial[ name ] : dflt;
		if ( r === undefined || r === null || r >= 1 ) continue;
		const before = triCount( p );
		simplifyPrimitive( p, { simplifier: MeshoptSimplifier, ratio: typeof r === 'number' ? r : r.ratio, error: typeof r === 'number' ? 0.02 : ( r.error ?? 0.02 ), lockBorder } );
		console.log( `   simplify ${ name || '(mat)' }: ${ before } → ${ triCount( p ) } tris` );

	}

}


// Drop whole connected components (blades, leaf cards, twigs) by a seeded hash: the only way to
// reduce foliage made of thousands of small separate pieces, which edge collapse cannot merge.
function thinPrimitive( doc, prim, keep, seed = 1 ) {

	const idxA = prim.getIndices();
	const pos = prim.getAttribute( 'POSITION' );
	const n = pos.getCount();
	const idx = idxA ? idxA.getArray() : Uint32Array.from( { length: n }, ( _, i ) => i );
	// union-find over the index triangles
	const parent = new Int32Array( n ); for ( let i = 0; i < n; i ++ ) parent[ i ] = i;
	const find = ( a ) => { while ( parent[ a ] !== a ) { parent[ a ] = parent[ parent[ a ] ]; a = parent[ a ]; } return a; };
	const union = ( a, b ) => { a = find( a ); b = find( b ); if ( a !== b ) parent[ a ] = b; };
	for ( let t = 0; t < idx.length; t += 3 ) { union( idx[ t ], idx[ t + 1 ] ); union( idx[ t + 1 ], idx[ t + 2 ] ); }
	const compId = new Map(); let nComp = 0;
	const rootOf = new Int32Array( n );
	for ( let i = 0; i < n; i ++ ) { const r = find( i ); if ( ! compId.has( r ) ) compId.set( r, nComp ++ ); rootOf[ i ] = compId.get( r ); }
	const hash = ( c ) => { let h = ( c * 2654435761 + seed * 40503 ) >>> 0; h ^= h >>> 13; h = Math.imul( h, 0x5bd1e995 ) >>> 0; h ^= h >>> 15; return ( h >>> 0 ) / 4294967296; };
	const keepComp = new Uint8Array( nComp ); for ( let c = 0; c < nComp; c ++ ) keepComp[ c ] = hash( c ) < keep ? 1 : 0;
	const out = [];
	for ( let t = 0; t < idx.length; t += 3 ) if ( keepComp[ rootOf[ idx[ t ] ] ] ) out.push( idx[ t ], idx[ t + 1 ], idx[ t + 2 ] );
	const buffer = doc.getRoot().listBuffers()[ 0 ];
	prim.setIndices( doc.createAccessor().setType( 'SCALAR' ).setArray( n > 65535 ? Uint32Array.from( out ) : Uint16Array.from( out ) ).setBuffer( buffer ) );
	return { components: nComp, kept: keepComp.reduce( ( a, b ) => a + b, 0 ) };

}

async function compressTextures( doc, recipe ) {

	const sizes = { baseColor: 1024, normal: 1024, metallicRoughness: 512, occlusion: 512, emissive: 512, ...( recipe.textures || {} ) };
	const report = [];
	for ( const tex of doc.getRoot().listTextures() ) {

		const slots = listTextureSlots( tex );
		const slot = slots.find( ( s ) => s in sizes ) || slots[ 0 ] || 'baseColor';
		const target = sizes[ slot ] ?? 1024;
		const img = tex.getImage();
		if ( ! img ) continue;
		const meta = await sharp( img ).metadata();
		const stats = await sharp( img ).stats();
		// alpha only where it is used (MASK / BLEND materials): the mask lives in base colour
		const usesAlpha = ! stats.isOpaque && slot === 'baseColor' && doc.getRoot().listMaterials().some( ( m ) => m.getBaseColorTexture() === tex && ( m.getAlphaMode() !== 'OPAQUE' || recipe.autoMask ) );
		if ( recipe.autoMask && ! stats.isOpaque && slot === 'baseColor' ) for ( const m of doc.getRoot().listMaterials() ) if ( m.getBaseColorTexture() === tex && m.getAlphaMode() === 'OPAQUE' ) { m.setAlphaMode( 'MASK' ); m.setAlphaCutoff( recipe.alphaCutoff ?? 0.5 ); }
		const w = Math.min( target, meta.width ), h = Math.round( meta.height * w / meta.width );
		let s = sharp( img ).resize( { width: w, height: h, fit: 'fill', kernel: 'lanczos3' } );
		let mime;
		if ( usesAlpha ) { s = s.png( { compressionLevel: 9, palette: false } ); mime = 'image/png'; }
		else { s = s.flatten( { background: '#000000' } ).jpeg( { quality: slot === 'normal' ? 90 : 84, chromaSubsampling: slot === 'normal' ? '4:4:4' : '4:2:0', mozjpeg: true } ); mime = 'image/jpeg'; }
		const buf = await s.toBuffer();
		tex.setImage( new Uint8Array( buf ) ).setMimeType( mime );
		report.push( { name: tex.getName(), slot, from: `${ meta.width }x${ meta.height } ${ meta.format } ${ Math.round( img.byteLength / 1024 ) }K`, to: `${ w }x${ h } ${ mime.split( '/' )[ 1 ] } ${ Math.round( buf.byteLength / 1024 ) }K`, alpha: usesAlpha } );

	}

	return report;

}

// ---- main ---------------------------------------------------------------------------------

const manifest = existsSync( manifestPath ) ? JSON.parse( readFileSync( manifestPath, 'utf8' ) ) : { generated: null, assets: {} };
for ( const recipe of RECIPES ) {

	if ( only && ! only.has( recipe.id ) ) continue;
	const srcPath = findIn( recipe.src + '.glb' );
	if ( ! srcPath ) { console.warn( `!! ${ recipe.id }: source ${ recipe.src }.glb not found in --in`, ins ); continue; }
	console.log( `\n== ${ recipe.id } ← ${ recipe.src }` );
	const srcBuf = readFileSync( srcPath );
	const doc = await io.readBinary( new Uint8Array( srcBuf ) );
	const card = findIn( recipe.src + '__asset.json' );
	const A = card ? JSON.parse( readFileSync( card, 'utf8' ) ) : {};
	// kit pieces (`<pack>--k-<piece>`) carry their provenance on the pack's own card
	const parentCard = recipe.src.includes( '--k-' ) ? findIn( recipe.src.replace( /--k-.*$/, '' ) + '__asset.json' ) : null;
	const PA = parentCard ? JSON.parse( readFileSync( parentCard, 'utf8' ) ) : {};
	// the cards keep author / page under different keys per source; look everywhere sensible
	const places = ( X ) => [ X, X.provenance, X.source, X.identity, X.meta && X.meta.oga, X.meta && X.meta.prov, X.license ].filter( ( o ) => o && typeof o === 'object' );
	const ALIASES = { creator: [ 'creator', 'author', 'artist' ], product_url: [ 'product_url', 'url', 'page', 'source_url' ], site: [ 'site', 'source_site' ] };
	const field = ( k ) => { for ( const X of [ A, PA ] ) for ( const o of places( X ) ) for ( const kk of ALIASES[ k ] || [ k ] ) if ( o[ kk ] && typeof o[ kk ] === 'string' ) return o[ kk ]; return null; };
	let mesh, node;
	if ( recipe.passthrough ) {

		// rigged / animated sources kept as they are (skeleton, clips, hierarchy): only the
		// textures are resized and the materials cleaned; a uniform root scale when asked
		console.log( `   passthrough: ${ doc.getRoot().listMeshes().length } meshes, ${ doc.getRoot().listSkins().length } skins, ${ doc.getRoot().listAnimations().length } clips` );
		applyMaterials( doc, recipe );
		if ( recipe.scale && recipe.scale !== 1 ) for ( const n of doc.getRoot().listScenes()[ 0 ].listChildren() ) n.setScale( n.getScale().map( ( v ) => v * recipe.scale ) );
		const textures = await compressTextures( doc, recipe );
		await doc.transform( prune(), dedup() );
		const scene0 = doc.getRoot().listScenes()[ 0 ];
		const b0 = getBounds( scene0 );
		const size0 = [ 0, 1, 2 ].map( ( i ) => b0.max[ i ] - b0.min[ i ] );
		const tris0 = doc.getRoot().listMeshes().reduce( ( a, m ) => a + meshTris( m ), 0 );
		const A2 = A, PA2 = PA;
		const places2 = ( X ) => [ X, X.provenance, X.source, X.identity, X.meta && X.meta.oga, X.license ].filter( ( o ) => o && typeof o === 'object' );
		const f2 = ( k, al ) => { for ( const X of [ A2, PA2 ] ) for ( const o of places2( X ) ) for ( const kk of al ) if ( o[ kk ] && typeof o[ kk ] === 'string' ) return o[ kk ]; return null; };
		const lic2 = A.license && A.license.class ? A.license : ( PA.license || {} );
		const prov2 = { labId: recipe.src, title: ( recipe.provenance && recipe.provenance.title ) || A.title || recipe.src, creator: ( recipe.provenance && recipe.provenance.creator ) || f2( 'creator', [ 'creator', 'author' ] ), site: ( recipe.provenance && recipe.provenance.site ) || f2( 'site', [ 'site' ] ), url: ( recipe.provenance && recipe.provenance.url ) || f2( 'url', [ 'product_url', 'url', 'source_url' ] ), license: lic2.class || null, licenseLabel: lic2.label || null, attributionDraft: lic2.attribution_draft || null, labSource: `/home/o/model-lab/derived/glb/${ recipe.src }.glb`, labSha256: sha256( srcBuf ), labBytes: srcBuf.byteLength };
		doc.getRoot().getAsset().generator = 'BodyArcade asset pass — glTF-Transform ' + ( doc.getRoot().getAsset().generator || '' );
		doc.getRoot().getAsset().extras = { bodyarcade: { id: recipe.id, ...prov2, passthrough: true } };
		const outPath2 = join( out, recipe.id + '.glb' );
		const bin2 = await io.writeBinary( doc );
		writeFileSync( outPath2, bin2 );
		manifest.assets[ recipe.id ] = {
			id: recipe.id, file: recipe.id + '.glb', bytes: bin2.byteLength, sha256: sha256( bin2 ), provenance: prov2,
			recipe: { passthrough: true, scale: recipe.scale ?? 1, note: recipe.note || null, pivot: 'as source', lods: [] },
			bounds: { min: f3( b0.min ), max: f3( b0.max ), size: f3( size0 ) }, lods: [ { node: 'scene', tris: tris0 } ],
			rig: { skins: doc.getRoot().listSkins().map( ( sk ) => sk.listJoints().length ), clips: doc.getRoot().listAnimations().map( ( a ) => a.getName() ) },
			materials: doc.getRoot().listMaterials().map( ( m ) => ( { name: m.getName(), alphaMode: m.getAlphaMode(), doubleSided: m.getDoubleSided(), baseColor: f3( m.getBaseColorFactor() ), textures: { base: !! m.getBaseColorTexture(), normal: !! m.getNormalTexture(), mr: !! m.getMetallicRoughnessTexture() } } ) ), textures,
		};
		console.log( `   → ${ recipe.id }.glb ${ ( bin2.byteLength / 1024 ).toFixed( 0 ) } KB · ${ tris0 } tris · size ${ f3( size0 ).join( ' × ' ) } m · skins ${ doc.getRoot().listSkins().length } · clips ${ doc.getRoot().listAnimations().length }` );
		continue;

	}

	( { mesh, node } = bake( doc, recipe ) );
	console.log( `   baked: ${ mesh.listPrimitives().length } prims, ${ meshTris( mesh ) } tris` );
	applyMaterials( doc, recipe );
	joinPerMaterial( doc, mesh );
	if ( recipe.thin ) for ( const p of mesh.listPrimitives() ) { const r = thinPrimitive( doc, p, recipe.thin, 1 ); weldPrimitive( p ); console.log( `   thin ${ p.getMaterial()?.getName() || '' }: kept ${ r.kept } of ${ r.components } components → ${ triCount( p ) } tris` ); }
	if ( recipe.simplify !== undefined || recipe.simplifyByMaterial ) simplifyMesh( mesh, recipe.simplifyByMaterial, recipe.simplify, recipe.lockBorder );
	// pivot / rotation / scale
	let b = getBounds( node );
	const pivot = recipe.pivot === 'center' ? [ ( b.min[ 0 ] + b.max[ 0 ] ) / 2, ( b.min[ 1 ] + b.max[ 1 ] ) / 2, ( b.min[ 2 ] + b.max[ 2 ] ) / 2 ]
		: recipe.pivot === 'origin' ? [ 0, 0, 0 ]
		: Array.isArray( recipe.pivot ) ? recipe.pivot
		: [ ( b.min[ 0 ] + b.max[ 0 ] ) / 2, b.min[ 1 ], ( b.min[ 2 ] + b.max[ 2 ] ) / 2 ]; // 'base'
	const T = mat4.create();
	mat4.scale( T, T, [ recipe.scale ?? 1, recipe.scale ?? 1, recipe.scale ?? 1 ] );
	if ( recipe.rotateY ) mat4.rotateY( T, T, recipe.rotateY );
	if ( recipe.rotateX ) mat4.rotateX( T, T, recipe.rotateX );
	if ( recipe.rotateZ ) mat4.rotateZ( T, T, recipe.rotateZ );
	mat4.translate( T, T, [ - pivot[ 0 ], - pivot[ 1 ], - pivot[ 2 ] ] );
	if ( recipe.translate ) { const U = mat4.create(); mat4.translate( U, U, recipe.translate ); mat4.multiply( T, U, T ); }
	for ( const p of mesh.listPrimitives() ) transformPrimitive( p, T );
	// levels of detail
	const lodStats = [ { node: 'LOD0', tris: meshTris( mesh ) } ];
	const scene = doc.getRoot().listScenes()[ 0 ];
	( recipe.lods || [] ).forEach( ( L, i ) => {

		const m2 = doc.createMesh( 'LOD' + ( i + 1 ) );
		for ( const p of mesh.listPrimitives() ) {

			const c = p.clone();
			const mname = p.getMaterial()?.getName() || '';
			if ( L.thin && ( ! L.thinMaterials || L.thinMaterials.test( mname ) ) ) { thinPrimitive( doc, c, L.thin, 7 + i ); weldPrimitive( c ); }
			if ( ! ( L.skip && L.skip.test( mname ) ) && L.ratio < 1 ) simplifyPrimitive( c, { simplifier: MeshoptSimplifier, ratio: L.ratio, error: L.error ?? 0.02, lockBorder: !! L.lockBorder } );
			m2.addPrimitive( c );

		}

		scene.addChild( doc.createNode( 'LOD' + ( i + 1 ) ).setMesh( m2 ) );
		lodStats.push( { node: 'LOD' + ( i + 1 ), tris: meshTris( m2 ) } );

	} );
	const textures = await compressTextures( doc, recipe );
	await doc.transform( prune(), dedup() );
	b = getBounds( node );
	const size = [ 0, 1, 2 ].map( ( i ) => b.max[ i ] - b.min[ i ] );
	const lic = A.license && A.license.class ? A.license : ( PA.license || {} );
	const provenance = {
		labId: recipe.src, title: ( recipe.provenance && recipe.provenance.title ) || A.title || recipe.src, creator: ( recipe.provenance && recipe.provenance.creator ) || field( 'creator' ), site: ( recipe.provenance && recipe.provenance.site ) || field( 'site' ), url: ( recipe.provenance && recipe.provenance.url ) || field( 'product_url' ),
		license: lic.class || null, licenseLabel: lic.label || null, attributionDraft: lic.attribution_draft || null,
		labSource: `/home/o/model-lab/derived/glb/${ recipe.src }.glb`, labSha256: sha256( srcBuf ), labBytes: srcBuf.byteLength,
	};
	doc.getRoot().getAsset().generator = 'BodyArcade asset pass — glTF-Transform ' + ( doc.getRoot().getAsset().generator || '' );
	doc.getRoot().getAsset().extras = { bodyarcade: { id: recipe.id, ...provenance, lods: lodStats.map( ( l ) => l.tris ) } };
	const outPath = join( out, recipe.id + '.glb' );
	const bin = await io.writeBinary( doc );
	writeFileSync( outPath, bin );
	const entry = {
		id: recipe.id, file: recipe.id + '.glb', bytes: bin.byteLength, sha256: sha256( bin ),
		provenance, recipe: { pivot: recipe.pivot || 'base', scale: recipe.scale ?? 1, rotateY: recipe.rotateY || 0, dropNodes: recipe.dropNodes ? String( recipe.dropNodes ) : null, dropMaterials: recipe.dropMaterials ? String( recipe.dropMaterials ) : null, keepNodes: recipe.keepNodes ? String( recipe.keepNodes ) : null, simplify: recipe.simplify ?? null, simplifyByMaterial: recipe.simplifyByMaterial || null, lods: recipe.lods || [], note: recipe.note || null },
		bounds: { min: f3( b.min ), max: f3( b.max ), size: f3( size ) }, lods: lodStats, materials: doc.getRoot().listMaterials().map( ( m ) => ( { name: m.getName(), alphaMode: m.getAlphaMode(), doubleSided: m.getDoubleSided(), baseColor: f3( m.getBaseColorFactor() ), textures: { base: !! m.getBaseColorTexture(), normal: !! m.getNormalTexture(), mr: !! m.getMetallicRoughnessTexture() } } ) ), textures,
	};
	manifest.assets[ recipe.id ] = entry;
	console.log( `   → ${ recipe.id }.glb ${ ( bin.byteLength / 1024 ).toFixed( 0 ) } KB · lods ${ lodStats.map( ( l ) => l.tris ).join( ' / ' ) } tris · size ${ f3( size ).join( ' × ' ) } m · min y ${ b.min[ 1 ].toFixed( 3 ) }` );
	for ( const t of textures ) console.log( `   tex ${ t.slot.padEnd( 17 ) } ${ t.from } → ${ t.to }${ t.alpha ? ' (alpha)' : '' }` );

}

manifest.generated = new Date().toISOString();
manifest.tool = 'apps/tidewater-dolphin/tools/assets/convert.mjs';
writeFileSync( manifestPath, JSON.stringify( manifest, null, '\t' ) + '\n' );
console.log( `\nmanifest → ${ manifestPath } (${ Object.keys( manifest.assets ).length } assets)` );
