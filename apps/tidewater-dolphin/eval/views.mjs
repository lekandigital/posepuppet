// Reference camera poses for the CP10 visual-parity captures.
//
// STANDARD views are Tidewater's own review cameras (vendor/tidewater/src/core/DebugViews.js,
// unchanged). CUSTOM views are added at capture time to the same VIEWS table in BOTH apps
// (pristine and integrated) so poses, time of day and lens are identical. Tidewater convention:
// yaw 0 looks toward -Z (north, the island), yaw π toward +Z (south, open sea); pitch > 0 looks up.
// Positions in metres, y up, sea level 0.

export const STANDARD_VIEWS = [
	'beach', 'surf', 'surfSide', 'swash', 'swashAbove', 'swashFilm',
	'sunGlitter', 'deepBlue', 'aerial', 'shallowSeabed', 'underwater', 'waterline',
	'sunset', 'sunsetWest', 'pier', 'village', 'pierShallows', 'palms', 'tCove', 'tMorning', 'sunFlare',
];

export const CUSTOM_VIEWS = {
	// the island from offshore, at sea level (reference item 1)
	bayOffshore: { p: [ 10, 2.0, 140 ], yaw: 0, pitch: 0.02, time: 16.2 },
	// deeper water south of the reef looking at the reef slope (item 4: visibility / attenuation)
	deepWater: { p: [ - 40, - 10, 120 ], yaw: 0.55, pitch: 0.10, time: 13.0 },
	// inside the reef, coral detail (items 3 / 11)
	reefCoral: { p: [ - 82, - 3.2, 62 ], yaw: 2.2, pitch: 0.05, time: 13.0 },
	// shallow sand bottom (3 m of water) at noon, looking down the slope: caustics (item 10)
	causticsSun: { p: [ 10, - 1.5, 22 ], yaw: 0.3, pitch: - 0.5, time: 13.0 },
	// underwater, aimed just off the sun through the surface: sun shafts + waterline from below (item 10)
	sunShafts: { p: [ - 60, - 6, 90 ], yaw: 0, pitch: 0, time: 15.5, lookSun: [ 0.25, - 0.15 ] },
	// half-submerged lens in the bay swell, a second waterline sample away from the beach (item 5)
	waterlineBay: { p: [ - 20, 0.0, 40 ], yaw: 0.4, pitch: 0.0, time: 14.0 },
	// the waterline view just after surfacing: Tidewater's lens droplets (same seed in both apps)
	waterlineDrops: { p: [ 5, 0.02, - 10 ], yaw: Math.PI, pitch: 0.0, time: 14.0 },
	// the dolphin spawn area (the integrated app's first frame), seen from behind the spawn heading
	spawnArea: { p: [ 2, - 1.4, 70 ], yaw: 0.0, pitch: 0.05, time: 16.2 },
	// CP10 continuation — the scenery-additions sites (identical in the pristine / additions-off
	// captures, where the sand is bare): the sunken driftwood group east of the pier head and the
	// shell drift on the shallow sand off the beach
	addWoodEast: { p: [ 70, - 2.4, 52 ], yaw: Math.atan2( - 10, - 12 ), pitch: - 0.15, time: 13.0 },
	addShellsBeach: { p: [ 9, - 1.9, 16 ], yaw: Math.atan2( - 5, - 8 ), pitch: - 0.16, time: 13.0 },
};

export const ALL_VIEWS = [ ...STANDARD_VIEWS, ...Object.keys( CUSTOM_VIEWS ) ];

// moving-water sequence views (the clock runs; one image every `every` frames)
export const SEQUENCE_VIEWS = [ 'surf', 'waterline', 'swash', 'underwater' ];
