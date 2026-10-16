// BodyArcade Tidewater Dolphin — boot (Checkpoint 10). Derived from Tidewater's src/main.js:
// the same loader / UI / bench flow, with DolphinApp in place of App and DolphinAppUI in
// place of AppUI. The start overlay's click no longer requests pointer lock (no mouse look).

import '../vendor/tidewater/src/core/BenchSeed.js';
import { DolphinApp } from './DolphinApp.js';
import { UI } from '../vendor/tidewater/src/ui/UI.js';
import { DolphinAppUI } from './DolphinAppUI.js';
import { installCredits } from './credits';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? ( setTimeout( () => cb( performance.now() ), 16 ) as unknown as number ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new UI();
const app = new DolphinApp();
( window as unknown as { __ui: UI } ).__ui = ui;
installCredits( ui );

app.init( ( ( p: number, text: string, until?: number ) => ui.setLoading( p, text, until ) ) as () => void ).then( async () => {

	app.ui = new DolphinAppUI( app, ui );
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	// frame-time benchmark and reference shots (Tidewater's core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		const { Bench } = await import( '../vendor/tidewater/src/core/Bench.js' );
		const w = window as unknown as { __bench: unknown; __job: unknown };
		const bench = new Bench( app );
		w.__bench = bench;
		if ( app.qs.has( 'auto' ) ) w.__job = bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) w.__job = bench.shots( app.qs.get( 'shots' )!.split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	ui.showStartOverlay( () => {

		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e: Error ) => {

	console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
