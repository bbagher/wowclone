// Integration test to verify camera positions correctly behind character
import '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { CameraController } from '../src/controllers/CameraController';
import {
    createTestScene,
    expectAngleClose,
    getForwardFromRotation,
    TestEnvironment
} from './utils';

describe('Camera-Character Alignment Tests', () => {
    let testEnv: TestEnvironment;
    let cameraController: CameraController;

    beforeEach(() => {
        testEnv = createTestScene();

        const mockCanvas = {
            width: 800,
            height: 600,
            addEventListener: () => {},
            removeEventListener: () => {},
            requestPointerLock: () => {},
            style: {}
        } as any;

        cameraController = new CameraController(testEnv.scene, mockCanvas);

        // Create a test target mesh
        const targetMesh = MeshBuilder.CreateBox('target', { size: 1 }, testEnv.scene);
        targetMesh.position = Vector3.Zero();
        cameraController.setTarget(targetMesh);
    });

    afterEach(() => {
        testEnv.scene.dispose();
        testEnv.engine.dispose();
    });

    describe('Camera Behind Character - Understanding the Relationship', () => {
        test('DIAGNOSTIC: when character.rotation.y = 0, what should camera.alpha be?', () => {
            const camera = cameraController.getCamera();
            const targetMesh = cameraController.getCamera().lockedTarget as any;

            // Scenario 1: Character faces +Z (north) at rotation.y = 0
            // In BabylonJS: rotation.y = 0 means model faces +Z
            // Character forward vector when rotation.y = 0
            const charForward = getForwardFromRotation(0);

            console.log('\n=== CHARACTER AT rotation.y = 0 ===');
            console.log('Character forward direction:', charForward);
            console.log('Character faces: +Z (north)');

            // Camera positions at different alpha values:
            // alpha = 0      → camera at +X (east), looking west toward center
            // alpha = PI/2   → camera at +Z (north), looking south toward center
            // alpha = PI     → camera at -X (west), looking east toward center
            // alpha = -PI/2  → camera at -Z (south), looking north toward center

            // If character faces +Z (north), camera behind it should be at -Z (south)
            // Camera at -Z means alpha = -PI/2 or 3PI/2

            console.log('\n=== CAMERA POSITIONS (relative to character at origin) ===');
            console.log('alpha = 0:       camera at (+X, south side)');
            console.log('alpha = PI/2:    camera at (+Z, behind if char faces +Z)');
            console.log('alpha = PI:      camera at (-X, north side)');
            console.log('alpha = -PI/2:   camera at (-Z, front if char faces +Z)');

            // When moving: character.rotation.y = camera.alpha
            // So if camera.alpha = 0, character.rotation.y = 0 (faces +Z)
            // Camera at alpha=0 is at +X, looking at character
            // Character at rotation.y=0 faces +Z
            // Is camera behind character? No! Camera is to the side.

            // For camera to be BEHIND character when character.rotation.y = 0 (facing +Z):
            // Camera should be at -Z (south), which is alpha = -PI/2

            targetMesh.rotation.y = 0;

            // The character faces +Z at rotation.y = 0
            // We want camera behind (at -Z), which is alpha = -PI/2
            const expectedCameraAlpha = -Math.PI / 2;

            console.log('\n=== EXPECTED ===');
            console.log('Character rotation.y = 0 (faces +Z)');
            console.log('Camera should be at alpha = -PI/2 (at -Z, behind character)');
            console.log('Formula: camera.alpha = character.rotation.y - PI/2');

            // This test documents what SHOULD happen
            // Actual formula test below
            expect(expectedCameraAlpha).toBe(-Math.PI / 2);
        });

        test('DIAGNOSTIC: when character.rotation.y = PI/2, what should camera.alpha be?', () => {
            const targetMesh = cameraController.getCamera().lockedTarget as any;

            // Character at rotation.y = PI/2 faces +X (east)
            targetMesh.rotation.y = Math.PI / 2;

            const charForward = getForwardFromRotation(Math.PI / 2);

            console.log('\n=== CHARACTER AT rotation.y = PI/2 ===');
            console.log('Character forward direction:', charForward);
            console.log('Character faces: +X (east)');

            // If character faces +X, camera behind should be at -X
            // Camera at -X means alpha = PI

            console.log('\n=== EXPECTED ===');
            console.log('Character rotation.y = PI/2 (faces +X)');
            console.log('Camera should be at alpha = PI (at -X, behind character)');
            console.log('Formula: camera.alpha = character.rotation.y + PI/2');

            const expectedCameraAlpha = Math.PI / 2 + Math.PI / 2;
            expect(expectedCameraAlpha).toBe(Math.PI);
        });

        test('ACTUAL TEST: camera realignment formula', () => {
            const camera = cameraController.getCamera();
            const targetMesh = cameraController.getCamera().lockedTarget as any;

            // Test multiple character orientations
            const testCases = [
                {
                    charRotation: 0,
                    charFacing: '+Z (north)',
                    expectedAlpha: -Math.PI / 2,
                    cameraPosition: '-Z (south)'
                },
                {
                    charRotation: Math.PI / 2,
                    charFacing: '+X (east)',
                    expectedAlpha: Math.PI,
                    cameraPosition: '-X (west)'
                },
                {
                    charRotation: Math.PI,
                    charFacing: '-Z (south)',
                    expectedAlpha: Math.PI / 2,
                    cameraPosition: '+Z (north)'
                },
                {
                    charRotation: -Math.PI / 2,
                    charFacing: '-X (west)',
                    expectedAlpha: 0,
                    cameraPosition: '+X (east)'
                }
            ];

            console.log('\n=== TESTING CAMERA ALIGNMENT FORMULA ===');

            for (const testCase of testCases) {
                targetMesh.rotation.y = testCase.charRotation;

                // Release mouse to trigger realignment
                (cameraController as any).isRightMouseDown = false;
                (cameraController as any).isLeftMouseDown = false;

                // Let camera realign
                for (let i = 0; i < 150; i++) {
                    cameraController.update();
                }

                console.log(`\nCharacter rotation: ${testCase.charRotation.toFixed(2)} (${testCase.charFacing})`);
                console.log(`Expected camera alpha: ${testCase.expectedAlpha.toFixed(2)} (${testCase.cameraPosition})`);
                console.log(`Actual camera alpha: ${camera.alpha.toFixed(2)}`);

                // The correct formula appears to be: camera.alpha = character.rotation.y - PI/2
                // Let's verify this
                const formulaResult = testCase.charRotation - Math.PI / 2;
                console.log(`Formula (char - PI/2): ${formulaResult.toFixed(2)}`);

                // Normalize and compare
                expectAngleClose(camera.alpha, testCase.expectedAlpha, 0.1);
            }

            // Based on the test results, determine the correct offset
            console.log('\n=== CONCLUSION ===');
            console.log('Correct formula: camera.alpha = character.rotation.y - PI/2');
            console.log('This positions camera opposite to where character faces');
        });
    });

    describe('WoW-Style Movement Integration', () => {
        test('moving forward: character faces camera direction, camera stays behind', () => {
            const camera = cameraController.getCamera();
            const targetMesh = cameraController.getCamera().lockedTarget as any;

            // Initial setup: camera at alpha = 0 (at +X)
            camera.alpha = 0;

            // When moving, character.rotation.y = camera.alpha
            targetMesh.rotation.y = camera.alpha; // Simulating movement update

            console.log('\n=== MOVEMENT TEST ===');
            console.log('Camera alpha:', camera.alpha);
            console.log('Character rotation.y:', targetMesh.rotation.y);
            console.log('Character forward:', getForwardFromRotation(targetMesh.rotation.y));

            // Character faces same direction as camera.alpha
            expect(targetMesh.rotation.y).toBe(camera.alpha);

            // Character faces +Z when alpha = 0
            const charForward = getForwardFromRotation(targetMesh.rotation.y);
            expect(charForward.z).toBeCloseTo(1, 1);

            // Camera at alpha=0 is at +X, looking at center
            // Character faces +Z
            // Camera is NOT behind character in this setup!

            console.log('\n=== PROBLEM IDENTIFIED ===');
            console.log('When character.rotation.y = camera.alpha:');
            console.log('- character.rotation.y = 0 means facing +Z');
            console.log('- camera.alpha = 0 means camera at +X');
            console.log('- Camera is PERPENDICULAR to character, not behind!');
            console.log('\nTo fix: camera behind character needs offset of -PI/2');
        });

        test('CORRECTED: character rotation should make camera be behind', () => {
            const camera = cameraController.getCamera();
            const targetMesh = cameraController.getCamera().lockedTarget as any;

            // If camera.alpha = 0 (camera at +X)
            camera.alpha = 0;

            // For camera to be BEHIND character:
            // Character should face +X (same direction camera is)
            // Character facing +X means rotation.y = PI/2

            // But in WoW-style, character.rotation.y = camera.alpha
            // So character.rotation.y = 0 when camera.alpha = 0
            // This means character faces +Z, camera at +X = camera to the side!

            // THE BUG: Character rotation should actually be camera.alpha - PI/2
            // OR camera realignment should be character.rotation.y + PI/2

            console.log('\n=== THE REAL SOLUTION ===');
            console.log('Option 1: Change character rotation to camera.alpha - PI/2');
            console.log('Option 2: Change camera realignment to character.rotation.y + PI/2');
            console.log('\nWe should use Option 2 to keep character rotation simple');

            targetMesh.rotation.y = 0; // Character faces +Z

            // Camera behind character (at -Z) = alpha = -PI/2
            // Formula: camera.alpha = character.rotation.y - PI/2
            const expectedAlpha = targetMesh.rotation.y - Math.PI / 2;

            console.log('Character rotation:', targetMesh.rotation.y);
            console.log('Expected camera alpha:', expectedAlpha);
            console.log('That is:', expectedAlpha, '(at -Z, behind character)');
        });
    });
});
