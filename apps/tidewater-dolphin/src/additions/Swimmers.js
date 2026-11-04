// Swimmers — the imported large animals (manatees, a hammerhead) cruising authored loops
// (asset-integration pass over CP10). Each is one engine Mesh per material built from a
// converted GLB (GLBScenery.SceneryModel, mode 'swim'): the body wave is a travelling sine in
// the vertex stage (previous phase for the motion vectors), the path a closed Catmull-Rom loop
// sampled at 0.5 m, followed at a species speed with smoothed heading, pitch and banking, the
// height held above the composite seabed (terrain, reef, solid additions) and below the ceiling.
// Deterministic: the loops and phases are authored, the clock is the simulation time.

import { Group, Mesh, Vector3, Quaternion, Euler } from '../../vendor/tidewater/src/engine/index.js';

const TAU = Math.PI * 2;

function catmull( p0, p1, p2, p3, t ) {

	const t2 = t * t, t3 = t2 * t;
	return 0.5 * ( ( 2 * p1 ) + ( - p0 + p2 ) * t + ( 2 * p0 - 5 * p1 + 4 * p2 - p3 ) * t2 + ( - p0 + 3 * p1 - 3 * p2 + p3 ) * t3 );

}

// closed loop through the waypoints, resampled by arc length
export function loopPath( points, step = 0.5 ) {

	const n = points.length;
	const samples = [];
	for ( let i = 0; i < n; i ++ ) {

		const p0 = points[ ( i - 1 + n ) % n ], p1 = points[ i ], p2 = points[ ( i + 1 ) % n ], p3 = points[ ( i + 2 ) % n ];
		const segLen = Math.hypot( p2[ 0 ] - p1[ 0 ], p2[ 1 ] - p1[ 1 ], p2[ 2 ] - p1[ 2 ] );
		const k = Math.max( 2, Math.ceil( segLen / step ) );
		for ( let j = 0; j < k; j ++ ) {

			const t = j / k;
			samples.push( [ catmull( p0[ 0 ], p1[ 0 ], p2[ 0 ], p3[ 0 ], t ), catmull( p0[ 1 ], p1[ 1 ], p2[ 1 ], p3[ 1 ], t ), catmull( p0[ 2 ], p1[ 2 ], p2[ 2 ], p3[ 2 ], t ) ] );

		}

	}

	const cum = [ 0 ];
	for ( let i = 1; i <= samples.length; i ++ ) {

		const a = samples[ i - 1 ], b = samples[ i % samples.length ];
		cum.push( cum[ i - 1 ] + Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ) );

	}

	return { samples, cum, length: cum[ samples.length ] };

}

export class Swimmer {

	// def: { id, model, path: [ [ x, y, z ], ... ], speed (m/s), phase (0..1 along the loop), clearance,
	//        ceiling, swim: { amp, freq (Hz), k, axis }, bob: { amp, freq } }
	constructor( def, { parent, groundAt } ) {

		this.def = def;
		this.model = def.model;
		this.groundAt = groundAt;
		this.group = new Group();
		this.group.name = 'additions-swimmer-' + def.id;
		parent.add( this.group );
		this.path = loopPath( def.path, 0.5 );
		this.dist = ( def.phase || 0 ) * this.path.length;
		this.speed = def.speed;
		this.pos = new Vector3();
		this.quat = new Quaternion();
		this.yaw = 0; this.pitch = 0; this.roll = 0;
		this.swimPhase = 0;
		this.time = 0;
		this.meshes = [];
		this.ready = false;
		this.visible = true;
		this._v = new Vector3();
		this._tmp = new Vector3();
		this._q = new Quaternion();
		this._e = new Euler();
		this._place( 0 );

	}

	async load() {

		await this.model.load();
		if ( ! this.model.ready ) return;
		for ( const p of this.model.lods[ 0 ].prims ) {

			const mesh = new Mesh( p.geometry, p.material );
			mesh.name = 'additions-swimmer-' + this.def.id;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.frustumCulled = true;
			this.group.add( mesh );
			this.meshes.push( mesh );

		}

		this.ready = true;
		this._apply();

	}

	_sample( d, out ) {

		const { samples, cum, length } = this.path;
		let s = d % length; if ( s < 0 ) s += length;
		// binary search the segment
		let lo = 0, hi = samples.length;
		while ( hi - lo > 1 ) { const mid = ( lo + hi ) >> 1; if ( cum[ mid ] <= s ) lo = mid; else hi = mid; }
		const a = samples[ lo ], b = samples[ ( lo + 1 ) % samples.length ];
		const t = ( s - cum[ lo ] ) / Math.max( 1e-6, cum[ lo + 1 ] - cum[ lo ] );
		return out.set( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t );

	}

	_place( dt ) {

		const def = this.def;
		const p = this._sample( this.dist, this._v );
		const ahead = this._sample( this.dist + 1.5, this._tmp );
		// height: the authored path, bobbing, clamped to the composite ground and the ceiling
		let y = p.y + ( def.bob ? Math.sin( this.time * def.bob.freq * TAU + ( def.phase || 0 ) * TAU ) * def.bob.amp : 0 );
		const g = this.groundAt ? this.groundAt( p.x, p.z ) : - Infinity;
		y = Math.max( y, g + ( def.clearance ?? 1.2 ) );
		y = Math.min( y, def.ceiling ?? - 1.5 );
		const dx = ahead.x - p.x, dz = ahead.z - p.z, dy = ahead.y - p.y;
		const yawT = Math.atan2( dx, dz ); // +z forward
		const pitchT = Math.atan2( dy, Math.hypot( dx, dz ) ) * 0.8;
		if ( dt === 0 ) { this.yaw = yawT; this.pitch = pitchT; this.roll = 0; }
		else {

			let dYaw = yawT - this.yaw; dYaw = Math.atan2( Math.sin( dYaw ), Math.cos( dYaw ) );
			const k = 1 - Math.exp( - dt * 2.5 );
			this.yaw += dYaw * k;
			this.pitch += ( pitchT - this.pitch ) * k;
			const rollT = Math.max( - 0.5, Math.min( 0.5, - dYaw / Math.max( dt, 1e-3 ) * 0.35 ) );
			this.roll += ( rollT - this.roll ) * ( 1 - Math.exp( - dt * 1.5 ) );

		}

		this.pos.set( p.x, y, p.z );

	}

	_apply() {

		this._e.set( - this.pitch, this.yaw, this.roll, 'YXZ' );
		this.group.position.copy( this.pos );
		this.group.quaternion.setFromEuler( this._e );
		this.group.updateMatrixWorld( true );
		for ( const m of this.meshes ) {

			const u = m.material.uniforms;
			u.swimPhase.value = this.swimPhase;
			u.swimDPhase.value = this._dPhase || 0;

		}

	}

	update( dt, cameraPos ) {

		this.time += dt;
		// speed eases along the loop (slow in the turns), the body wave rate follows the speed
		const sp = this.speed * ( 1 + 0.15 * Math.sin( this.time * 0.37 + ( this.def.phase || 0 ) * 7 ) );
		this.dist += sp * dt;
		const sw = this.def.swim;
		const dPhase = TAU * sw.freq * ( 0.75 + 0.25 * sp / this.speed ) * dt;
		this.swimPhase = ( this.swimPhase + dPhase ) % TAU;
		this._dPhase = dPhase;
		this._place( dt );
		if ( cameraPos ) {

			const far = cameraPos.distanceTo( this.pos ) > ( this.def.drawDistance || 140 );
			if ( far !== ! this.visible ) { this.visible = ! far; this.group.visible = this.visible; }

		}

		if ( this.ready && this.visible ) this._apply();

	}

	dispose() {

		this.group.removeFromParent();
		this.meshes = [];

	}

}
