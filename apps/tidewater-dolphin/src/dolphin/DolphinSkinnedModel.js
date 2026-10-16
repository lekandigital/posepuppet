// DolphinSkinnedModel — Tidewater's engine SkinnedModel (vendor/tidewater/src/engine/render/
// Skinning.js, unmodified) extended with ADDITIVE animation layers.
//
// Why: the approved BodyArcade dolphin controller (dolphinActor.ts, Master §7.6) layers the
// GAMICO SwimLeft / SwimRight / SwimUp / SwimDown clips additively over the base swim cycle
// (bank sign-selects the turn cycle, pitch rate the pitch cycle, weights 0..1). Tidewater's
// SkinnedModel blends layers by weighted average only (crossfades), so without this the bank
// and pitch animation would be lost. Nothing in the vendored engine is changed; this subclass
// re-implements `_pose()` (the base version plus one additive step) and adds `addAdditive()`.
//
// The additive arithmetic reproduces three.js (r184) exactly, so the dolphin reads as it did
// in the approved app:
//   AnimationUtils.makeClipAdditive( clip ) with referenceFrame 0 of the clip itself:
//     rotation delta_k    = q_k ⊗ conj( normalize( q_0 ) )          (multiplyQuaternionsFlat)
//     translation / scale = v_k − v_0
//   PropertyMixer with AdditiveAnimationBlendMode, per node property:
//     add := identity; for each additive action (play order) with weight w:
//       rotation:  add = slerp( add, add ⊗ delta, w )               (_slerpAdditive)
//       vector:    add = add + delta · w                           (_lerpAdditive)
//     result = base ⊗ add (rotation) / base + add (translation, scale)
// Additive clips loop at speed 1 and keep advancing while their weight is 0 (as a playing
// three.js AnimationAction with effective weight 0 does).
//
// Base-layer semantics are the vendored ones: Tidewater blends base layers with a weighted
// nlerp (hemisphere-aligned) where three.js slerps sequentially — identical endpoints, a
// sub-degree difference in angular rate during the 0.15–0.3 s crossfades (recorded in the
// CP10 report as the one known animation-math difference).

import { SkinnedModel } from '../../vendor/tidewater/src/engine/render/Skinning.js';

// ---- flat-array helpers (copies of the module-private helpers in Skinning.js; column-major 4x4)

function composeTRS( out, o, t, r, s ) {

	const x = r[ 0 ], y = r[ 1 ], z = r[ 2 ], w = r[ 3 ];
	const x2 = x + x, y2 = y + y, z2 = z + z;
	const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
	const sx = s[ 0 ], sy = s[ 1 ], sz = s[ 2 ];
	out[ o ] = ( 1 - ( yy + zz ) ) * sx; out[ o + 1 ] = ( xy + wz ) * sx; out[ o + 2 ] = ( xz - wy ) * sx; out[ o + 3 ] = 0;
	out[ o + 4 ] = ( xy - wz ) * sy; out[ o + 5 ] = ( 1 - ( xx + zz ) ) * sy; out[ o + 6 ] = ( yz + wx ) * sy; out[ o + 7 ] = 0;
	out[ o + 8 ] = ( xz + wy ) * sz; out[ o + 9 ] = ( yz - wx ) * sz; out[ o + 10 ] = ( 1 - ( xx + yy ) ) * sz; out[ o + 11 ] = 0;
	out[ o + 12 ] = t[ 0 ]; out[ o + 13 ] = t[ 1 ]; out[ o + 14 ] = t[ 2 ]; out[ o + 15 ] = 1;

}

function mul4( out, o, a, ao, b, bo ) {

	for ( let c = 0; c < 4; c ++ ) {

		const b0 = b[ bo + c * 4 ], b1 = b[ bo + c * 4 + 1 ], b2 = b[ bo + c * 4 + 2 ], b3 = b[ bo + c * 4 + 3 ];
		for ( let r = 0; r < 4; r ++ ) out[ o + c * 4 + r ] = a[ ao + r ] * b0 + a[ ao + 4 + r ] * b1 + a[ ao + 8 + r ] * b2 + a[ ao + 12 + r ] * b3;

	}

}

function sampleChannel( ch, t, out ) {

	const T = ch.times, V = ch.values, w = ch.path === 'rotation' ? 4 : 3, n = T.length;
	if ( n === 1 || t <= T[ 0 ] ) {

		for ( let c = 0; c < w; c ++ ) out[ c ] = V[ c ];
		return;

	}

	if ( t >= T[ n - 1 ] ) {

		for ( let c = 0; c < w; c ++ ) out[ c ] = V[ ( n - 1 ) * w + c ];
		return;

	}

	let k = ch._k || 0;
	if ( T[ k ] > t ) k = 0;
	while ( k < n - 2 && T[ k + 1 ] <= t ) k ++;
	ch._k = k;
	const f = ch.step ? 0 : ( t - T[ k ] ) / ( T[ k + 1 ] - T[ k ] );
	const a = k * w, b = ( k + 1 ) * w;
	if ( w === 4 ) {

		const d = V[ a ] * V[ b ] + V[ a + 1 ] * V[ b + 1 ] + V[ a + 2 ] * V[ b + 2 ] + V[ a + 3 ] * V[ b + 3 ];
		const sb = d < 0 ? - f : f;
		let x = V[ a ] * ( 1 - f ) + V[ b ] * sb, y = V[ a + 1 ] * ( 1 - f ) + V[ b + 1 ] * sb, z = V[ a + 2 ] * ( 1 - f ) + V[ b + 2 ] * sb, q = V[ a + 3 ] * ( 1 - f ) + V[ b + 3 ] * sb;
		const l = 1 / Math.hypot( x, y, z, q );
		out[ 0 ] = x * l; out[ 1 ] = y * l; out[ 2 ] = z * l; out[ 3 ] = q * l;

	} else for ( let c = 0; c < 3; c ++ ) out[ c ] = V[ a + c ] + ( V[ b + c ] - V[ a + c ] ) * f;

}

// ---- three.js quaternion helpers (Quaternion.multiplyQuaternionsFlat / slerpFlat, r184)

function quatMulFlat( dst, dstOffset, src0, srcOffset0, src1, srcOffset1 ) {

	const x0 = src0[ srcOffset0 ], y0 = src0[ srcOffset0 + 1 ], z0 = src0[ srcOffset0 + 2 ], w0 = src0[ srcOffset0 + 3 ];
	const x1 = src1[ srcOffset1 ], y1 = src1[ srcOffset1 + 1 ], z1 = src1[ srcOffset1 + 2 ], w1 = src1[ srcOffset1 + 3 ];
	dst[ dstOffset ] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
	dst[ dstOffset + 1 ] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
	dst[ dstOffset + 2 ] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
	dst[ dstOffset + 3 ] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;

}

function quatSlerpFlat( dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t ) {

	let x0 = src0[ srcOffset0 ], y0 = src0[ srcOffset0 + 1 ], z0 = src0[ srcOffset0 + 2 ], w0 = src0[ srcOffset0 + 3 ];
	const x1 = src1[ srcOffset1 ], y1 = src1[ srcOffset1 + 1 ], z1 = src1[ srcOffset1 + 2 ], w1 = src1[ srcOffset1 + 3 ];
	if ( t === 0 ) { dst[ dstOffset ] = x0; dst[ dstOffset + 1 ] = y0; dst[ dstOffset + 2 ] = z0; dst[ dstOffset + 3 ] = w0; return; }
	if ( t === 1 ) { dst[ dstOffset ] = x1; dst[ dstOffset + 1 ] = y1; dst[ dstOffset + 2 ] = z1; dst[ dstOffset + 3 ] = w1; return; }
	if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

		let s = 1 - t;
		const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1, dir = cos >= 0 ? 1 : - 1, sqrSin = 1 - cos * cos;
		if ( sqrSin > Number.EPSILON ) {

			const sin = Math.sqrt( sqrSin ), len = Math.atan2( sin, cos * dir );
			s = Math.sin( s * len ) / sin;
			t = Math.sin( t * len ) / sin;

		}

		const tDir = t * dir;
		x0 = x0 * s + x1 * tDir; y0 = y0 * s + y1 * tDir; z0 = z0 * s + z1 * tDir; w0 = w0 * s + w1 * tDir;
		if ( s === 1 - t ) {

			const f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );
			x0 *= f; y0 *= f; z0 *= f; w0 *= f;

		}

	}

	dst[ dstOffset ] = x0; dst[ dstOffset + 1 ] = y0; dst[ dstOffset + 2 ] = z0; dst[ dstOffset + 3 ] = w0;

}

export class DolphinSkinnedModel extends SkinnedModel {

	// SkinnedModel.create() constructs the base class by name; this is the same two-step build.
	static async create( gltf, { materials = null } = {} ) {

		const m = new DolphinSkinnedModel( gltf );
		await m._buildMeshes( materials );
		return m;

	}

	constructor( gltf ) {

		super( gltf );
		this.additive = []; // { name, clip: { duration, channels (delta tracks) }, time, weight, speed }
		this._addAcc = new Float32Array( 4 );
		this._addTmp = new Float32Array( 4 );
		this._addWork = new Float32Array( 4 );

	}

	// Additive layer from a clip (three.js makeClipAdditive, reference = the clip's own frame 0).
	// Starts at weight 0 and time 0, loops at speed 1; set `layer.weight` per frame.
	addAdditive( name ) {

		const clip = this.clips.get( name );
		if ( ! clip ) throw new Error( 'DolphinSkinnedModel: no clip ' + name );
		const ref = new Float32Array( 4 );
		const channels = clip.channels.map( ( ch ) => {

			const w = ch.path === 'rotation' ? 4 : 3;
			const values = new Float32Array( ch.values.length );
			if ( w === 4 ) {

				// conjugate of the normalised first keyframe
				const l = 1 / Math.hypot( ch.values[ 0 ], ch.values[ 1 ], ch.values[ 2 ], ch.values[ 3 ] );
				ref[ 0 ] = - ch.values[ 0 ] * l; ref[ 1 ] = - ch.values[ 1 ] * l; ref[ 2 ] = - ch.values[ 2 ] * l; ref[ 3 ] = ch.values[ 3 ] * l;
				for ( let k = 0; k < ch.times.length; k ++ ) quatMulFlat( values, k * 4, ch.values, k * 4, ref, 0 );

			} else {

				for ( let k = 0; k < ch.times.length; k ++ ) for ( let c = 0; c < 3; c ++ ) values[ k * 3 + c ] = ch.values[ k * 3 + c ] - ch.values[ c ];

			}

			return { node: ch.node, path: ch.path, times: ch.times, values, step: ch.step };

		} );
		const layer = { name, clip: { name, duration: clip.duration, channels }, time: 0, weight: 0, speed: 1 };
		this.additive.push( layer );
		return layer;

	}

	update( dt ) {

		for ( const l of this.additive ) {

			l.time += dt * l.speed;
			const d = l.clip.duration;
			if ( d > 0 && l.time >= d ) l.time %= d;

		}

		super.update( dt );

	}

	// Base SkinnedModel._pose() (vendored, verbatim) with the additive step inserted between the
	// local-pose blend and the world-matrix composition.
	_pose() {

		const N = this.nodeCount, acc = this._acc, tmp = this._tmp;
		for ( let i = 0; i < N; i ++ ) {

			const a = acc[ i ];
			a.wt = a.wr = a.ws = 0;
			a.t.fill( 0 ); a.r.fill( 0 ); a.s.fill( 0 );

		}

		for ( const l of this.layers ) {

			if ( l.weight <= 0 ) continue;
			for ( const ch of l.clip.channels ) {

				const a = acc[ ch.node ];
				sampleChannel( ch, l.time, tmp );
				if ( ch.path === 'rotation' ) {

					const d = a.r[ 0 ] * tmp[ 0 ] + a.r[ 1 ] * tmp[ 1 ] + a.r[ 2 ] * tmp[ 2 ] + a.r[ 3 ] * tmp[ 3 ];
					const w = d < 0 ? - l.weight : l.weight;
					for ( let c = 0; c < 4; c ++ ) a.r[ c ] += tmp[ c ] * w;
					a.wr += l.weight;

				} else if ( ch.path === 'translation' ) {

					for ( let c = 0; c < 3; c ++ ) a.t[ c ] += tmp[ c ] * l.weight;
					a.wt += l.weight;

				} else {

					for ( let c = 0; c < 3; c ++ ) a.s[ c ] += tmp[ c ] * l.weight;
					a.ws += l.weight;

				}

			}

		}

		for ( let i = 0; i < N; i ++ ) {

			const a = acc[ i ], L = this.local[ i ], R = this.rest[ i ];
			for ( let c = 0; c < 3; c ++ ) {

				L.t[ c ] = a.t[ c ] + R.t[ c ] * ( 1 - Math.min( a.wt, 1 ) );
				L.s[ c ] = a.s[ c ] + R.s[ c ] * ( 1 - Math.min( a.ws, 1 ) );

			}

			if ( a.wr > 0 ) {

				const rw = 1 - Math.min( a.wr, 1 );
				const d = a.r[ 0 ] * R.r[ 0 ] + a.r[ 1 ] * R.r[ 1 ] + a.r[ 2 ] * R.r[ 2 ] + a.r[ 3 ] * R.r[ 3 ];
				const sr = d < 0 ? - rw : rw;
				let x = a.r[ 0 ] + R.r[ 0 ] * sr, y = a.r[ 1 ] + R.r[ 1 ] * sr, z = a.r[ 2 ] + R.r[ 2 ] * sr, w = a.r[ 3 ] + R.r[ 3 ] * sr;
				const l = 1 / Math.hypot( x, y, z, w );
				L.r[ 0 ] = x * l; L.r[ 1 ] = y * l; L.r[ 2 ] = z * l; L.r[ 3 ] = w * l;

			} else L.r.set( R.r );

		}

		// ---- additive layers (three.js AdditiveAnimationBlendMode), per node property
		const add = this.additive;
		if ( add && add.length ) {

			const A = this._addAcc, T = this._addTmp, W = this._addWork;
			for ( let i = 0; i < N; i ++ ) {

				const L = this.local[ i ];
				for ( const path of [ 'rotation', 'translation', 'scale' ] ) {

					let any = false;
					for ( const l of add ) {

						if ( l.weight <= 0 ) continue;
						const ch = l.clip.channels.find( ( c ) => c.node === i && c.path === path );
						if ( ! ch ) continue;
						if ( ! any ) {

							any = true;
							if ( path === 'rotation' ) { A[ 0 ] = 0; A[ 1 ] = 0; A[ 2 ] = 0; A[ 3 ] = 1; } else { A[ 0 ] = 0; A[ 1 ] = 0; A[ 2 ] = 0; }

						}

						sampleChannel( ch, l.time, T );
						if ( path === 'rotation' ) {

							quatMulFlat( W, 0, A, 0, T, 0 ); // work = add ⊗ delta
							quatSlerpFlat( A, 0, A, 0, W, 0, l.weight ); // add = slerp( add, work, w )

						} else for ( let c = 0; c < 3; c ++ ) A[ c ] += T[ c ] * l.weight;

					}

					if ( ! any ) continue;
					if ( path === 'rotation' ) quatMulFlat( L.r, 0, L.r, 0, A, 0 ); // base ⊗ add
					else if ( path === 'translation' ) for ( let c = 0; c < 3; c ++ ) L.t[ c ] += A[ c ];
					else for ( let c = 0; c < 3; c ++ ) L.s[ c ] += A[ c ];

				}

			}

		}

		const Wm = this.world, M = this._localM;
		for ( const i of this.order ) {

			const L = this.local[ i ];
			composeTRS( M, 0, L.t, L.r, L.s );
			const p = this.parent[ i ];
			if ( p < 0 ) Wm.set( M, i * 16 );
			else mul4( Wm, i * 16, Wm, p * 16, M, 0 );

		}

		const J = this.joints, D = this.jointData, ibm = this.skin.inverseBindMatrices;
		if ( ! this._first ) D.copyWithin( J * 16, 0, J * 16 );
		for ( let j = 0; j < J; j ++ ) mul4( D, j * 16, Wm, this.skin.joints[ j ] * 16, ibm, j * 16 );
		if ( this._first ) {

			D.copyWithin( J * 16, 0, J * 16 );
			this._first = false;

		}

		this.jointBuffer.write( D );

	}

	// CPU-skinned world-space AABB of the first primitive (this frame's joints × the group's
	// world matrix) — the Checkpoint-01 runtime body-length measurement and the cp02 coverage
	// probe (three.js SkinnedMesh.computeBoundingBox equivalent). Returns { min, max } arrays.
	skinnedBounds( groupMatrixWorld ) {

		const prim = this.gltf.meshes[ this.gltf.nodes.find( ( n ) => n.mesh !== undefined && n.skin !== undefined ).mesh ][ 0 ];
		const P = prim.attributes.POSITION.array, JI = prim.attributes.JOINTS_0.array, JW = prim.attributes.WEIGHTS_0.array;
		const D = this.jointData, J = this.joints;
		const M = groupMatrixWorld ? groupMatrixWorld.elements : null;
		const min = [ Infinity, Infinity, Infinity ], max = [ - Infinity, - Infinity, - Infinity ];
		const S = new Float32Array( 16 );
		for ( let v = 0; v < P.length / 3; v ++ ) {

			S.fill( 0 );
			for ( let k = 0; k < 4; k ++ ) {

				const w = JW[ v * 4 + k ];
				if ( w === 0 ) continue;
				const o = Math.min( JI[ v * 4 + k ], J - 1 ) * 16;
				for ( let e = 0; e < 16; e ++ ) S[ e ] += D[ o + e ] * w;

			}

			const x = P[ v * 3 ], y = P[ v * 3 + 1 ], z = P[ v * 3 + 2 ];
			let px = S[ 0 ] * x + S[ 4 ] * y + S[ 8 ] * z + S[ 12 ];
			let py = S[ 1 ] * x + S[ 5 ] * y + S[ 9 ] * z + S[ 13 ];
			let pz = S[ 2 ] * x + S[ 6 ] * y + S[ 10 ] * z + S[ 14 ];
			if ( M ) {

				const wx = M[ 0 ] * px + M[ 4 ] * py + M[ 8 ] * pz + M[ 12 ];
				const wy = M[ 1 ] * px + M[ 5 ] * py + M[ 9 ] * pz + M[ 13 ];
				const wz = M[ 2 ] * px + M[ 6 ] * py + M[ 10 ] * pz + M[ 14 ];
				px = wx; py = wy; pz = wz;

			}

			if ( px < min[ 0 ] ) min[ 0 ] = px; if ( px > max[ 0 ] ) max[ 0 ] = px;
			if ( py < min[ 1 ] ) min[ 1 ] = py; if ( py > max[ 1 ] ) max[ 1 ] = py;
			if ( pz < min[ 2 ] ) min[ 2 ] = pz; if ( pz > max[ 2 ] ) max[ 2 ] = pz;

		}

		return { min, max };

	}

}
