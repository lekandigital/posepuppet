// Writes public/models/additions/CREDITS.md from manifest.json (the conversion's provenance
// record): one entry per runtime asset — title, author, source page, licence, the lab path on
// the asset server, source and output SHA-256, and the conversion recipe. Run after convert.mjs.
//
//   node credits.mjs [--dir ../../public/models/additions]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const argv = process.argv.slice( 2 );
const i = argv.indexOf( '--dir' );
const dir = resolve( i >= 0 ? argv[ i + 1 ] : '../../public/models/additions' );
const m = JSON.parse( readFileSync( join( dir, 'manifest.json' ), 'utf8' ) );
const LICENSE_URL = { 'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC-BY': 'https://creativecommons.org/licenses/by/4.0/' };
const bySource = new Map();
for ( const a of Object.values( m.assets ) ) {

	const p = a.provenance;
	const key = p.labId.replace( /--k-.*$/, '' );
	if ( ! bySource.has( key ) ) bySource.set( key, { p, assets: [] } );
	bySource.get( key ).assets.push( a );

}

let out = `# Imported scenery models — credits and provenance\n\n`;
out += `_Generated ${ m.generated } by \`tools/assets/credits.mjs\` from \`manifest.json\` (the record written by \`tools/assets/convert.mjs\`). ${ Object.keys( m.assets ).length } runtime assets from ${ bySource.size } source models. All sources are CC0 or CC-BY 4.0 as recorded by the user's model-lab (lab evidence: the licence class was read from the download's listing at intake; the live-listing check at release remains the user's step). CC-BY sources are attributed below and in the in-app credits (F1 sheet, \`?credits\`). Every GLB here is a derivative: baked rest pose, dropped parts, re-pivoted, rescaled, decimated into LODs, textures resized and re-encoded — see each entry's recipe and the notes._\n\n`;
out += `| runtime asset | title | author | licence | source page | lab source (asset server) | source SHA-256 | output SHA-256 | size | recipe |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for ( const a of Object.values( m.assets ) ) {

	const p = a.provenance, r = a.recipe;
	const lic = p.license ? `[${ p.license }](${ LICENSE_URL[ p.license ] || '' })` : 'unknown';
	const rec = [ `pivot ${ r.pivot }`, `×${ r.scale }`, r.dropNodes ? `drop nodes ${ r.dropNodes }` : null, r.dropMaterials ? `drop materials ${ r.dropMaterials }` : null, r.keepNodes ? `keep ${ r.keepNodes }` : null, r.simplify ? `simplify ${ JSON.stringify( r.simplify ) }` : null, r.simplifyByMaterial ? `simplify ${ JSON.stringify( r.simplifyByMaterial ) }` : null, `LODs ${ a.lods.map( ( l ) => l.tris ).join( ' / ' ) } tris` ].filter( Boolean ).join( '; ' );
	out += `| \`${ a.file }\` | ${ p.title } | ${ p.creator || '—' } | ${ lic } | ${ p.url ? `<${ p.url }>` : '—' } | \`${ p.labSource }\` | \`${ p.labSha256.slice( 0, 16 ) }…\` | \`${ a.sha256.slice( 0, 16 ) }…\` | ${ ( a.bytes / 1024 ).toFixed( 0 ) } KB · ${ a.bounds.size.map( ( v ) => v.toFixed( 1 ) ).join( ' × ' ) } m | ${ rec } |\n`;

}

out += `\n## Attribution lines (CC-BY sources)\n\n`;
for ( const { p, assets } of bySource.values() ) if ( p.license === 'CC-BY' ) out += `- **${ p.title }** by ${ p.creator } — CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: ${ p.url }. Modified for BodyArcade (runtime assets ${ assets.map( ( a ) => '`' + a.file + '`' ).join( ', ' ) }).\n`;
out += `\n## CC0 sources\n\n`;
for ( const { p, assets } of bySource.values() ) if ( p.license === 'CC0' ) out += `- **${ p.title }** by ${ p.creator } — CC0 (${ p.url }) → ${ assets.map( ( a ) => '`' + a.file + '`' ).join( ', ' ) }.\n`;
out += `\n## Notes\n\n`;
for ( const a of Object.values( m.assets ) ) if ( a.recipe.note ) out += `- \`${ a.file }\`: ${ a.recipe.note }.\n`;
out += `\nFull SHA-256 values are in \`manifest.json\`. The originals stay untouched on the asset server (\`/home/o/Downloads/models/…\`, catalogued in \`/home/o/model-lab/\`); the lab's normalised GLB of each source is the file at \`labSource\`.\n`;
writeFileSync( join( dir, 'CREDITS.md' ), out );
console.log( `CREDITS.md written: ${ Object.keys( m.assets ).length } assets, ${ bySource.size } sources` );
