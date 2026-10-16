// Minimal PNG codec for the CP10 evidence pipeline (no dependencies).
// encodePNG: 8-bit RGB(A) rows, filter 0, zlib deflate. decodePNG: reads the
// PNGs this codec (or any non-interlaced 8-bit RGB/RGBA, filter 0..4) wrote.

import { deflateSync, inflateSync } from 'node:zlib';

const CRC = new Int32Array( 256 );
for ( let n = 0; n < 256; n ++ ) {

	let c = n;
	for ( let k = 0; k < 8; k ++ ) c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
	CRC[ n ] = c;

}

function crc32( buf ) {

	let c = - 1;
	for ( let i = 0; i < buf.length; i ++ ) c = CRC[ ( c ^ buf[ i ] ) & 0xff ] ^ ( c >>> 8 );
	return ( c ^ - 1 ) >>> 0;

}

function chunk( type, data ) {

	const out = Buffer.alloc( 12 + data.length );
	out.writeUInt32BE( data.length, 0 );
	out.write( type, 4, 'ascii' );
	data.copy( out, 8 );
	out.writeUInt32BE( crc32( out.subarray( 4, 8 + data.length ) ), 8 + data.length );
	return out;

}

// pixels: Uint8Array RGB (channels 3) or RGBA (channels 4), top row first
export function encodePNG( width, height, pixels, channels = 3 ) {

	const stride = width * channels;
	const raw = Buffer.alloc( ( stride + 1 ) * height );
	for ( let y = 0; y < height; y ++ ) {

		raw[ y * ( stride + 1 ) ] = 0;
		raw.set( pixels.subarray( y * stride, ( y + 1 ) * stride ), y * ( stride + 1 ) + 1 );

	}

	const ihdr = Buffer.alloc( 13 );
	ihdr.writeUInt32BE( width, 0 );
	ihdr.writeUInt32BE( height, 4 );
	ihdr[ 8 ] = 8;
	ihdr[ 9 ] = channels === 4 ? 6 : 2;
	ihdr[ 10 ] = 0; ihdr[ 11 ] = 0; ihdr[ 12 ] = 0;
	return Buffer.concat( [
		Buffer.from( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] ),
		chunk( 'IHDR', ihdr ),
		chunk( 'IDAT', deflateSync( raw, { level: 6 } ) ),
		chunk( 'IEND', Buffer.alloc( 0 ) ),
	] );

}

// returns { width, height, channels, data: Uint8Array }
export function decodePNG( buf ) {

	if ( buf.readUInt32BE( 0 ) !== 0x89504e47 ) throw new Error( 'not a PNG' );
	let o = 8, width = 0, height = 0, channels = 3, depth = 8;
	const idat = [];
	while ( o < buf.length ) {

		const len = buf.readUInt32BE( o ), type = buf.toString( 'ascii', o + 4, o + 8 );
		const data = buf.subarray( o + 8, o + 8 + len );
		if ( type === 'IHDR' ) {

			width = data.readUInt32BE( 0 ); height = data.readUInt32BE( 4 ); depth = data[ 8 ];
			channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ data[ 9 ] ];
			if ( depth !== 8 || data[ 12 ] !== 0 ) throw new Error( 'unsupported PNG (need 8-bit, non-interlaced)' );

		} else if ( type === 'IDAT' ) idat.push( data );
		o += 12 + len;

	}

	const raw = inflateSync( Buffer.concat( idat ) );
	const stride = width * channels, bpp = channels;
	const out = new Uint8Array( stride * height );
	let prev = new Uint8Array( stride );
	for ( let y = 0; y < height; y ++ ) {

		const f = raw[ y * ( stride + 1 ) ];
		const row = raw.subarray( y * ( stride + 1 ) + 1, ( y + 1 ) * ( stride + 1 ) );
		const cur = out.subarray( y * stride, ( y + 1 ) * stride );
		for ( let i = 0; i < stride; i ++ ) {

			const a = i >= bpp ? cur[ i - bpp ] : 0, b = prev[ i ], c = i >= bpp ? prev[ i - bpp ] : 0;
			let v = row[ i ];
			if ( f === 1 ) v += a; else if ( f === 2 ) v += b; else if ( f === 3 ) v += ( a + b ) >> 1;
			else if ( f === 4 ) { const p = a + b - c, pa = Math.abs( p - a ), pb = Math.abs( p - b ), pc = Math.abs( p - c ); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
			cur[ i ] = v & 0xff;

		}

		prev = cur;

	}

	return { width, height, channels, data: out };

}

// Tidewater Bench upload: 8-byte header (u32 width, u32 height) + BGRA8 rows → RGB PNG buffer
export function bgraUploadToPNG( body ) {

	const w = body.readUInt32LE( 0 ), h = body.readUInt32LE( 4 );
	const px = body.subarray( 8 );
	const rgb = new Uint8Array( w * h * 3 );
	for ( let i = 0, j = 0; i < w * h * 4; i += 4, j += 3 ) {

		rgb[ j ] = px[ i + 2 ]; rgb[ j + 1 ] = px[ i + 1 ]; rgb[ j + 2 ] = px[ i ];

	}

	return { width: w, height: h, rgb, png: encodePNG( w, h, rgb, 3 ) };

}
