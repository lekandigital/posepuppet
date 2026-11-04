// SiteFish — a reef-fish community at an added site (the wreck, the drowned temple), made of
// Tidewater's OWN procedural fish (world/Fish.js: species, behaviours, batch, material), so the
// imported landmarks are populated by the same animals that live on Tidewater's reef.
//
// FishSchools lays out the whole reef (plus the drop-off, the bay and the pier) in layout(),
// called by its constructor. This subclass replaces layout() with the site's authored community:
// the placement, the behaviours, the simulation and the rendering are the vendor's, untouched.
// The site description is handed over through a static slot because a derived constructor
// cannot touch `this` before super().

import { FishSchools } from '../../vendor/tidewater/src/world/Fish.js';

export class SiteFish extends FishSchools {

	static pending = null;

	// site: { groups: [ [ species, count, zone: { x, z, r, band?, anchors?, path? }, anchored? ], ... ] }
	constructor( opts ) {

		SiteFish.pending = opts.site;
		super( { ...opts, bay: false } );
		SiteFish.pending = null;

	}

	layout() {

		const site = SiteFish.pending || { groups: [] };
		this.baitGroups = [];
		this.dropPath = null;
		const homes = [];
		for ( const [ name, count, zone, anchored ] of site.groups ) {

			const sp = this.behaviour( name );
			if ( ! sp ) continue;
			const z = { ...zone, band: zone.band || sp.band };
			const spot = this.pickSpot( sp, z, homes, !! anchored );
			if ( ! spot ) continue;
			homes.push( spot );
			const g = this.addGroup( name, count, { ...z, x: spot[ 0 ], z: spot[ 1 ], r: Math.min( z.r, sp.homeRadius * 1.5 + 4 ) } );
			if ( zone.path ) g.zone.path = zone.path;

		}

	}

	// the vendor's behaviour table is module-private: addGroup reads it by name; pickSpot needs
	// the record too, so it is recovered through a throw-away group
	behaviour( name ) {

		if ( ! this._beh ) this._beh = new Map();
		if ( this._beh.has( name ) ) return this._beh.get( name );
		const before = this.groups.length, n0 = this.n;
		let sp = null;
		try {

			const g = this.addGroup( name, 0, { x: 0, z: 0, r: 1 } );
			sp = g.sp;

		} catch ( e ) { sp = null; }

		this.groups.length = before;
		this.n = n0;
		this._beh.set( name, sp );
		return sp;

	}

}
