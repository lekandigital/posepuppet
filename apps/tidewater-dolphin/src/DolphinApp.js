// DolphinApp — BodyArcade Checkpoint 10 host orchestration.
//
// A derived copy of Tidewater's src/App.js (pinned 4811ba4, vendored unmodified at
// vendor/tidewater/). Every Tidewater system — engine, atmosphere, clouds, shadows,
// terrain, village, vegetation, shore field, rocks, debris, reef, boat, FFT ocean,
// water surface and material, shore waves, swash simulation, surf foam, caustics,
// underwater lighting, ground bounce, local lights, refraction, water queries,
// marine snow, spray, breakers, air motes, whale, wake, wildlife, post chain, haze,
// audio — is constructed, configured and updated exactly as App.js does, in the same
// order and with the same parameters. The differences (all marked `CP10:`):
//
//   1. PLAY MODES (CP10 continuation). Tidewater's first-person Player (walker /
//      swimmer / deck / helm) and its BoatController are constructed exactly as in
//      App.js, but the BodyArcade DolphinPlayer (120 Hz swim sim, GAMICO dolphin,
//      chase camera rig, keyboard / body input) is the DEFAULT player. One controller
//      owns the input and the camera at a time (`playerMode`: 'dolphin' | 'walk' |
//      'boat', the Play tab of the settings panel); the others idle — the dolphin
//      keeps simulating on a neutral autopilot (hovers where it was left), the
//      walker / boat are simply not updated. Switching never rebuilds the world.
//   2. FISHING (CP10 continuation). Tidewater's fishing Game is constructed as in
//      App.js (it also builds the stalls — Joe's fish stand with its fish on ice,
//      Marta's chandlery, the vendor characters — which stay as scenery in every
//      mode), but it only UPDATES while "Fishing gameplay" is on in the Play tab
//      (default off) and the walker or the boat is the player. Off, or in dolphin
//      mode: the line comes in, the rod goes away and its HUD / minimap / guide are
//      hidden; the game state is kept for the session.
//   3. The free camera (F) and the walker / boat keep Tidewater's 62° lens; the
//      chase camera uses the Dolphin Controls lens (55° default); the lens follows the owner.
//   4. Pointer lock is requested on click only in the walker / boat modes (the
//      chase camera looks by dragging the view — no pointer lock).
//   5. Wildlife is told who the viewer is (the dolphin, or Tidewater's player).
//   6. ?noDolphin leaves the dolphin out of the scene (environment-parity captures).
//
// Nothing here changes what the water, sky, terrain or post look like.

import { Vector3, Euler, Color, MathUtils, Mesh } from '../vendor/tidewater/src/engine/index.js';
import { GPU } from '../vendor/tidewater/src/engine/gpu/GPU.js';
import { SunShadows } from '../vendor/tidewater/src/engine/render/Shadows.js';
import { FrameUniforms } from '../vendor/tidewater/src/engine/render/Frame.js';

import { Engine } from '../vendor/tidewater/src/core/Engine.js';
import { Input } from '../vendor/tidewater/src/core/Input.js';
import { CDLOD } from '../vendor/tidewater/src/core/CDLOD.js';
import { G } from '../vendor/tidewater/src/core/Globals.js';
import { Profiler } from '../vendor/tidewater/src/core/Profiler.js';
import { SceneRenderer, LAYERS } from '../vendor/tidewater/src/core/SceneRenderer.js';
import { DEPTH_FORMAT } from '../vendor/tidewater/src/engine/render/SceneRenderer.js';
import { installDebugViews } from '../vendor/tidewater/src/core/DebugViews.js';

import { Atmosphere, SUN_ILLUMINANCE } from '../vendor/tidewater/src/sky/Atmosphere.js';
import { Sky, sunDirectionFromTime } from '../vendor/tidewater/src/sky/Sky.js';
import { Clouds } from '../vendor/tidewater/src/sky/Clouds.js';
import { SkyProClouds } from '../vendor/tidewater/src/sky/SkyProClouds.js';
import { Environment } from '../vendor/tidewater/src/sky/Environment.js';

import { TerrainData } from '../vendor/tidewater/src/world/TerrainData.js';
import { TerrainGPU } from '../vendor/tidewater/src/world/TerrainGPU.js';
import { Terrain } from '../vendor/tidewater/src/world/Terrain.js';
import { computeShoreField } from '../vendor/tidewater/src/world/ShoreField.js';
import { WORLD } from '../vendor/tidewater/src/world/WorldLayout.js';
import { Colliders } from '../vendor/tidewater/src/world/Colliders.js';
import { Village } from '../vendor/tidewater/src/world/Village.js';
import { Reef } from '../vendor/tidewater/src/world/Reef.js';
import { BoatModel } from '../vendor/tidewater/src/world/BoatModel.js';
import { Rocks } from '../vendor/tidewater/src/world/Rocks.js';
import { Debris } from '../vendor/tidewater/src/world/Debris.js';
import { Wildlife } from '../vendor/tidewater/src/world/wildlife/Wildlife.js';
import { Whale } from '../vendor/tidewater/src/world/marine/Whale.js';

import { OceanFFT } from '../vendor/tidewater/src/ocean/OceanFFT.js';
import { WaterSurface } from '../vendor/tidewater/src/ocean/WaterSurface.js';
import { WaterMaterial } from '../vendor/tidewater/src/ocean/WaterMaterial.js';
import { createFoamTexture } from '../vendor/tidewater/src/ocean/FoamTexture.js';
import { ShoreWaves } from '../vendor/tidewater/src/ocean/ShoreWaves.js';
import { ShoreSim } from '../vendor/tidewater/src/ocean/ShoreSim.js';
import { Caustics } from '../vendor/tidewater/src/ocean/Caustics.js';
import { installUnderwaterLighting } from '../vendor/tidewater/src/ocean/UnderwaterLighting.js';
import { RefractionPass } from '../vendor/tidewater/src/ocean/RefractionPass.js';
import { installGroundBounce } from '../vendor/tidewater/src/materials/GroundBounce.js';
import { LocalLights, addVillageLights, addBoatLights } from '../vendor/tidewater/src/materials/LocalLights.js';
import { WaterQuery } from '../vendor/tidewater/src/ocean/WaterQuery.js';
import { Breakers } from '../vendor/tidewater/src/ocean/Breakers.js';
import { SurfFoam } from '../vendor/tidewater/src/ocean/SurfFoam.js';
import { Spray } from '../vendor/tidewater/src/fx/Spray.js';
import { SeaDetail } from '../vendor/tidewater/src/ocean/SeaDetail.js';
import { MarineSnow } from '../vendor/tidewater/src/fx/MarineSnow.js';
import { AirMotes } from '../vendor/tidewater/src/fx/AirMotes.js';

import { Underwater, LENS_REACH } from '../vendor/tidewater/src/post/Underwater.js';
import { PostFX } from '../vendor/tidewater/src/post/PostFX.js';
import { AirHaze } from '../vendor/tidewater/src/post/AirHaze.js';
import { FlyCamera } from '../vendor/tidewater/src/player/FlyCamera.js';
// CP10 continuation: Tidewater's Player (walker / boat) and fishing Game are selectable, non-default
import { Player } from '../vendor/tidewater/src/player/Player.js';
import { Game } from '../vendor/tidewater/src/game/Game.js';
import { STAND } from '../vendor/tidewater/src/game/FishStand.js';
import { CHANDLERY } from '../vendor/tidewater/src/game/Chandlery.js';
import { DolphinPlayer, DEFAULT_SPAWN } from './dolphin/dolphinPlayer';
import { RIG } from './dolphin/cameraRig';
import { SceneryAdditions } from './additions/SceneryAdditions.js';
import { BoatController } from '../vendor/tidewater/src/player/BoatController.js';
import { BoatSpray } from '../vendor/tidewater/src/player/BoatSpray.js';
import { WakeSim } from '../vendor/tidewater/src/ocean/WakeSim.js';
import { Vegetation } from '../vendor/tidewater/src/world/Vegetation.js';
import { SoundScape } from '../vendor/tidewater/src/audio/SoundScape.js';
import { updateCameraVelocity, useStaticVelocity } from '../vendor/tidewater/src/post/CameraVelocity.js';

const _up = new Vector3( 0, 1, 0 );
// CP10: Tidewater's own lens for the free camera and its player (Engine.js constructs the camera with it)
const TIDEWATER_FOV = 62;
export const PLAY_MODES = [ 'dolphin', 'walk', 'boat' ];

export class DolphinApp {

	constructor() {

		this.settings = {
			timeOfDay: 16.2,
			sunAzimuth: 0, // degrees: turns the sun's daily path about the vertical
			timeSpeed: 0, // hours per real second
			exposure: 0.55,
			renderScale: 1, // internal resolution (the temporal upscaler reconstructs the output), Performance tab
		};
		this.qs = new URLSearchParams( location.search );
		this.dolphin = null;
		this.ui = null;
		// CP10 continuation: play-mode ownership and the optional fishing activity (both menu-driven;
		// a fresh session is always the dolphin with fishing off — no startup preference is stored)
		this.playerMode = 'dolphin';
		this.fishing = false;
		this._fishingActive = false;
		this._walkerPose = null; // where the walker was left (restored on the next switch to Walking)
		this.modeSwitches = 0;
		this.onPlayerMode = null; // ( mode, prev ) hook for the UI

	}

	async init( onProgress = () => {} ) {

		const qs = this.qs;
		// report a stage, then let the page paint it before the (synchronous) stage work starts
		const progress = async ( p, text, until ) => {

			onProgress( p, text, until );
			if ( typeof requestAnimationFrame === 'function' ) await new Promise( ( r ) => requestAnimationFrame( () => setTimeout( r, 0 ) ) );

		};
		await progress( 0.02, 'Starting WebGPU…' );
		const engine = this.engine = new Engine( document.getElementById( 'app' ) );
		await engine.init();
		// systems take `renderer` first as in the three.js version: it is the Engine now (GPU access is global)
		const renderer = engine;
		const { scene, camera } = engine;
		// the near clip plane is the lens: it slices the water surface at the waterline (see Underwater)
		camera.near = 0.1;
		camera.updateProjectionMatrix();
		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;

		this.input = new Input( engine.domElement );
		this.fly = new FlyCamera( camera, engine.domElement, this.input );
		this.fly.setPose( new Vector3( 20, 6, - 20 ), Math.PI * 0.9, - 0.12 );

		// ---------------------------------------------------------------- sky
		await progress( 0.04, 'Building the atmosphere…' );
		this.atmosphere = new Atmosphere( renderer );
		this.sky = new Sky( this.atmosphere );
		if ( ! qs.has( 'noClouds' ) ) {

			// sky-pro-webgpu's clouds ("Partly cloudy"); ?oldClouds: the previous ones
			this.clouds = qs.has( 'oldClouds' ) ? new Clouds( renderer, this.atmosphere ) : new SkyProClouds( renderer, this.atmosphere );
			if ( this.clouds.ready ) await this.clouds.ready;
			this.sky.clouds = this.clouds;

		}

		// 3 cascades: 0-10 m (~1 cm texels, fine contact detail), 10-60 m, 60-400 m (rough far shadows);
		// contact-hardening filter sized by the sun's disc on the near cascade. Each cascade's depth range
		// is its light margin (200 m) + its extent, which keeps the depth bias small in metres.
		// Shadows come from the opaque and the late (transparent-pass) layers.
		this.csm = this.shadows = new SunShadows( { size: 2048, splits: [ 10, 60, 400 ], lightMargin: 200, normalBias: [ 0.015, 0.06, 0.3 ], bias: 0.00002 } );
		this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );

		this.environment = new Environment( renderer, scene, this.sky );

		// ---------------------------------------------------------------- island
		await progress( 0.06, 'Shaping the island…' );
		this.terrainData = new TerrainData();
		this.colliders = new Colliders();
		// the village flattens building pads into the heightmap: build it before any terrain
		// data is derived (shore field, GPU textures, meshes)
		await progress( 0.12, 'Building the village…' );
		this.village = new Village( { scene, terrain: this.terrainData, colliders: this.colliders } );
		if ( ! qs.has( 'noVeg' ) ) {

			await progress( 0.14, 'Planting the island…' );
			this.vegetation = new Vegetation( { scene, terrain: this.terrainData, village: this.village } );
			useStaticVelocity( this.vegetation.group );

		}

		await progress( 0.19, 'Rolling in the swell…' );
		this.shoreField = computeShoreField( this.terrainData, { res: 512, swellDir: [ WORLD.swellDir.x, WORLD.swellDir.y ] } );
		this.terrainGPU = new TerrainGPU( this.terrainData, this.shoreField );
		// terrain and rocks apply the heightfield sun shadow (long hill shadows) in their own lighting
		this.terrain = new Terrain( { scene, terrainData: this.terrainData, terrainGPU: this.terrainGPU, renderer } );
		this.rocks = new Rocks( { scene, terrain: this.terrain, village: this.village, colliders: this.colliders } );
		// driftwood (CC0 photoscans), wrack, pebbles and village clutter
		this.debris = new Debris( { scene, terrain: this.terrain, village: this.village, vegetation: this.vegetation, rocks: this.rocks, colliders: this.colliders } );
		// these apply the heightfield sun shadow in their own lighting model (see UnderwaterLighting)
		this.terrain.mesh.material.appliesHillShadow = true;
		this.rocks.material.appliesHillShadow = true;

		await progress( 0.23, 'Growing the reef…' );
		this.reef = new Reef( { scene, terrain: this.terrainData, shoreField: this.shoreField } );
		// Asset-integration pass: the optional, reversible scenery additions (Play tab → Scenery
		// additions; all categories off = the pristine Tidewater scene, exactly). Placed now (CPU,
		// deterministic) and loaded before the players exist, because the solid imported
		// structures are part of the contact surface the dolphin's world sampler, Tidewater's
		// walker and the reef's fish are built on (SceneryAdditions.ground / .floor).
		await progress( 0.26, 'Placing the scenery additions…' );
		this.additions = new SceneryAdditions( this );
		await this.additions.load();

		this.boat = new BoatModel();
		scene.add( this.boat.group );
		this.boat.group.position.copy( WORLD.boatDock.position );
		this.boat.group.rotation.y = WORLD.boatDock.heading;

		// ---------------------------------------------------------------- ocean
		await progress( 0.3, 'Simulating the ocean…' );
		this.fft = new OceanFFT( renderer );
		if ( this.reef.setOcean ) this.reef.setOcean( this.fft ); // coral / sea fan sway follows the simulated swell
		this.foamTexture = createFoamTexture( renderer );
		this.oceanLOD = new CDLOD( { gridSize: Number( qs.get( 'G' ) || 32 ), leafSize: 8, levels: 12, minY: - 25, maxY: 25 } );
		this.surface = new WaterSurface( { fft: this.fft, cdlod: this.oceanLOD, foamTexture: this.foamTexture } );
		this.surface.terrain = this.terrainGPU;
		this.seaDetail = new SeaDetail();
		this.surface.detail = this.seaDetail;
		this.shore = new ShoreWaves( this.terrainGPU );
		this.surface.shore = this.shore;
		this.caustics = qs.has( 'noCaustics' ) ? null : new Caustics( renderer, this.fft );
		if ( this.caustics ) this.caustics.detail = this.seaDetail;

		if ( ! qs.has( 'noSim' ) ) {

			this.shoreSim = new ShoreSim( renderer, { terrainGPU: this.terrainGPU, shore: this.shore } );
			this.surface.shoreSim = this.shoreSim;
			// WGSL: fn terrainWetness( xz: vec2f, h: f32 ) -> vec2f (x = wetness, y = sand foam)
			this.terrain.wetness = {
				modules: [ this.shoreSim.module ],
				code: /* wgsl */`
fn terrainWetness( xz: vec2f, h: f32 ) -> vec2f {
	let s = shoreSimSample( xz );
	let inside = shoreSimInside( shoreSimUvOf( xz ) );
	// outside the simulated region fall back to a static damp band
	let band = smoothstep( 0.45, 0.0, h );
	// foam left on the sand: the lace the water carried, stranded and popping (ShoreSim.sandFoam)
	return vec2f( max( s.y, band * ( 1.0 - inside ) ), shoreSimSandFoam( xz, s, h ) );
}`,
			};
			this.terrain.finalizeMaterial();
			// surf-zone foam look (whitewater, lace) used by the water shader
			this.surfFoam = new SurfFoam( { shoreSim: this.shoreSim } );
			this.surface.foamShading = ( args ) => this.surfFoam.shading( args );

		}

		// how much of the underwater lighting each group needs (sampler budget, see UnderwaterLighting)
		const underwaterMode = ( root, m ) => root && root.traverse( ( o ) => {

			if ( o.material ) for ( const mat of Array.isArray( o.material ) ? o.material : [ o.material ] ) mat.underwaterLighting = m;

		} );
		underwaterMode( this.village.group, 'lite' );
		underwaterMode( this.boat.group, 'lite' );
		if ( this.vegetation ) underwaterMode( this.vegetation.group, 'none' );

		this.underwaterLighting = installUnderwaterLighting( {
			fft: this.fft, caustics: this.caustics, clouds: this.clouds, terrain: this.terrainGPU,
			shore: this.shore, surface: this.surface, shoreSim: this.shoreSim,
		} );

		// sunlight bounced off the ground (one diffuse bounce, re-baked with the terrain sun shadow)
		installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );
		this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );
		// the water's refraction source: the scene below the water only, half resolution
		this.refraction = new RefractionPass( { meshRenderer: engine.meshRenderer, scene, camera, sceneRenderer: this.sceneRenderer, scale: 0.5 } );
		this.sceneRenderer.onBeforeWater = () => this.refraction.render( G.seaLevel.value );
		if ( this.sky.background ) this.sceneRenderer.background = this.sky.background;
		// lanterns, lamp posts, path lights, lit windows, the boat's cabin / navigation lights and the
		// flashlight (L): nearest few packed into one small uniform array each frame
		this.localLights = new LocalLights();
		addVillageLights( this.localLights, this.village );
		addBoatLights( this.localLights, this.boat );
		// rough, large or heavily overdrawn surfaces (ground, rocks, debris, foliage) take the local
		// lights as Lambert only; the village, pier and boat get the full BRDF (glints on wet wood, metal)
		for ( const root of [ this.terrain.mesh, this.rocks.group, this.debris && this.debris.group, this.vegetation && this.vegetation.group ] ) if ( root ) root.traverse( ( o ) => {

			if ( o.material ) for ( const m of Array.isArray( o.material ) ? o.material : [ o.material ] ) m.localLightsCheap = true;

		} );
		// the sea is not drawn inside the boat (its hull volume masks the surface)
		this.sceneRenderer.addHullMask( this.boat.createHullVolumeGeometry(), this.boat.group );
		this.waterMaterial = new WaterMaterial( {
			surface: this.surface, sky: this.sky, sceneCopy: this.sceneRenderer.opaqueCopy, sceneDepthHalf: this.sceneRenderer.opaqueDepthHalf.texture, refraction: this.refraction,
			hullMask: this.sceneRenderer.hullMaskRT.texture, hullMaskActive: this.sceneRenderer.hullMaskActive,
		} );
		this.waterMaterial.clouds = this.clouds;
		this.ocean = new Mesh( this.oceanLOD.geometry, this.waterMaterial );
		this.ocean.frustumCulled = false;
		this.ocean.receiveShadow = true;
		this.ocean.layers.set( LAYERS.WATER );
		// Thin alpha-tested meshes (nets, cloth, wire traps) are drawn in the late pass: the screen-space
		// AO and the refraction copy only see the opaque pass, so they neither smear dark AO halos over
		// what is behind them nor receive the noisy AO of their own strands. The boat's window glass is
		// blended: in the late pass it goes over the water seen through it (drawn earlier it would be
		// painted over by the water).
		this.scene.traverse( ( o ) => {

			if ( o.isMesh && ( o.name === 'village_fabric' || o.name === 'village_nets' || o.name === 'boat-trap' || o.name === 'boat-glass' ) ) o.layers.set( LAYERS.TRANSPARENT );

		} );
		// Terrain and water place their vertices in the vertex shader (CDLOD), so three's default motion
		// vectors (previous frame = raw grid position) are garbage there. Both are still in the world or
		// nearly so: camera-only reprojection of the real world position is what the temporal resolve needs.
		// ( the water material writes its own velocity + waterline mask outputs )
		useStaticVelocity( this.terrain.mesh );
		useStaticVelocity( this.rocks.group );
		scene.add( this.ocean );

		this.query = new WaterQuery( renderer, this.surface );

		this.marineSnow = new MarineSnow( { fft: this.fft, query: this.query } );
		scene.add( this.marineSnow.mesh );

		// ---- surf: plunging lips along the beach + spray particles (the breakers emit on the GPU;
		// spray.emit() / emitAlongPoints() for boat bow spray and splashes)
		this.spray = new Spray( renderer, { query: this.query, terrain: this.terrainGPU, sceneCopy: this.sceneRenderer.opaqueCopy, clouds: this.clouds } );
		scene.add( this.spray.mesh );
		if ( this.reef.setSpray ) this.reef.setSpray( this.spray ); // splashes of leaping fish
		this.breakers = new Breakers( renderer, {
			surface: this.surface, shore: this.shore, terrainData: this.terrainData, sky: this.sky,
			spray: this.spray, clouds: this.clouds,
		} );
		scene.add( this.breakers.mesh );
		// dust, pollen, salt aerosol, seed fluff and gnats drifting around the camera
		this.airMotes = new AirMotes( { terrain: this.terrainGPU, clouds: this.clouds, csm: this.csm, reversedDepth: true } );
		scene.add( this.airMotes.mesh );
		this.boatCtl = new BoatController( { model: this.boat, query: this.query, terrain: this.terrainData, colliders: this.colliders } );
		this.boatSpray = new BoatSpray( { boat: this.boatCtl, spray: this.spray } );
		// humpback cruising the deep water around the island (model fetched from public/models/whale)
		this.whale = new Whale( { scene, terrain: this.terrainData, query: this.query, spray: this.spray } );
		try {

			await this.whale.load();
			if ( this.reef && this.reef.setWhale ) this.reef.setWhale( this.whale ); // escort fish, foam and slick

		} catch ( e ) {

			console.warn( 'whale model failed to load', e );
			this.whale = null;

		}

		// interactive wake around the boat (Kelvin pattern, bow/stern waves, prop wash foam)
		this.wake = new WakeSim( renderer, { terrainGPU: this.terrainGPU, boat: this.boatCtl, colliders: this.colliders } );
		this.surface.wake = this.wake;
		// CP10 continuation: Tidewater's own first-person Player (walker / swimmer / deck / helm),
		// constructed exactly as App.js does — selectable from the Play tab, idle by default
		// (reef: the composite floor — Tidewater's reef plus the enabled solid additions — read through
		// the one method Player uses, floorHeightAt)
		this.player = new Player( { camera, input: this.input, terrain: this.terrainData, colliders: this.colliders, query: this.query, boat: this.boatCtl, reef: this.additions.floor } );
		// CP10: the BodyArcade dolphin is the DEFAULT player — the thing the camera follows. Same
		// world inputs the walker uses (terrain, reef floor, colliders, water query) plus
		// Tidewater's spray and audio for splashes. ?noDolphin: environment only.
		await progress( 0.31, 'Waking the dolphin…' );
		const app = this;
		this.dolphin = await DolphinPlayer.create( {
			camera, scene, terrainData: this.terrainData, reef: this.additions.ground, colliders: this.colliders, query: this.query,
			spray: this.spray, get audio() { return app.audio; },
			boatDock: { x: WORLD.boatDock.position.x, z: WORLD.boatDock.position.z, heading: WORLD.boatDock.heading },
			cameraWaterHeight: () => this.cameraWaterHeight ?? 0,
		}, {
			visible: ! qs.has( 'noDolphin' ),
			swellRide: ! qs.has( 'noSwellRide' ),
			spawn: DEFAULT_SPAWN,
			baseUrl: import.meta.env.BASE_URL,
		} );
		// birds, beach crabs, sanderlings (after spray / query / boat, which they use)
		this.wildlife = new Wildlife( {
			scene, renderer, terrain: this.terrainData, terrainGPU: this.terrainGPU, shore: this.shore,
			village: this.village, colliders: this.colliders, vegetation: this.vegetation, boat: this.boatCtl, boatModel: this.boat,
			query: this.query, spray: this.spray, csm: this.csm,
		} );
		this.freeCam = qs.has( 'fly' );
		if ( this.freeCam ) {

			// CP10: starting in the free camera — Tidewater's lens (the rig set its own at construction)
			this.camera.fov = TIDEWATER_FOV;
			this.camera.updateProjectionMatrix();

		}

		// ---------------------------------------------------------------- post
		await progress( 0.34, 'Preparing the shaders…' );
		this.underwater = new Underwater( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, maskTexture: this.sceneRenderer.waterMaskTexture,
			query: this.query, caustics: this.caustics, fft: this.fft,
		} );
		// the camera's height above the water in the same frame (GPU query): decides the side the surface
		// is seen from where the triangle facing can't be trusted
		this.waterMaterial.cameraWaterHeightNode = this.query.cameraState().x;
		// aerial perspective, marine haze and volumetric sun shafts (post)
		this.haze = qs.has( 'noHaze' ) ? null : new AirHaze( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, underwater: this.underwater, atmosphere: this.atmosphere,
			sky: this.sky, clouds: this.clouds, terrain: this.terrainGPU, csm: this.csm,
		} );
		this.post = new PostFX( renderer, { sceneRenderer: this.sceneRenderer, camera, underwater: this.underwater, clouds: this.clouds, sunDir: this.atmosphere.sunDir, haze: this.haze } );
		G.exposure.value = this.settings.exposure;
		if ( qs.has( 'scale' ) ) this.settings.renderScale = Number( qs.get( 'scale' ) ) || 1;
		this.setRenderScale( this.settings.renderScale );

		// ---------------------------------------------------------------- audio
		// recorded field recordings (public/audio, credits in public/audio/CREDITS.md); ?noAudio turns it off
		this.audio = qs.has( 'noAudio' ) ? null : new SoundScape();
		this.player.audio = this.audio;
		// CP10 continuation: Tidewater's fishing game, constructed as in App.js (same order, so the
		// seeded ?bench layout is unchanged). It builds the scenery that stays in every mode — Joe's
		// fish stand with the fish on ice, Marta's chandlery, both vendor characters — plus the rod,
		// the saved progress and the boat's floodlights. It only updates while fishing is enabled
		// in the Play tab and the walker / boat is the player (see applyFishing).
		this.game = new Game( this );
		this.stand = this.game.stand;
		this.display = this.game.display;
		this.chandlery = this.game.chandlery;
		this.vendors = this.game.vendors;
		// (the scenery additions were placed and loaded right after the reef, see above)
		// the lanterns at Joe's fish stand and Marta's chandlery (lit from dusk like the village lamps);
		// positions are in each stall's frame (x right, z toward the customer), turned by its yaw
		for ( const [ s, lx, ly, lz ] of [ [ STAND, - 0.9, 1.85, 0.1 ], [ CHANDLERY, - 0.75, 1.58, - 1.45 ] ] ) {

			const c = Math.cos( s.yaw ), sn = Math.sin( s.yaw );
			const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
			this.localLights.add( { position: new Vector3( x, this.terrainData.heightAt( s.x, s.z ) + ly, z ), color: new Color( 1.0, 0.72, 0.42 ), intensity: 5 * 1.5, range: 11, kind: 'lantern', flicker: 0.08 } );

		}

		this.boatCtl.onSlam = ( s ) => this.audio && this.audio.hullSlap( s );
		engine.domElement.addEventListener( 'click', () => {

			if ( window.__ui && window.__ui.isPointerOverUI ) return;
			// CP10: pointer lock only for Tidewater's mouse-look modes (walker / boat); the chase
			// camera looks by dragging the view, so in dolphin mode a click only unlocks audio
			if ( this.playerMode !== 'dolphin' ) this.input.requestLock();
			if ( this.audio ) this.audio.resume();

		} );

		this.profiler = new Profiler( renderer );
		this.profiler.track( 'fft rows', this.fft.rowKernel );
		this.profiler.track( 'fft columns', this.fft.columnKernel );
		this.profiler.track( 'sky view', this.atmosphere.skyViewKernel );

		this.updateSun();
		installDebugViews( this );
		window.__app = this;
		this.gpu = GPU; // console / test access

		// ---- compile pipelines asynchronously (keeps the page responsive), then prime a few
		// frames behind the loading screen so any remaining first-use stalls happen there
		// stage weights: in the browser the pipeline compile below takes far longer than everything before it
		await progress( 0.36, 'Compiling shaders…', 0.95 );
		await this.precompile();
		this.additions.attach(); // (?lazyAdditions: the imported scenery joins the scene only now)
		await progress( 0.96, 'Warming up…' );
		for ( let i = 0; i < 2; i ++ ) {

			this.frame( 1 / 60 );
			await GPU.queue.onSubmittedWorkDone();

		}

		// CP10: the warm-up frames stepped the sim; the game starts from the spawn pose with the
		// chase camera already in place (no first-frame rest pose, no catch-up swing)
		this.dolphin.resetToSpawn();
		if ( ! this.freeCam ) this.dolphin.update( 1 / 60 );

	}

	// Build every pipeline up front, then wait for the GPU (keeps first-use compiles behind the loading
	// screen). The precompile frame visits every mesh of every pass, hidden or out of view, and the
	// pipelines compile in parallel in the background (GPU.renderPipeline); the refraction pass and
	// the hull mask are forced on so their variants are built too.
	async precompile() {

		const mr = this.engine.meshRenderer;
		const refr = this.refraction.enabled;
		// compute / post pipelines were requested while the systems were built: let them finish first
		// (the frame below would otherwise compile each one again, synchronously); the post chain
		// builds its passes on first use, so build it now
		if ( ! this.post._built ) {

			this.post._build();
			this.post._outW = 0; // as PostFX.beginFrame: size the new targets

		}

		await GPU.pipelinesReady();
		mr.precompiling = true;
		this.refraction.enabled = true;
		const sr = this.sceneRenderer, hm = sr.hullMaskRT;
		if ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {
			label: 'hull mask', kind: 'color', camera: this.camera, colorViews: [ hm.texture.view() ], colorFormats: hm.formats,
			clearColors: [ [ 0, 0, 0, 0 ] ], depthView: hm.depthTexture.view(), depthFormat: DEPTH_FORMAT, clearDepth: 0, cull: false,
		} );
		try {

			// both water variants: with the hull-mask discard (a hull on screen) and without
			for ( const hull of [ 0, 1 ] ) {

				this.waterMaterial.hullOverride = hull;
				this.frame( 1 / 60 );

			}

		} catch ( e ) {

			console.warn( 'precompile failed', e );

		}

		this.waterMaterial.hullOverride = null;
		mr.precompiling = false;
		this.refraction.enabled = refr;
		await GPU.pipelinesReady();
		await GPU.queue.onSubmittedWorkDone();

	}

	// ---------------------------------------------------------------- sun / sky

	updateSun() {

		const s = this.settings;
		const dir = sunDirectionFromTime( s.timeOfDay ).applyAxisAngle( _up, MathUtils.degToRad( s.sunAzimuth || 0 ) );
		// the sky is always scattered sunlight, even with the sun below the horizon (twilight)
		this.atmosphere.sunDir.value.copy( dir );
		// below the horizon the moon takes over as the key light
		const night = MathUtils.smoothstep( - dir.y, 0.02, 0.18 );
		G.night.value = night;
		this.sky.starIntensity.value = night;
		const moon = new Vector3( - dir.x, Math.abs( dir.y ) * 0.8 + 0.25, - dir.z ).normalize();
		this.sky.moonDir.value.copy( moon );

		// key light: the sun until it is well below the horizon (it gives no direct light in
		// twilight anyway), then the moon
		const light = dir.y > - 0.07 ? dir : moon;
		G.sunDir.value.copy( light );

	}

	applyAtmosphereReadback() {

		const a = this.atmosphere;
		if ( ! a.sunTransmittance ) return;
		const sunTrue = a.sunDir.value;
		const sunUp = sunTrue.y > - 0.07; // same switch as updateSun()
		const T = a.sunTransmittance;
		const horizonFade = MathUtils.smoothstep( sunTrue.y, - 0.03, 0.02 );
		let c;
		if ( sunUp ) c = new Color( T[ 0 ], T[ 1 ], T[ 2 ] ).multiplyScalar( SUN_ILLUMINANCE * horizonFade );
		else c = new Color( 0.6, 0.7, 1.0 ).multiplyScalar( 0.12 * G.night.value );
		G.sunColor.value.copy( c );
		const irr = a.skyIrradiance;
		const nightAmb = 0.012 * G.night.value;
		G.skyIrradiance.value.setRGB( irr[ 0 ] + nightAmb * 0.6, irr[ 1 ] + nightAmb * 0.7, irr[ 2 ] + nightAmb );
		G.horizonColor.value.setRGB( a.horizon[ 0 ], a.horizon[ 1 ], a.horizon[ 2 ] );

	}

	// T: let the day run (about 8 minutes per day) or stop it
	toggleTime() {

		const s = this.settings;
		if ( s.timeSpeed !== 0 ) {

			this._timeSpeed = s.timeSpeed;
			s.timeSpeed = 0;

		} else {

			s.timeSpeed = this._timeSpeed || 0.05;

		}

		if ( this.ui ) {

			this.ui.s.advance = s.timeSpeed !== 0;
			this.ui.ui.refresh();
			this.ui.ui.toast( s.timeSpeed !== 0 ? 'Time running' : 'Time paused' );

		}

	}

	// CP10 controls pass: the chase lens is a Dolphin Controls preference (55° default, 40–75)
	chaseFov() {

		return this.dolphin ? this.dolphin.controls.prefs().fov : RIG.FOV;

	}

	// Free (debug) camera on F. CP10: in dolphin mode the dolphin holds still (its animation keeps
	// cycling) while the free camera is out, and resumes on its chase camera where it was left; in
	// the walker / boat modes Tidewater's own behaviour (the walker continues from the camera, the
	// boat resumes). The lens follows the owner: Tidewater's 62° for the free camera (so review
	// views match the pristine app) and its player, the BodyArcade rig's 55° for the chase.
	setFreeCam( on ) {

		if ( on === this.freeCam ) return;
		this.freeCam = on;
		if ( on ) {

			const e = new Euler().setFromQuaternion( this.camera.quaternion, 'YXZ' );
			this.fly.setPose( this.camera.position.clone(), e.y, e.x );
			this.fly.velocity.set( 0, 0, 0 );
			this.camera.fov = TIDEWATER_FOV;
			this.camera.updateProjectionMatrix();

		} else if ( this.playerMode === 'dolphin' ) {

			this.camera.fov = this.chaseFov();
			this.camera.updateProjectionMatrix();

		} else if ( this.player.mode !== 'boat' && this.player.mode !== 'deck' ) {

			this.dropPlayerAtCamera();

		}

	}

	// Leaving the free camera (walker modes): the player continues from where the camera is, facing
	// the same way, and falls from there (swimming at once if the camera is under water). Verbatim
	// Tidewater App.js.
	dropPlayerAtCamera() {

		const p = this.player, c = this.camera.position;
		const e = new Euler().setFromQuaternion( this.camera.quaternion, 'YXZ' );
		p.yaw = e.y;
		p.pitch = MathUtils.clamp( e.x, - 1.5, 1.5 );
		p.velocity.set( 0, 0, 0 );
		const ground = Math.max( this.terrainData.heightAt( c.x, c.z ), this.colliders.groundHeightAt( c.x, c.z, c.y ) );
		const water = this.cameraWaterHeight ?? 0;
		if ( c.y < water ) {

			p.mode = 'swim';
			p.position.set( c.x, Math.max( c.y - 0.16, ground + 0.3 ), c.z );

		} else {

			// drop from where the camera is: gravity brings you down onto the ground or a deck, or into
			// the sea (the walker starts swimming once it is out of its depth)
			p.mode = 'walk';
			p.position.set( c.x, Math.max( c.y - 1.62, ground ), c.z );
			p.grounded = false;

		}

		p.waterH = water;
		p.waterMean = water;

	}

	// ---------------------------------------------------------------- play modes (CP10 continuation)

	// The mode the menu shows: Tidewater's own E-key boarding can take the walker onto the boat.
	get displayedMode() {

		if ( this.playerMode === 'dolphin' ) return 'dolphin';
		const m = this.player.mode;
		return m === 'boat' || m === 'deck' ? 'boat' : 'walk';

	}

	// Hand the input and the camera to one controller. Nothing in the world is rebuilt: the ocean,
	// sky, terrain, wildlife, audio and the dolphin's rig all keep running; only the owner changes.
	setPlayerMode( mode ) {

		if ( ! PLAY_MODES.includes( mode ) ) return false;
		const prev = this.playerMode;
		const p = this.player;
		const aboard = p.mode === 'boat' || p.mode === 'deck';
		if ( mode === this.displayedMode ) return false;
		if ( this.freeCam ) this.freeCam = false; // the new owner takes the camera (no drop)
		const START = { x: WORLD.start.position.x, z: WORLD.start.position.z, yaw: WORLD.start.yaw };

		// ---- leave the current owner
		if ( prev === 'dolphin' ) this.dolphin.setControlled( false );
		else if ( ! aboard ) this._walkerPose = { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw, pitch: p.pitch, mode: p.mode };

		// ---- enter the new one (Tidewater's own transitions wherever it has one)
		this.playerMode = mode;
		if ( mode === 'dolphin' ) {

			// at the helm: stand up (leaveHelm — engine off, standing on deck); the boat stays put
			if ( p.mode === 'boat' ) p.leaveHelm();
			this._moorIfDocked();
			p.busy = false;
			if ( document.pointerLockElement ) document.exitPointerLock?.();
			this.camera.fov = this.chaseFov();
			this.camera.updateProjectionMatrix();
			this.dolphin.resume();

		} else if ( mode === 'walk' ) {

			this.camera.fov = TIDEWATER_FOV;
			this.camera.updateProjectionMatrix();
			if ( aboard ) {

				// off the boat: Tidewater's step-ashore target beside it if there is one (pier deck,
				// sand); else stand up, leave the boat where it is and walk from where the walker was
				// last on foot (or Tidewater's start)
				const target = p.ashoreTarget();
				if ( target ) {

					p.exitBoat( target );
					p.update( 0 );

				} else {

					if ( p.mode === 'boat' ) p.leaveHelm();
					this._moorIfDocked();
					this.placeWalker( this._walkerPose || START );

				}

			} else this.placeWalker( this._walkerPose || START );

		} else {

			this.camera.fov = TIDEWATER_FOV;
			this.camera.updateProjectionMatrix();
			if ( p.mode === 'deck' ) p.takeHelm(); // already aboard: sit down at the wheel
			else if ( ! aboard ) p.enterBoat(); // boardBoat() + takeHelm(): Tidewater's own flow, straight to the wheel
			p.update( 0 ); // the helm camera this frame (no frame from the previous owner's camera)

		}

		this.input.consumeLook();
		this.modeSwitches ++;
		this.applyFishing();
		if ( typeof this.onPlayerMode === 'function' ) this.onPlayerMode( mode, prev );
		return true;

	}

	// a boat left at the dock ties up again (as Tidewater's exitBoat does)
	_moorIfDocked() {

		const b = this.boatCtl;
		if ( ! b.driven && b.position.distanceTo( WORLD.boatDock.position ) < 14 && b.speed < 1.5 ) {

			b.moored = true;
			b.mooring.anchor.set( b.position.x, 0, b.position.z );
			b.mooring.heading = b.getYaw();

		}

	}

	// put Tidewater's walker down at a spot: on the ground (terrain or a deck) or swimming
	placeWalker( { x, z, y = null, yaw = Math.PI, pitch = - 0.05, mode = 'walk' } ) {

		const p = this.player;
		const ground = Math.max( this.terrainData.heightAt( x, z ), this.colliders.groundHeightAt( x, z, 50 ) );
		const water = this.cameraWaterHeight ?? 0;
		p.mode = mode === 'swim' ? 'swim' : 'walk';
		p.position.set( x, p.mode === 'swim' ? ( y ?? water - 0.16 ) : ( y !== null && y > ground - 0.05 ? y : ground ), z );
		p.velocity.set( 0, 0, 0 );
		p.grounded = p.mode === 'walk';
		p.floating = true;
		p.yaw = yaw;
		p.pitch = MathUtils.clamp( pitch, - 1.5, 1.5 );
		p.waterH = water;
		p.waterMean = water;
		p.bob = 0;
		p.stepDist = 0;
		p.prompt = null;
		p.busy = false;
		p._camY = null;
		p.update( 0 ); // the walker's camera this frame

	}

	// "Fishing gameplay" (Play tab): Tidewater's fishing, only while the walker / boat is the player
	setFishing( on ) {

		on = !! on;
		if ( on === this.fishing ) return;
		this.fishing = on;
		this.applyFishing();
		if ( this.ui ) this.ui.ui.toast( on ? ( this.playerMode === 'dolphin' ? 'Fishing on · switch to Walking or Boat to fish' : 'Fishing on · R takes out the rod' ) : 'Fishing off' );

	}

	get fishingActive() {

		return this._fishingActive;

	}

	applyFishing() {

		const active = this.fishing && this.playerMode !== 'dolphin';
		if ( active === this._fishingActive ) return;
		this._fishingActive = active;
		const g = this.game;
		if ( ! active ) {

			// line in, rod away, fish off the line, panels closed — the saved progress stays
			g.cancelLine( true );
			if ( g.rod.equipped ) g.rod.equip( false );
			g.rod.update( 0, { visible: false, fight: null } );
			if ( g.landing || g.display.shown ) g.endLanding();
			if ( g.hud ) {

				g.hud.toggleInventory( false );
				g.hud.closeStand();
				g.hud.hideCatch();

			}

			this.player.busy = false;

		}

		this.setFishingUIVisible( active );

	}

	// the fishing HUD (purse / cooler, fuel, sonar, fight meter, bite cue, cast bar, aim dot, catch
	// card, panels), the minimap and the first-play guide: shown only while fishing is active
	setFishingUIVisible( on ) {

		const g = this.game;
		if ( ! g.hud ) return; // not built yet (Game builds it on its first update)
		const h = g.hud;
		const els = [ h.purse, h.fight, h.bite, h.cast, h.dot, h.catchScrim, h.catchCard, h.inv, h.stand, g.minimap && g.minimap.el, g.guide && g.guide.el, g.guide && g.guide.coach ];
		for ( const el of els ) if ( el ) el.style.display = on ? '' : 'none';
		if ( ! on && g.guide && g.guide.open ) g.guide.close();

	}

	// ---------------------------------------------------------------- loop

	start() {

		this.engine.start( ( dt, t ) => this.frame( dt, t ) );

	}

	updateFPS( dt ) {

		const f = this._fps || ( this._fps = { el: document.getElementById( 'fps' ), acc: 0, n: 0, worst: 0 } );
		f.acc += dt;
		f.n ++;
		f.worst = Math.max( f.worst, dt );
		if ( f.acc >= 0.5 ) {

			const fps = f.n / f.acc;
			let text = `${ fps.toFixed( 0 ) } fps · ${ ( 1000 * f.acc / f.n ).toFixed( 1 ) } ms · max ${ ( f.worst * 1000 ).toFixed( 1 ) } ms`;
			if ( this.profiler && this.profiler.enabled ) {

				const p = this.profiler.result;
				text += ` · GPU c ${ p.compute.toFixed( 2 ) } r ${ p.render.toFixed( 2 ) }`;

			}

			if ( f.el ) f.el.textContent = text;
			this.fps = fps;
			f.acc = 0;
			f.n = 0;
			f.worst = 0;

		}

	}

	frame( dt ) {

		const t0 = performance.now();
		this._frame( dt );
		const ms = performance.now() - t0;
		this.cpuMs = this.cpuMs === undefined ? ms : this.cpuMs * 0.95 + ms * 0.05;

	}

	_frame( dt ) {

		GPU.beginFrame();
		FrameUniforms.fields.frameIndex.value = GPU.frame;
		const s = this.settings;
		this.updateFPS( dt );
		G.dt.value = dt;
		G.time.value += dt;
		if ( s.timeSpeed !== 0 ) s.timeOfDay = ( s.timeOfDay + dt * s.timeSpeed + 24 ) % 24;

		// ---- player / boat (boat physics first so the cameras follow this frame's pose)
		if ( this.input.hit( 'KeyF' ) ) this.setFreeCam( ! this.freeCam );
		if ( this.input.hit( 'KeyT' ) ) this.toggleTime();
		if ( this.input.hit( 'KeyL' ) ) {

			const on = this.localLights.toggleFlashlight();
			if ( this.ui ) this.ui.ui.toast( on ? 'Flashlight on' : 'Flashlight off' );

		}

		if ( this.input.hit( 'KeyM' ) && this.audio ) {

			this.audio.setMuted( ! this.audio.muted );
			if ( this.ui ) this.ui.ui.toast( this.audio.muted ? 'Sound off' : 'Sound on' );

		}
		this.boatCtl.update( dt );
		this.boatSpray.update( dt );
		this.wake.update( dt );
		// CP10: one player owns the input and the camera. Dolphin mode: controls → 120 Hz sim →
		// animation → chase camera (with the free camera out it only animates). Walker / boat modes:
		// Tidewater's Player as in App.js; the dolphin keeps simulating on its neutral autopilot.
		const dolphinMode = this.playerMode === 'dolphin';
		if ( this.freeCam ) this.fly.update( dt );
		else if ( ! dolphinMode ) this.player.update( dt );
		this.dolphin.update( dt, { paused: this.freeCam } );
		// CP10: the fishing game updates only while enabled and the walker / boat is the player;
		// otherwise the vendors idle on their own (animated when the camera is near)
		if ( this._fishingActive ) {

			const hadHud = !! this.game.hud;
			this.game.update( dt );
			if ( ! hadHud && this.game.hud ) this.setFishingUIVisible( true );

		} else for ( const v of this.vendors ) v.update( dt, this.camera.position );
		this.updateSun();

		this.atmosphere.update( dt, this.camera.position.y );
		this.applyAtmosphereReadback();

		// ---- water simulation
		this.fft.update( dt );
		this.seaDetail.update( dt );
		this.query.setCamera( this.camera.position.x, this.camera.position.z );
		this.boatCtl.queueQueries();
		this.dolphin.queueQueries(); // CP10: the dolphin's wave-height slot (the walker had one too)
		this.query.update();
		if ( this.query.cpuValid ) {

			const h0 = this.query.cpu[ 0 ];
			const h = Number.isFinite( h0 ) ? h0 : ( this.cameraWaterHeight ?? 0 );
			G.cameraUnderwater.value = this.camera.position.y < h - LENS_REACH ? 1 : 0;
			G.cameraWaterHeight.value = h;
			this.cameraWaterHeight = h;

		}

		if ( this.caustics ) this.caustics.update();
		// drawn while any part of the view can be under water (the specks above the surface are dropped)
		this.marineSnow.update( this.camera, this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) + LENS_REACH );
		this.airMotes.update( dt, this.camera, this.cameraWaterHeight ?? 0 );
		if ( this.shoreSim ) this.shoreSim.update();
		this.underwaterLighting.update( this.camera );
		this.breakers.update( this.camera );
		this.spray.update();
		if ( this.clouds ) this.clouds.update( dt, this.camera );
		this.environment.update( dt );

		// ---- world
		this.oceanLOD.update( this.camera );
		this.terrain.update( this.camera );
		this.rocks.update( this.camera );
		this.debris.update( this.camera );
		this.reef.update( dt, this.camera.position );
		this.village.update( dt );
		if ( this.vegetation ) this.vegetation.update( dt, this.camera );
		if ( this.whale ) this.whale.update( dt, this.camera );
		this.boat.update( dt );
		this.wildlife.update( dt, this.camera, this.freeCam ? null : dolphinMode ? this.dolphin.viewer : this.player ); // CP10: the player is the viewer
		this.additions.update( dt, this.camera );
		this.localLights.update( this.camera, dt );

		// ---- render
		G.exposure.value = s.exposure;
		updateCameraVelocity( this.camera );
		this.post.lens.update( dt, this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) );
		if ( this.post.flare ) {

			this.post.flare.setDepthHeight( this.sceneRenderer.sceneRT.height );
			this.post.flare.update( this.camera, dt, { aboveWater: this.camera.position.y > ( this.cameraWaterHeight ?? 0 ) - 0.02 } );

		}

		// the post chain sets the TAAU jitter + internal size and writes the camera into the frame
		// uniforms (setFrameCamera); shadows then render with this frame's sun and camera
		this.post.beginFrame();
		this.underwater.updateCamera( this.camera );
		this.shadows.render( this.scene, this.engine.meshRenderer, this.shadows.update( this.camera, G.sunDir.value ) );
		this.sceneRenderer.render();
		if ( this.post.flare ) this.post.flare.kernel.dispatch( 1 );
		this.post.render();
		this.post.endFrame();
		GPU.submit();
		this.profiler.update( dt );

		this.updateAudio( dt );
		if ( this.ui ) this.ui.update( dt );
		this.input.endFrame();

	}

	// Internal render resolution relative to the output (0.5..1), set by hand: changing it re-creates
	// the scene / post / cloud targets, so nothing adjusts it automatically.
	setRenderScale( v ) {

		const scale = MathUtils.clamp( Math.round( v * 20 ) / 20, 0.5, 1 );
		this.settings.renderScale = scale;
		this.post.setScale( scale );
		if ( this.clouds ) this.clouds.resolutionScale = scale;

	}

	updateAudio( dt ) {

		if ( ! this.audio || ! this.audio.enabled ) return;
		const cam = this.camera;
		const p = cam.position;
		const f = this._af || ( this._af = { fwd: new Vector3(), up: new Vector3() } );
		cam.getWorldDirection( f.fwd );
		f.up.set( 0, 1, 0 ).applyQuaternion( cam.quaternion );
		const h = this.cameraWaterHeight ?? 0;
		const coast = this.terrainData.coastDistance( p.x, p.z ).d;
		this.audio.update( dt, {
			listener: { position: p, forward: f.fwd, up: f.up },
			underwater: p.y < h ? 1 : 0,
			depthBelowSurface: Math.max( 0, h - p.y ),
			surfIntensity: Math.min( 1, this.shore.amplitude.value / 0.6 ),
			distanceToShore: Math.abs( coast ),
			coastDistance: coast,
			waveHeight: this.shore.amplitude.value * 2,
			windSpeed: G.windSpeed.value,
			windDir: G.windDir.value,
			daylight: 1 - G.night.value,
			nearPier: Math.abs( p.x - WORLD.pier.x ) < 12 && p.z > WORLD.pier.zStart - 5 && p.z < WORLD.pier.zEnd + 8,
			boat: {
				active: this.boatCtl.driven, rpm: this.boatCtl.rpm, throttle: this.boatCtl.throttle, speed: this.boatCtl.velocity.length(),
				position: this.boat.group.position, listenerInside: this.playerMode !== 'dolphin' && this.player.mode === 'boat' && this.player.camMode === 'first',
			},
		} );

	}

}
