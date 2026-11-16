import { ColorManagement, SRGBToLinear, LinearToSRGB } from '../../../../src/math/ColorManagement.js';
import { Color } from '../../../../src/math/Color.js';
import { Matrix3 } from '../../../../src/math/Matrix3.js';
import { Vector3 } from '../../../../src/math/Vector3.js';
import { LinearSRGBColorSpace, LinearTransfer, SRGBColorSpace } from '../../../../src/constants.js';
import { eps } from '../../utils/math-constants.js';

export default QUnit.module( 'Maths', () => {

	QUnit.module( 'ColorManagement', () => {

		// PROPERTIES
		QUnit.test( 'enabled', ( assert ) => {

			assert.strictEqual(
				ColorManagement.enabled, true,
				'ColorManagement.enabled is true by default.'
			);

		} );

		// INTERNALS
		QUnit.test( '_getMatrix', ( assert ) => {

			const LinearDisplayP3ColorSpace = 'test-display-p3-linear';

			ColorManagement.define( {
				[ LinearDisplayP3ColorSpace ]: {
					primaries: [ 0.680, 0.320, 0.265, 0.690, 0.150, 0.060 ],
					whitePoint: [ 0.3127, 0.3290 ],
					transfer: LinearTransfer,
					toXYZ: new Matrix3().set(
						0.4865709, 0.2656677, 0.1982173,
						0.2289746, 0.6917385, 0.0792869,
						0.0000000, 0.0451134, 1.0439444
					),
					fromXYZ: new Matrix3().set(
						2.4934969, - 0.9313836, - 0.4027108,
						- 0.8294890, 1.7626641, 0.0236247,
						0.0358458, - 0.0761724, 0.9568845
					),
					luminanceCoefficients: [ 0.2289, 0.6917, 0.0793 ]
				}
			} );

			const matrix = new Matrix3();
			const vector = new Vector3();
			const color = new Color();

			const conversions = [
				[ LinearSRGBColorSpace, LinearDisplayP3ColorSpace ],
				[ LinearDisplayP3ColorSpace, LinearSRGBColorSpace ]
			];

			for ( const [ source, target ] of conversions ) {

				ColorManagement._getMatrix( matrix, source, target );

				for ( const rgb of [[ 1, 1, 1 ], [ 1, 0, 0 ], [ 0.2, 0.5, 0.8 ]] ) {

					vector.fromArray( rgb ).applyMatrix3( matrix );
					ColorManagement.convert( color.fromArray( rgb ), source, target );

					assert.ok(
						Math.abs( vector.x - color.r ) < eps &&
						Math.abs( vector.y - color.g ) < eps &&
						Math.abs( vector.z - color.b ) < eps,
						`Matrix from ${ source } to ${ target } matches convert() for ( ${ rgb } ).`
					);

				}

			}

			delete ColorManagement.spaces[ LinearDisplayP3ColorSpace ];

		} );

		QUnit.test( 'convert (sRGB round trip)', ( assert ) => {

			// Fixed set of sRGB colors, including the transfer function
			// segment boundaries and both endpoints of the gamut.
			const colors = [
				[ 0, 0, 0 ],
				[ 1, 1, 1 ],
				[ 1, 0, 0 ],
				[ 0, 1, 0 ],
				[ 0, 0, 1 ],
				[ 0.5, 0.25, 0.75 ],
				[ 0.073, 0.214, 0.448 ],
				[ 0.0031308, 0.04045, 0.5 ],
				[ 0.123456, 0.654321, 0.987654 ]
			];

			// Note: the tolerance must stay above ~1e-7 because the rounded
			// sRGB constants (0.0031308 / 0.04045) make the piecewise transfer
			// function slightly discontinuous at the segment boundary.
			const tolerance = 1e-7;
			const color = new Color();

			for ( const rgb of colors ) {

				// SRGBColorSpace -> working color space -> SRGBColorSpace
				color.setRGB( rgb[ 0 ], rgb[ 1 ], rgb[ 2 ], SRGBColorSpace );
				ColorManagement.workingToColorSpace( color, SRGBColorSpace );

				assert.ok(
					Math.abs( color.r - rgb[ 0 ] ) < tolerance &&
					Math.abs( color.g - rgb[ 1 ] ) < tolerance &&
					Math.abs( color.b - rgb[ 2 ] ) < tolerance,
					`sRGB to working to sRGB round trip for ( ${ rgb } ) stays within tolerance.`
				);

				// working color space -> SRGBColorSpace -> working color space
				color.setRGB( rgb[ 0 ], rgb[ 1 ], rgb[ 2 ], LinearSRGBColorSpace );
				ColorManagement.workingToColorSpace( color, SRGBColorSpace );
				ColorManagement.colorSpaceToWorking( color, SRGBColorSpace );

				assert.ok(
					Math.abs( color.r - rgb[ 0 ] ) < tolerance &&
					Math.abs( color.g - rgb[ 1 ] ) < tolerance &&
					Math.abs( color.b - rgb[ 2 ] ) < tolerance,
					`Working to sRGB to working round trip for ( ${ rgb } ) stays within tolerance.`
				);

			}

		} );

		QUnit.test( 'convert matches Color transfer methods', ( assert ) => {

			// ColorManagement.convert() and Color's own transfer methods
			// (convertSRGBToLinear/convertLinearToSRGB) must agree exactly.
			const colors = [
				[ 0, 0, 0 ],
				[ 1, 1, 1 ],
				[ 0.5, 0.25, 0.75 ],
				[ 0.0031308, 0.04045, 0.5 ],
				[ 0.123456, 0.654321, 0.987654 ]
			];

			const a = new Color();
			const b = new Color();

			for ( const rgb of colors ) {

				ColorManagement.convert( a.fromArray( rgb ), SRGBColorSpace, LinearSRGBColorSpace );
				b.fromArray( rgb ).convertSRGBToLinear();

				assert.ok( a.equals( b ), `sRGB to linear matches for ( ${ rgb } ).` );

				ColorManagement.convert( a.fromArray( rgb ), LinearSRGBColorSpace, SRGBColorSpace );
				b.fromArray( rgb ).convertLinearToSRGB();

				assert.ok( a.equals( b ), `Linear to sRGB matches for ( ${ rgb } ).` );

			}

		} );

		QUnit.test( 'SRGBToLinear/LinearToSRGB (round trip)', ( assert ) => {

			const tolerance = 1e-9;

			for ( let i = 0; i <= 1000; i ++ ) {

				const c = i / 1000;

				assert.ok(
					Math.abs( LinearToSRGB( SRGBToLinear( c ) ) - c ) < tolerance,
					`sRGB to linear to sRGB round trip stays within tolerance for ${ c }.`
				);

				assert.ok(
					Math.abs( SRGBToLinear( LinearToSRGB( c ) ) - c ) < tolerance,
					`Linear to sRGB to linear round trip stays within tolerance for ${ c }.`
				);

			}

		} );

	} );

} );
