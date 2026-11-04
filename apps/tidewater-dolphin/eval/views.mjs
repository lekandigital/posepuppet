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
	// asset-integration pass — the imported-model sites (Tidewater convention: yaw 0 looks toward
	// -z; the poses are the dolphin's own eye heights at each site). Same in Original (bare) and
	// Enhanced captures.
	// the spawn meadow from the dolphin's cruising height, looking east over the bed toward the pier head
	addMeadow: { p: [ 34, - 3.8, 84 ], yaw: Math.atan2( - ( 56 - 34 ), - ( 72 - 84 ) ), pitch: - 0.12, time: 13.0 },
	// the east plateau bed with the sunken skiff
	addMeadowEast: { p: [ 92, - 4.5, 134 ], yaw: Math.atan2( - ( 104 - 92 ), - ( 124 - 134 ) ), pitch: - 0.1, time: 13.0 },
	// the kelp wall from the channel floor, looking up-slope through the stalks
	addKelpWall: { p: [ 46, - 11, 116 ], yaw: Math.atan2( - ( 66 - 46 ), - ( 112 - 116 ) ), pitch: 0.12, time: 13.0 },
	// the kelp wall from above, the shelf and the stalks' tips against the surface light
	addKelpTop: { p: [ 70, - 4.5, 100 ], yaw: Math.atan2( - ( 58 - 70 ), - ( 118 - 100 ) ), pitch: - 0.3, time: 15.0 },
	// the wreck from the wall, a dolphin's approach
	addWreck: { p: [ 66, - 8.5, 102 ], yaw: Math.atan2( - ( 56 - 66 ), - ( 114 - 102 ) ), pitch: - 0.15, time: 13.0 },
	// down the colonnade toward the temple
	addColonnade: { p: [ 4.5, - 9.5, 118 ], yaw: Math.atan2( - ( 4.5 - 4.5 ), - ( 150 - 118 ) ), pitch: - 0.08, time: 13.0 },
	// the temple and the ruin from the basin's west rim
	addTemple: { p: [ - 16, - 12, 150 ], yaw: Math.atan2( - ( 8 - ( - 16 ) ), - ( 154 - 150 ) ), pitch: - 0.1, time: 13.0 },
	// the carved head, close
	addStatue: { p: [ - 3, - 15.5, 141 ], yaw: Math.atan2( - ( - 9 - ( - 3 ) ), - ( 147 - 141 ) ), pitch: - 0.12, time: 13.0 },
	// the lighthouse from the bay at the surface, looking east
	addLighthouse: { p: [ 150, 1.6, 120 ], yaw: Math.atan2( - ( 222 - 150 ), - ( 132 - 120 ) ), pitch: 0.06, time: 16.5 },
	// the eastern back-beach scrub from the shallows
	addShoreEast: { p: [ 112, 1.4, 2 ], yaw: Math.atan2( - ( 118 - 112 ), - ( - 30 - 2 ) ), pitch: - 0.02, time: 15.0 },
};

export const ALL_VIEWS = [ ...STANDARD_VIEWS, ...Object.keys( CUSTOM_VIEWS ) ];

// moving-water sequence views (the clock runs; one image every `every` frames)
export const SEQUENCE_VIEWS = [ 'surf', 'waterline', 'swash', 'underwater' ];
