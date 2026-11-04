// Conversion recipes: Ubuntu model-lab GLB (derived/glb/<src>.glb) → runtime asset `id`.
// Units are metres; `scale` is applied to the lab's normalised GLB; `pivot` 'base' = xz centre of
// the footprint at the lowest point (ground contact), 'center' = bounding-box centre (swimmers).
// Licences (lab evidence, CC0 / CC-BY only, no never_commit assets): see manifest.json and
// public/models/additions/CREDITS.md. `provenance` overrides fill in author / source page for
// cards that lack them (values from the lab database: provenance table, OpenGameArt metadata). LOD ratios are meshoptimizer target ratios per level.

const STONE = { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.92, dropTextures: true, doubleSided: false } };

export const RECIPES = [
	// ---------------------------------------------------------------- kelp forest / seagrass
	{
		id: 'kelp_tall', src: 'man-animated-kelp-52aea21d', note: 'tall brown kelp stalk (rigged in the source); rest pose baked, sway in the vertex stage',
		pivot: 'base', scale: 4.6, autoMask: true, alphaCutoff: 0.45,
		materials: { '*': { metallic: 0, roughness: 0.9, doubleSided: true } },
		textures: { baseColor: 1024 },
		lods: [ { thin: 0.55, thinMaterials: /KelpLeaves/, ratio: 0.7, error: 0.03 }, { thin: 0.25, thinMaterials: /KelpLeaves/, ratio: 0.5, error: 0.05 } ],
	},
	{ id: 'seaweed_a', src: 'man-sea-weed-ad496274', keepNodes: /^Seaweed\.002$/, note: 'blade clump A of the three in the source', pivot: 'base', scale: 1, materials: { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.8, doubleSided: true } }, lods: [ { ratio: 0.5, error: 0.03 } ] },
	{ id: 'seaweed_b', src: 'man-sea-weed-ad496274', keepNodes: /^Seaweed$/, note: 'blade clump B', pivot: 'base', scale: 1, materials: { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.8, doubleSided: true } }, lods: [ { ratio: 0.5, error: 0.03 } ] },
	{ id: 'seaweed_c', src: 'man-sea-weed-ad496274', keepNodes: /^Seaweed\.001$/, note: 'blade clump C (wide)', pivot: 'base', scale: 1, materials: { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.8, doubleSided: true } }, lods: [ { ratio: 0.5, error: 0.03 } ] },
	{
		id: 'kelp_bush', src: 'man-kelp-cb222ee3', note: 'dense kelp thicket, 365k → ~10k tris (meshoptimizer), colour at runtime',
		pivot: 'base', scale: 2.4, thin: 0.2, simplify: { ratio: 0.2, error: 0.4 },
		materials: { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.85, doubleSided: true } },
		lods: [ { thin: 0.5, ratio: 0.5, error: 0.5 } ],
	},
	// ---------------------------------------------------------------- the wreck
	{
		id: 'wreck_boat', src: 'man-fantasy-fishing-boat-e318dbb5', note: 'fishing boat as a wreck: sail and oars removed, ropes / wood decimated, 2K → 1K textures',
		dropNodes: /^(Oar_L|Oar_R)$/, dropMaterials: /^SmallSail$/,
		pivot: 'base', scale: 1,
		simplifyByMaterial: { Rope: { ratio: 0.25, error: 0.03 }, Wood: { ratio: 0.5, error: 0.01 }, Bolt: { ratio: 0.3, error: 0.03 }, Wood_Color: { ratio: 0.6, error: 0.01 } },
		materials: { Bolt: { dropTextures: true, baseColor: [ 0.22, 0.21, 0.2, 1 ], metallic: 0.4, roughness: 0.6 }, '*': { doubleSided: false, metallic: 0 } },
		textures: { baseColor: 1024, normal: 1024, metallicRoughness: 512 },
		lods: [ { ratio: 0.3, error: 0.03 } ],
	},
	{ id: 'skiff', src: 'oga-medieval-boat-2ee13865', note: 'weathered rowing skiff (sunken), ×0.6 → 4.8 m', pivot: 'base', scale: 0.6, materials: { '*': { metallic: 0, roughness: 0.85, doubleSided: true } }, textures: { baseColor: 1024 }, lods: [] },
	// ---------------------------------------------------------------- the drowned temple
	{ id: 'temple', src: 'oga-medieval-stone-temple-321df6dc', note: 'octagonal stone temple, ×1.8 → 10.8 m wide, 7.9 m tall', pivot: 'base', scale: 1.8, materials: { '*': { metallic: 0, roughness: 0.92, doubleSided: true } }, textures: { baseColor: 512 }, lods: [ { ratio: 0.4, error: 0.02 } ] },
	{ id: 'column', src: 'oga-ancient-column-5d793e27', note: 'ancient column, ×0.4 → 6 m', pivot: 'base', scale: 0.4, materials: { '*': { metallic: 0, roughness: 0.88 } }, textures: { baseColor: 1024 }, lods: [ { ratio: 0.5, error: 0.02 } ] },
	{ id: 'slab', src: 'oga-broken-stone-slab-bc221e53', note: 'carved broken slab on a plinth, ×2 → 2.1 m', pivot: 'base', scale: 2.0, materials: { '*': { metallic: 0 } }, textures: { baseColor: 512, normal: 512, metallicRoughness: 256 }, lods: [] },
	{ id: 'statue_head', src: 'oga-figure-head-human-statute-9870bacd', note: 'carved stone head, ×0.7 → 3.7 m; procedural stone at runtime', pivot: 'base', scale: 0.7, simplify: { ratio: 0.5, error: 0.01 }, materials: STONE, lods: [ { ratio: 0.3, error: 0.03 } ] },
	{ id: 'ruin_wall', provenance: { creator: 'Ron Kapaun', url: 'https://opengameart.org/content/3td-fantasy-ruins-pack', site: 'opengameart.org', title: '3TD Fantasy Ruins Pack — CathedralRuins_01' }, src: 'oga-3td-fantasy-ruins-pack-56d92afe--k-cathedralruins-01', note: 'ruined cathedral walls (kit piece 01), ×0.6', pivot: 'base', scale: 0.6, materials: { '*': { metallic: 0, roughness: 0.92, doubleSided: true } }, textures: { baseColor: 512 }, lods: [ { ratio: 0.4, error: 0.02 } ] },
	// ---------------------------------------------------------------- rocks (procedural stone surface at runtime)
	{ id: 'rock_tall', src: 'oga-free-photogrammetric-rock-c12a348c', note: 'photogrammetric boulder, 32k → ~6k tris', pivot: 'base', scale: 1, simplify: { ratio: 0.2, error: 0.01 }, materials: STONE, lods: [ { ratio: 0.25, error: 0.03 } ] },
	{ id: 'rock_slab', src: 'oga-free-photogrammetric-rock-2-9431b7f6', note: 'photogrammetric slab, 64k → ~7k tris', pivot: 'base', scale: 1, simplify: { ratio: 0.11, error: 0.01 }, materials: STONE, lods: [ { ratio: 0.25, error: 0.03 } ] },
	{ id: 'rock_cluster', src: 'oga-free-photogrammetric-rock-cluster-eeb0ab52', note: 'photogrammetric boulder cluster, 64k → ~9k tris', pivot: 'base', scale: 1, simplify: { ratio: 0.14, error: 0.01 }, materials: STONE, lods: [ { ratio: 0.25, error: 0.03 } ] },
	{ id: 'rock_lump', src: 'oga-rock-c65ffa52', note: 'scanned lumpy boulder 2.2 m', pivot: 'base', scale: 1, simplify: { ratio: 0.6, error: 0.01 }, materials: STONE, lods: [ { ratio: 0.3, error: 0.03 } ] },
	{ id: 'rock_mossy', src: 'oga-mossy-rock-beb5f6b8', note: 'textured mossy (algae) rock, ×2.2', pivot: 'base', scale: 2.2, materials: { '*': { alphaMode: 'OPAQUE', metallic: 0, doubleSided: false } }, textures: { baseColor: 512, normal: 512, metallicRoughness: 256 }, lods: [ { ratio: 0.3, error: 0.03 } ] },
	{ id: 'boulder_layered', provenance: { creator: 'Ron Kapaun', url: 'https://opengameart.org/content/3td-cave-pack-pro-v10', site: 'opengameart.org', title: '3TD Cave Pack Pro v1.0 — Boulder_01' }, src: 'oga-3td-cave-pack-pro-v1-0-8eb0a359--k-boulder-01', note: 'textured layered boulder (cave pack piece 01), 6 m', pivot: 'base', scale: 1, materials: { '*': { metallic: 0, roughness: 0.9, doubleSided: false } }, textures: { baseColor: 512, normal: 512 }, lods: [ { ratio: 0.4, error: 0.02 } ] },
	// ---------------------------------------------------------------- wildlife (procedural swimming at runtime)
	{ id: 'manatee', src: 'oga-low-poly-manatee-with-hand-painted-textu-27532f2c', note: 'hand-painted manatee, 3.5 m, head +Z', pivot: 'center', scale: 1, materials: { '*': { metallic: 0, roughness: 0.7, doubleSided: false } }, textures: { baseColor: 256 }, lods: [] },
	{ id: 'hammerhead', src: 'oga-shark-low-poly-a188b214', note: 'hammerhead shark, rest pose baked from the 5-joint rig (7.6 m in the rest pose) ×0.474 → 3.6 m, head +Z; procedural skin at runtime', pivot: 'center', scale: 0.474, materials: { '*': { baseColor: [ 1, 1, 1, 1 ], metallic: 0, roughness: 0.55, dropTextures: true } }, lods: [] },
	// ---------------------------------------------------------------- coast
	{ id: 'lighthouse', src: 'oga-3td-harbour-pack-57336c05', note: 'stone lighthouse with keeper\'s house, ×0.8 → 19.5 m', pivot: 'base', scale: 0.8, materials: { SR_Door: { alphaMode: 'MASK', alphaCutoff: 0.5 }, SR_Glass: { baseColor: [ 0.55, 0.62, 0.68, 1 ], roughness: 0.3 }, '*': { metallic: 0, roughness: 0.9 } }, textures: { baseColor: 512 }, lods: [ { ratio: 0.5, error: 0.02 } ] },
	{ id: 'shrub_rooibos', provenance: { creator: 'James Ray Cock (modeling), Jenelle van Heerden (photography)', url: 'https://polyhaven.com/a/wild_rooibos_bush', site: 'Poly Haven' }, src: 'ph-wild-rooibos-bush-d-479071e3', note: 'Poly Haven wild rooibos bush (variant d), ×2.2', pivot: 'base', scale: 2.2, materials: { '*': { metallic: 0, doubleSided: true } }, textures: { baseColor: 1024, normal: 512, metallicRoughness: 512 }, lods: [ { ratio: 0.4, error: 0.03, lockBorder: true } ] },
	{ id: 'shrub_03', provenance: { creator: 'Rico Cilliers', url: 'https://polyhaven.com/a/shrub_03', site: 'Poly Haven' }, src: 'ph-shrub-03-a-a580856e', note: 'Poly Haven shrub 03 (variant a), ×2.5', pivot: 'base', scale: 2.5, materials: { '*': { metallic: 0, doubleSided: true } }, textures: { baseColor: 1024, normal: 512, metallicRoughness: 512 }, lods: [ { ratio: 0.4, error: 0.03, lockBorder: true } ] },
	{ id: 'dry_branches', provenance: { creator: 'Rico Cilliers', url: 'https://polyhaven.com/a/dry_branches_medium_01', site: 'Poly Haven' }, src: 'ph-dry-branches-medium-01-a-13fa7f00', note: 'Poly Haven dry branches (variant a), ×1.4', pivot: 'base', scale: 1.4, materials: { '*': { metallic: 0, doubleSided: true } }, textures: { baseColor: 1024, normal: 512, metallicRoughness: 512 }, lods: [ { ratio: 0.3, error: 0.03 } ] },
	{ id: 'bark_debris', provenance: { creator: 'Greg Zaal (photography), Jenelle van Heerden (modeling)', url: 'https://polyhaven.com/a/bark_debris_01', site: 'Poly Haven' }, src: 'ph-bark-debris-01-a-28282178', note: 'Poly Haven bark debris (variant a), 38k → ~6k tris, ×1.5', pivot: 'base', scale: 1.5, simplify: { ratio: 0.15, error: 0.01 }, materials: { '*': { metallic: 0 } }, textures: { baseColor: 1024, normal: 512, metallicRoughness: 512 }, lods: [ { ratio: 0.3, error: 0.03 } ] },
];
