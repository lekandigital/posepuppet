// DolphinAppUI — binds Tidewater's settings panel + HUD (vendor/tidewater/src/ui/UI.js,
// unmodified) to the dolphin app. Derived from Tidewater's src/ui/AppUI.js: every ocean /
// shore / sky / effects / performance control is identical (same objects, same ranges, same
// defaults — the panel edits the SAME Tidewater uniforms the pristine app exposes). Differences
// (CP10): a PLAY tab in front — play mode (Dolphin / Walking / Boat), the optional fishing
// activity, the dolphin's assist and body-input status, and the scenery-additions toggles
// (Original Tidewater / Enhanced); the Camera tab's boat-camera select shows in boat mode; the
// per-frame HUD shows the dolphin's state (swimming / surface / diving / airborne, tracking
// source) in dolphin mode and Tidewater's own walker / boat HUD (mode, prompts, boat gauges,
// depth) in the other modes.

import * as THREE from '../vendor/tidewater/src/engine/index.js';
import { UI } from '../vendor/tidewater/src/ui/UI.js';
import { G } from '../vendor/tidewater/src/core/Globals.js';
import { GroundBounce } from '../vendor/tidewater/src/materials/GroundBounce.js';
import { ADDITION_CATEGORIES } from './additions/SceneryAdditions.js';
import { BINDINGS, PROFILE_LABELS, CAMERA_STYLE_LABELS, PREF_RANGES } from './input/controlPrefs';

// (the dolphin's line follows the selected control scheme — see BINDINGS)
const MODE_CONTROLS = {
	walk: 'WASD move · mouse look (click the view) · Shift sprint · Space jump / swim up · C dive · E board the boat, climb ladders, talk',
	boat: 'W/S throttle · A/D steer · Shift boost · V helm / chase camera · E leave the helm, step ashore · mouse look',
};

const SEA = {
	Calm: { wind: 3.5, fetch: 40, chop: 0.75, swell: 0.28, surf: 0.18, period: 11, whitecaps: 0.2 },
	Breezy: { wind: 7, fetch: 120, chop: 0.9, swell: 0.48, surf: 0.34, period: 9, whitecaps: 0.5 },
	Choppy: { wind: 12, fetch: 300, chop: 1.05, swell: 0.68, surf: 0.56, period: 8.5, whitecaps: 0.75 },
	Storm: { wind: 20, fetch: 900, chop: 1.2, swell: 1.0, surf: 0.9, period: 12, whitecaps: 1 },
};

export class DolphinAppUI {

	constructor( app, ui = new UI() ) {

		this.app = app;
		this.ui = ui;
		const fft = app.fft;
		const shore = app.shore;

		const s = this.s = {
			wind: fft.local.windSpeed,
			windDir: fft.local.windDirection,
			fetch: fft.local.fetch,
			chop: fft.choppiness.value,
			swell: fft.swell.scale,
			whitecaps: 0.5,
			clarity: 1,
			surf: shore.amplitude.value,
			period: shore.period.value,
			gamma: shore.gamma.value,
			curl: shore.curl.value,
			caustics: app.caustics ? app.caustics.strength.value : 1,
			time: app.settings.timeOfDay,
			advance: app.settings.timeSpeed !== 0,
			timeSpeed: app.settings.timeSpeed || 0.05,
			clouds: app.clouds ? app.clouds.coverage.value : 0.45,
			cirrus: app.clouds && app.clouds.cirrus ? app.clouds.cirrus.value : 0.5,
			exposure: 0,
			fov: app.camera.fov,
			ao: app.post.params.aoStrength.value,
			bloom: app.post.params.bloom.value,
			flare: app.post.flare ? app.post.flare.strength.value : 1,
			vignette: app.post.params.vignette.value,
			saturation: app.post.params.saturation.value,
			contrast: app.post.params.contrast.value,
			grain: app.post.params.grain.value,
			renderScale: app.settings.renderScale,
			shadows: true,
			// CP10 continuation: play tab state
			mode: app.displayedMode,
			fishing: app.fishing,
			assist: app.dolphin ? app.dolphin.sim.assist : 'full',
			swellRide: app.dolphin ? app.dolphin.opts.swellRide : true,
			controlProfile: app.dolphin ? app.dolphin.controls.prefs().profile : 'ecco',
			inputSource: app.dolphin ? app.dolphin.controls.prefs().inputSource : 'auto',
			invertY: app.dolphin ? app.dolphin.controls.prefs().invertY : false,
			steerSensitivity: app.dolphin ? app.dolphin.controls.prefs().steerSensitivity : 1,
			lookSensitivity: app.dolphin ? app.dolphin.controls.prefs().lookSensitivity : 1,
			cameraStyle: app.dolphin ? app.dolphin.rig.getStyle() : 'follow',
			cameraDistance: app.dolphin ? app.dolphin.controls.prefs().cameraDistance : 1,
			chaseFov: app.dolphin ? app.dolphin.controls.prefs().fov : 55,
			camMode: app.player ? app.player.camMode : 'third',
			environment: app.additions && app.additions.anyOn ? 'enhanced' : 'original',
		};

		// ---------------------------------------------------------------- Play (CP10 continuation)
		const play = ui.addTab( 'play', 'Play', 'play' );
		const who = play.addFolder( 'Player', { icon: 'swim' } );
		this.modeCtl = who.addSelect( {
			label: 'Mode', object: s, key: 'mode', segmented: true,
			tooltip: 'Who you are in the same running island: the BodyArcade dolphin (default), Tidewater\'s walker, or Tidewater\'s boat at the helm. Switching never reloads the world.',
			options: [ { label: 'Dolphin', value: 'dolphin' }, { label: 'Walking', value: 'walk' }, { label: 'Boat', value: 'boat' } ],
			onChange: ( v ) => { if ( ! app.setPlayerMode( v ) ) s.mode = app.displayedMode; },
		} );
		who.addButton( { label: 'Return to the dolphin', icon: 'swim', onClick: () => app.setPlayerMode( 'dolphin' ) } );
		who.addInfo( { label: 'Controls', get: () => app.displayedMode === 'dolphin' ? BINDINGS[ s.controlProfile ].short : MODE_CONTROLS[ app.displayedMode ] } );
		const fish = play.addFolder( 'Fishing', { icon: 'anchor' } );
		fish.addToggle( {
			label: 'Fishing gameplay', object: s, key: 'fishing',
			tooltip: 'Tidewater\'s fishing: the rod (R), casting, bites and the fight, the cooler and log (I), Joe\'s fish stand and Marta\'s chandlery. Needs Walking or Boat — never in Dolphin mode.',
			onChange: ( v ) => app.setFishing( v ),
		} );
		fish.addInfo( { label: 'Where', get: () => ! app.fishing ? 'Off (default)' : app.playerMode === 'dolphin' ? 'On — switch to Walking or Boat to fish' : 'On — R takes out the rod, I opens the cooler' } );
		const dol = play.addFolder( 'Dolphin', { icon: 'swim', open: false } );
		dol.addSelect( { label: 'Assist', object: s, key: 'assist', segmented: true, tooltip: 'Full: auto-level and drift help. Standard. Expert: you hold every angle.', options: [ { label: 'Full', value: 'full' }, { label: 'Standard', value: 'standard' }, { label: 'Expert', value: 'expert' } ], onChange: ( v ) => { if ( app.dolphin ) app.dolphin.sim.assist = v; } } );
		dol.addToggle( { label: 'Ride the swell', object: s, key: 'swellRide', tooltip: 'Presentation only: near the surface the rendered dolphin lifts with the measured wave height so it sits in Tidewater\'s actual swell. The chase camera does not ride the wave — waves cross the lens. The deterministic sim is untouched.', onChange: ( v ) => { if ( app.dolphin ) app.dolphin.opts.swellRide = v; } } );
		const ctl = play.addFolder( 'Dolphin Controls', { icon: 'keyboard' } );
		ctl.addSelect( {
			label: 'Scheme', object: s, key: 'controlProfile', segmented: true,
			tooltip: 'Modern (default, Ecco-inspired): hold Space to swim and tap it for a stroke, Shift charges, X brakes, WASD steers in 3D. Legacy BodyArcade: the older Shift-to-kick mapping with Space as burst and Q/E depth trim.',
			options: [ { label: PROFILE_LABELS.ecco, value: 'ecco' }, { label: PROFILE_LABELS.legacy, value: 'legacy' } ],
			onChange: ( v ) => app.dolphin && app.dolphin.controls.setPrefs( { profile: v } ),
		} );
		ctl.addSelect( {
			label: 'Input', object: s, key: 'inputSource', segmented: true,
			tooltip: 'Auto: whichever you touched last owns the dolphin — keyboard or gamepad — and PosePuppet body tracking when neither is live. Camera keys and mouse look never take control away from a pad.',
			options: [ { label: 'Auto', value: 'auto' }, { label: 'Keyboard', value: 'keyboard' }, { label: 'Gamepad', value: 'gamepad' }, { label: 'Body', value: 'body' } ],
			onChange: ( v ) => app.dolphin && app.dolphin.controls.setPrefs( { inputSource: v } ),
		} );
		ctl.addSelect( {
			label: 'Camera style', object: s, key: 'cameraStyle', segmented: true,
			tooltip: 'Follow stays close behind you; swimming shallow, the lens sits just under the surface and the waves cross it. Remote is looser and more cinematic. Surface puts the lens just above the waterline — the swimmer\'s eye. V cycles these; all three are Tidewater\'s own split-waterline rendering.',
			options: [ { label: CAMERA_STYLE_LABELS.follow, value: 'follow' }, { label: CAMERA_STYLE_LABELS.remote, value: 'remote' }, { label: CAMERA_STYLE_LABELS.scenic, value: 'scenic' } ],
			onChange: ( v ) => app.dolphin && app.dolphin.setCameraStyle( v ),
		} );
		ctl.addToggle( { label: 'Invert vertical', object: s, key: 'invertY', tooltip: 'Flips dive / climb on keyboard W/S and the left stick (default: W and stick-forward nose down, as in Ecco).', onChange: ( v ) => app.dolphin && app.dolphin.controls.setPrefs( { invertY: v } ) } );
		ctl.addSlider( { label: 'Steering sensitivity', object: s, key: 'steerSensitivity', min: PREF_RANGES.steerSensitivity[ 0 ], max: PREF_RANGES.steerSensitivity[ 1 ], step: 0.05, tooltip: 'Stick response; below 1 it also softens keyboard steering.', onChange: ( v ) => app.dolphin && app.dolphin.controls.setPrefs( { steerSensitivity: v } ) } );
		ctl.addSlider( { label: 'Look sensitivity', object: s, key: 'lookSensitivity', min: PREF_RANGES.lookSensitivity[ 0 ], max: PREF_RANGES.lookSensitivity[ 1 ], step: 0.05, tooltip: 'Mouse drag and right-stick look.', onChange: ( v ) => app.dolphin && app.dolphin.controls.setPrefs( { lookSensitivity: v } ) } );
		ctl.addSlider( { label: 'Camera distance', object: s, key: 'cameraDistance', min: PREF_RANGES.cameraDistance[ 0 ], max: PREF_RANGES.cameraDistance[ 1 ], step: 0.05, tooltip: 'Scales how far the chase camera sits behind the dolphin.', onChange: ( v ) => { if ( app.dolphin ) { app.dolphin.controls.setPrefs( { cameraDistance: v } ); app.dolphin.applyControlPrefs(); } } } );
		ctl.addSlider( { label: 'Chase field of view', object: s, key: 'chaseFov', min: PREF_RANGES.fov[ 0 ], max: PREF_RANGES.fov[ 1 ], step: 1, unit: '°', tooltip: 'The chase camera\'s vertical lens (55° default). Walking, the boat and the free camera keep Tidewater\'s 62°.', onChange: ( v ) => { if ( app.dolphin ) { app.dolphin.controls.setPrefs( { fov: v } ); app.dolphin.applyControlPrefs(); } } } );
		ctl.addInfo( { label: 'Keyboard', get: () => BINDINGS[ s.controlProfile ].keyboard } );
		ctl.addInfo( { label: 'Gamepad', get: () => ( app.dolphin && app.dolphin.controls.hudState().padConnected ? 'Connected · ' : 'None detected · ' ) + BINDINGS[ s.controlProfile ].gamepad } );
		dol.addInfo( { label: 'Body input', get: () => {

			if ( ! app.dolphin ) return '—';
			const t = app.dolphin.state().tracking;
			return t === 'live' ? 'Live (PosePuppet)' : t === 'keyboard' ? 'Keyboard' : t === 'none' ? 'Listening — none received (keyboard works)' : `Lost (${ t }) — gliding`;

		} } );
		dol.addButton( { label: 'Recenter chase camera (R)', icon: 'camera', onClick: () => app.dolphin && app.dolphin.rig.recenter() } );
		if ( app.additions ) {

			const add = play.addFolder( 'Scenery additions', { icon: 'layers' } );
			add.addSelect( {
				label: 'Environment', object: s, key: 'environment', segmented: true,
				tooltip: 'Original: exactly the pristine Tidewater scene. Enhanced: the optional additions below (all made of assets already in Tidewater, Poly Haven CC0). Compare freely; nothing of the original is changed either way.',
				options: [ { label: 'Original Tidewater', value: 'original' }, { label: 'Enhanced', value: 'enhanced' } ],
				onChange: ( v ) => { app.additions.setAll( v === 'enhanced' ); for ( const c of ADDITION_CATEGORIES ) s[ 'add_' + c.id ] = v === 'enhanced'; ui.refresh(); },
			} );
			for ( const c of ADDITION_CATEGORIES ) {

				s[ 'add_' + c.id ] = !! app.additions.enabled[ c.id ];
				add.addToggle( { label: c.label, object: s, key: 'add_' + c.id, tooltip: c.tooltip, onChange: ( v ) => { app.additions.setCategory( c.id, v ); s.environment = app.additions.anyOn ? 'enhanced' : 'original'; ui.refresh(); } } );

			}

			add.addInfo( { label: 'Instances', get: () => { const st = app.additions.stats().categories; return ADDITION_CATEGORIES.map( ( c ) => `${ c.label.split( ' ' )[ 1 ] || c.label } ${ st[ c.id ] ? st[ c.id ].instances : 0 }` ).join( ' · ' ); } } );

		}

		app.onPlayerMode = ( mode ) => {

			s.mode = app.displayedMode;
			s.camMode = app.player.camMode;
			if ( this.camModeCtl ) this.camModeCtl.setVisible( mode === 'boat' );
			ui.refresh();
			ui.toast( mode === 'dolphin' ? ( s.controlProfile === 'legacy' ? 'Dolphin · Shift to kick, Space to burst' : 'Dolphin · hold Space to swim' ) : mode === 'walk' ? 'Walking · click the view to look around' : 'Boat · at the helm — W throttle, A/D steer, V camera' );

		};

		const spectrum = () => {

			fft.local.windSpeed = s.wind;
			fft.local.windDirection = s.windDir;
			fft.local.fetch = s.fetch;
			fft.swell.scale = s.swell;
			fft.updateSpectrumUniforms();
			const a = THREE.MathUtils.degToRad( s.windDir );
			G.windDir.value.set( Math.cos( a ), Math.sin( a ) );
			G.windSpeed.value = s.wind;

		};

		const whitecaps = () => {

			fft.foamBias.value = 0.5 + 0.16 * s.whitecaps + 0.01 * THREE.MathUtils.clamp( s.wind - 7, - 5, 12 );
			fft.foamDecay.value = 0.6 - 0.35 * s.whitecaps;

		};

		const clarity = () => {

			const k = 1 / Math.max( 0.2, s.clarity );
			G.waterAbsorption.value.set( 0.42, 0.075, 0.035 ).multiplyScalar( 0.6 + 0.4 * k );
			G.waterScattering.value.set( 0.012, 0.018, 0.024 ).multiplyScalar( k * k );

		};

		// ---------------------------------------------------------------- Ocean
		const ocean = ui.addTab( 'ocean', 'Ocean', 'ocean' );
		const sea = ocean.addFolder( 'Sea state', { icon: 'wind' } );
		sea.addPresets( {
			label: 'Conditions', active: 'Breezy',
			presets: Object.keys( SEA ).map( ( k ) => ( {
				label: k, icon: k.toLowerCase(),
				apply: () => {

					const p = SEA[ k ];
					Object.assign( s, p );
					spectrum();
					whitecaps();
					fft.choppiness.value = s.chop;
					shore.amplitude.value = s.surf;
					shore.period.value = s.period;

				},
			} ) ),
		} );
		sea.addSlider( { label: 'Wind speed', object: s, key: 'wind', min: 0.5, max: 30, step: 0.1, unit: 'm/s', tooltip: 'Wind 10 m above the sea. Drives the local wind waves, whitecaps and spray.', onChange: () => {

			spectrum();
			whitecaps();

		} } );
		sea.addSlider( { label: 'Wind direction', object: s, key: 'windDir', min: 0, max: 360, step: 1, unit: '°', onChange: spectrum } );
		sea.addSlider( { label: 'Fetch', object: s, key: 'fetch', min: 5, max: 2000, log: true, unit: 'km', tooltip: 'Distance the wind has blown over open water: longer fetch, longer and higher waves.', onChange: spectrum } );
		sea.addSlider( { label: 'Choppiness', object: s, key: 'chop', min: 0, max: 1.6, step: 0.01, tooltip: 'Horizontal displacement: sharp crests, wide troughs.', onChange: ( v ) => { fft.choppiness.value = v; } } );
		sea.addSlider( { label: 'Ocean swell', object: s, key: 'swell', min: 0, max: 2, step: 0.01, onChange: spectrum } );
		sea.addSlider( { label: 'Whitecaps', object: s, key: 'whitecaps', min: 0, max: 1, step: 0.01, onChange: whitecaps } );
		const water = ocean.addFolder( 'Water', { icon: 'droplet' } );
		water.addSlider( { label: 'Clarity', object: s, key: 'clarity', min: 0.3, max: 2, step: 0.01, tooltip: 'Lower = more suspended sediment and plankton (greener, murkier).', onChange: clarity } );

		// ---------------------------------------------------------------- Shore
		const shoreTab = ui.addTab( 'shore', 'Shore', 'shore' );
		const surf = shoreTab.addFolder( 'Surf', { icon: 'wave' } );
		surf.addSlider( { label: 'Wave height', object: s, key: 'surf', min: 0, max: 1.4, step: 0.01, unit: 'm', format: ( v ) => `${ ( v * 2 ).toFixed( 2 ) } m`, onChange: ( v ) => { shore.amplitude.value = v; } } );
		surf.addSlider( { label: 'Wave period', object: s, key: 'period', min: 5, max: 16, step: 0.1, unit: 's', onChange: ( v ) => { shore.period.value = v; } } );
		surf.addSlider( { label: 'Breaking depth ratio', object: s, key: 'gamma', min: 0.5, max: 1.1, step: 0.01, tooltip: 'Waves break when height exceeds this fraction of the depth.', onChange: ( v ) => { shore.gamma.value = v; } } );
		surf.addSlider( { label: 'Curl', object: s, key: 'curl', min: 0, max: 1.5, step: 0.01, onChange: ( v ) => { shore.curl.value = v; } } );
		if ( app.breakers ) {

			s.spray = app.breakers.params.spray.value;
			s.lip = app.breakers.params.sheet.value;
			surf.addSlider( { label: 'Spray', object: s, key: 'spray', min: 0, max: 2, step: 0.01, tooltip: 'Droplets and mist thrown off breaking crests.', onChange: ( v ) => { app.breakers.params.spray.value = v; } } );
			surf.addSlider( { label: 'Lip sheet', object: s, key: 'lip', min: 0, max: 1.5, step: 0.01, tooltip: 'The thin sheet of water thrown forward by plunging breakers.', onChange: ( v ) => { app.breakers.params.sheet.value = v; } } );

		}

		if ( app.wake ) {

			const boat = shoreTab.addFolder( 'Boat wake', { icon: 'wave', open: false } );
			s.wakeHeight = app.wake.amplitude.value;
			s.wakeFoam = app.wake.foamGain.value;
			boat.addSlider( { label: 'Wake height', object: s, key: 'wakeHeight', min: 0, max: 2, step: 0.01, onChange: ( v ) => { app.wake.amplitude.value = v; } } );
			boat.addSlider( { label: 'Wake foam', object: s, key: 'wakeFoam', min: 0, max: 1.5, step: 0.01, onChange: ( v ) => { app.wake.foamGain.value = v; } } );

		}
		if ( app.caustics ) {

			const light = shoreTab.addFolder( 'Caustics', { icon: 'sun', open: false } );
			light.addSlider( { label: 'Intensity', object: s, key: 'caustics', min: 0, max: 2, step: 0.01, onChange: ( v ) => { app.caustics.strength.value = v; } } );

		}

		// ---------------------------------------------------------------- Sky
		const sky = ui.addTab( 'sky', 'Sky', 'sky' );
		const sun = sky.addFolder( 'Sun', { icon: 'clock' } );
		sun.addTimeOfDay( { object: app.settings, key: 'timeOfDay' } );
		sun.addSlider( { label: 'Sun azimuth', object: app.settings, key: 'sunAzimuth', min: - 180, max: 180, step: 1, format: ( v ) => `${ Math.round( v ) }°`, tooltip: 'Turns the sun\'s path around the island (0 = the real path: rises in the east, sets in the west).' } );
		let speed = null;
		sun.addToggle( { label: 'Advance time', object: s, key: 'advance', onChange: ( v ) => {

			app.settings.timeSpeed = v ? s.timeSpeed : 0;
			speed.setVisible( v );

		} } );
		speed = sun.addSlider( { label: 'Time speed', object: s, key: 'timeSpeed', min: 0.002, max: 1, log: true, unit: 'h/s', onChange: ( v ) => { if ( s.advance ) app.settings.timeSpeed = v; } } ).setVisible( s.advance );
		const atmo = sky.addFolder( 'Atmosphere', { icon: 'cloud' } );
		if ( app.clouds ) atmo.addSlider( { label: 'Cloud cover', object: s, key: 'clouds', min: 0, max: 1, step: 0.01, format: ( v ) => `${ Math.round( v * 100 ) }%`, onChange: ( v ) => { app.clouds.coverage.value = v; } } );
		if ( app.clouds && app.clouds.cirrus ) atmo.addSlider( { label: 'Cirrus', object: s, key: 'cirrus', min: 0, max: 1, step: 0.01, format: ( v ) => `${ Math.round( v * 100 ) }%`, onChange: ( v ) => { app.clouds.cirrus.value = v; } } );
		if ( app.haze ) {

			s.haze = app.haze.density.value;
			s.shafts = app.haze.shafts.value;
			atmo.addSlider( { label: 'Haze', object: s, key: 'haze', min: 0, max: 4, step: 0.05, tooltip: 'Aerial perspective and marine haze density (1 = about 20 km visibility at sea level, 0 = clear air).', onChange: ( v ) => { app.haze.density.value = v; } } );
			atmo.addSlider( { label: 'Sun shafts', object: s, key: 'shafts', min: 0, max: 3, step: 0.05, tooltip: 'Volumetric light shafts and crepuscular rays in the haze (shadows of palms, the pier, hills and clouds). 0 turns them off.', onChange: ( v ) => { app.haze.shafts.value = v; } } );

		}
		if ( app.airMotes ) {

			s.air = app.airMotes.intensity.value;
			atmo.addSlider( { label: 'Air particles', object: s, key: 'air', min: 0, max: 2, step: 0.01, tooltip: 'Dust, pollen, salt haze, seed fluff and the odd gnat drifting in the air: they catch the light when backlit by the sun. 0 turns them off.', onChange: ( v ) => { app.airMotes.intensity.value = v; } } );

		}

		atmo.addSlider( { label: 'Exposure', object: s, key: 'exposure', min: - 3, max: 3, step: 0.1, unit: 'EV', onChange: ( v ) => { app.settings.exposure = 0.55 * Math.pow( 2, v ); } } );

		// ---------------------------------------------------------------- Camera
		// CP10: the boat-camera select (Tidewater's) shows in boat mode. The field-of-view slider
		// edits the live lens (the chase rig's 55° while following, Tidewater's 62° for the free
		// camera and its player).
		const cam = ui.addTab( 'camera', 'Camera', 'camera' );
		const view = cam.addFolder( 'View', { icon: 'camera' } );
		this.camModeCtl = view.addSelect( { label: 'Boat camera', object: s, key: 'camMode', options: [ { label: '1st person', value: 'first' }, { label: '3rd person', value: 'third' } ], onChange: ( v ) => { app.player.camMode = v; } } ).setVisible( app.displayedMode === 'boat' );
		view.addSlider( { label: 'Field of view', object: s, key: 'fov', min: 35, max: 100, step: 1, unit: '°', onChange: ( v ) => {

			app.camera.fov = v;
			app.camera.updateProjectionMatrix();

		} } );
		view.addButton( { label: 'Free camera (F)', icon: 'camera', onClick: () => app.setFreeCam( ! app.freeCam ) } );
		view.addButton( { label: 'Recenter chase camera (R)', icon: 'camera', onClick: () => app.dolphin && app.dolphin.rig.recenter() } );

		// ---------------------------------------------------------------- Effects
		const fx = ui.addTab( 'effects', 'Effects', 'effects' );
		const post = fx.addFolder( 'Post-processing', { icon: 'sparkles' } );
		const P = app.post.params;
		post.addSlider( { label: 'Ambient occlusion', object: s, key: 'ao', min: 0, max: 1.5, step: 0.01, onChange: ( v ) => { P.aoStrength.value = v; } } );
		s.bounce = GroundBounce.strength.value;
		post.addSlider( { label: 'Bounce light', object: s, key: 'bounce', min: 0, max: 2, step: 0.01, tooltip: 'Sunlight reflected off the ground (bright sand) onto undersides and shaded faces: pier, eaves, hulls, trunks. 0 = off.', onChange: ( v ) => { GroundBounce.strength.value = v; } } );
		s.sharpen = P.sharpen.value;
		post.addSlider( { label: 'Sharpen', object: s, key: 'sharpen', min: 0, max: 1, step: 0.01, tooltip: 'Contrast-adaptive sharpening after the temporal anti-aliasing.', onChange: ( v ) => { P.sharpen.value = v; } } );
		if ( app.post.motionBlur ) {

			const mb = app.post.motionBlur.shutter;
			s.motionBlur = mb.value;
			post.addSlider( { label: 'Motion blur', object: s, key: 'motionBlur', min: 0, max: 1, step: 0.05, format: ( v ) => v > 0 ? `${ Math.round( v * 360 ) }°` : 'Off', tooltip: 'Camera and object motion blur, as a shutter angle (180° = film look). 0 turns it off.', onChange: ( v ) => { mb.value = v; } } );

		}

		post.addSlider( { label: 'Bloom', object: s, key: 'bloom', min: 0, max: 0.3, step: 0.005, onChange: ( v ) => { P.bloom.value = v; } } );
		if ( app.post.flare ) post.addSlider( { label: 'Lens flare', object: s, key: 'flare', min: 0, max: 2, step: 0.05, onChange: ( v ) => { app.post.flare.strength.value = v; } } );
		post.addSlider( { label: 'Saturation', object: s, key: 'saturation', min: 0.5, max: 1.5, step: 0.01, onChange: ( v ) => { P.saturation.value = v; } } );
		post.addSlider( { label: 'Contrast', object: s, key: 'contrast', min: 0.8, max: 1.3, step: 0.01, onChange: ( v ) => { P.contrast.value = v; } } );
		post.addSlider( { label: 'Vignette', object: s, key: 'vignette', min: 0, max: 1, step: 0.01, onChange: ( v ) => { P.vignette.value = v; } } );
		post.addSlider( { label: 'Film grain', object: s, key: 'grain', min: 0, max: 0.06, step: 0.001, onChange: ( v ) => { P.grain.value = v; } } );

		// ---------------------------------------------------------------- Performance
		const perf = ui.addTab( 'performance', 'Performance', 'performance' );
		const live = perf.addFolder( 'Live', { icon: 'gauge' } );
		live.addInfo( { label: 'Frame rate', get: () => `${ ( app.fps || 0 ).toFixed( 0 ) } fps` } );
		live.addInfo( { label: 'CPU per frame', get: () => `${ ( app.cpuMs || 0 ).toFixed( 2 ) } ms` } );
		live.addInfo( { label: 'Render size', get: () => `${ app.sceneRenderer.width } × ${ app.sceneRenderer.height }` } );
		live.addInfo( { label: 'Sim rate', get: () => app.dolphin ? `${ app.dolphin.state().simHz.toFixed( 0 ) } Hz` : '—' } );
		const quality = perf.addFolder( 'Quality', { icon: 'layers' } );
		quality.addSlider( { label: 'Render scale', object: s, key: 'renderScale', min: 0.5, max: 1, step: 0.05, format: ( v ) => `${ Math.round( v * 100 ) }%`, tooltip: 'Internal resolution; the temporal upscaler reconstructs the full output resolution.', onChange: ( v ) => app.setRenderScale( v ) } );
		s.aa = app.post.aaMode === 'none' ? 0 : app.post.taau.jitterPhaseOverride;
		quality.addSelect( { label: 'Anti-aliasing', object: s, key: 'aa', tooltip: 'Temporal anti-aliasing: each pixel averages this many sub-pixel sample positions over successive frames (it also smooths dithered fades and shadow noise). More samples cost nothing per frame but take a few more frames to settle.', options: [ { label: 'Off', value: 0 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 } ], onChange: ( v ) => {

			const n = Number( v );
			app.post.aaMode = n > 0 ? 'taa' : 'none';
			if ( n > 0 ) app.post.taau.jitterPhaseOverride = n;

		} } );
		quality.addToggle( { label: 'Shadows', object: s, key: 'shadows', onChange: ( v ) => { app.shadows.enabled = v; } } );
		s.ssr = true;
		quality.addToggle( { label: 'Water reflections', object: s, key: 'ssr', tooltip: 'Screen-space reflections of the pier, boats and hills on the water.', onChange: ( v ) => { app.waterMaterial.params.ssr.value = v ? 1 : 0; } } );

		this._t = 0;

	}

	// per-frame HUD
	update( dt ) {

		const app = this.app;
		const ui = this.ui;
		ui.setStats( { fps: app.fps, frameMs: dt * 1000 } );
		this.s.renderScale = app.post.scale;
		this.s.fov = app.camera.fov;
		this.s.mode = app.displayedMode;
		this.s.fishing = app.fishing;
		if ( app.dolphin ) {
			this.s.assist = app.dolphin.sim.assist;
			this.s.cameraStyle = app.dolphin.rig.getStyle();
			this.s.controlProfile = app.dolphin.controls.prefs().profile;
		}
		if ( app.player && this.s.camMode !== app.player.camMode ) this.s.camMode = app.player.camMode;

		if ( app.freeCam ) {

			ui.setMode( 'Free camera' );
			ui.setPrompt( 'F', app.playerMode === 'dolphin' ? 'Back to the dolphin' : 'Walk' );
			ui.setBoatGauges( { visible: false } );
			ui.setDepth( { visible: false } );
			return;

		}

		if ( app.playerMode !== 'dolphin' ) {

			// Tidewater's own walker / boat HUD (AppUI.update verbatim)
			const p = app.player;
			const mode = p.mode === 'boat' ? `Boat · ${ p.camMode === 'first' ? '1st' : '3rd' } person`
				: p.mode === 'deck' ? 'On deck'
				: p.mode === 'swim' ? ( app.camera.position.y < ( app.cameraWaterHeight ?? 0 ) - 0.3 ? 'Diving' : 'Swimming' ) : 'Walking';
			ui.setMode( mode );
			if ( p.prompt ) ui.setPrompt( p.prompt.key, p.prompt.text );
			else ui.setPrompt( null );
			const b = app.boatCtl;
			if ( p.mode === 'boat' ) {

				const f = b.forward( new THREE.Vector3() );
				ui.setBoatGauges( {
					visible: true,
					throttle: b.throttle,
					rpm: b.rpm,
					speedKnots: b.speed * 1.94384,
					heading: ( THREE.MathUtils.radToDeg( Math.atan2( f.x, - f.z ) ) + 360 ) % 360,
				} );

			} else ui.setBoatGauges( { visible: false } );

			const depth = ( app.cameraWaterHeight ?? 0 ) - app.camera.position.y;
			ui.setDepth( { visible: p.mode === 'swim' && depth > 0.3, meters: depth } );
			return;

		}

		ui.setBoatGauges( { visible: false } );
		const d = app.dolphin;
		if ( ! d ) return;
		const st = d.state();
		const under = app.camera.position.y < ( app.cameraWaterHeight ?? 0 ) - 0.3;
		const mode = st.phase === 'air' ? 'Dolphin · airborne'
			: st.y > - 0.8 ? 'Dolphin · at the surface'
			: under ? 'Dolphin · diving' : 'Dolphin · swimming';
		ui.setMode( mode );
		const tr = st.tracking;
		if ( tr === 'autopilot' || tr === 'stale' || tr === 'low-confidence' ) ui.setPrompt( '…', 'Body tracking lost · gliding until it returns (keyboard always works)' );
		else if ( tr === 'live' ) ui.setPrompt( '●', 'Body input live' );
		else if ( tr === 'gamepad' ) ui.setPrompt( 'RT', this.s.controlProfile === 'legacy' ? 'A kicks · B bursts · left stick steers' : 'RT or A swims · LB or B charges · LT brakes · left stick steers' );
		else ui.setPrompt( null );

		const depth = ( app.cameraWaterHeight ?? 0 ) - app.camera.position.y;
		ui.setDepth( { visible: depth > 0.3, meters: depth } );

	}

}
