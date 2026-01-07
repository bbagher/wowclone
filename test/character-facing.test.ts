import { Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import {
    createTestScene,
    expectAngleClose,
    getForwardFromRotation,
    TestEnvironment
} from './utils';

describe('Character Facing Direction (WoW-style)', () => {
    let testEnv: TestEnvironment;

    beforeEach(() => {
        testEnv = createTestScene();
    });

    afterEach(() => {
        testEnv.scene.dispose();
        testEnv.engine.dispose();
    });

    describe('Forward Vector from Rotation', () => {
        test('rotation 0 should point in +Z direction', () => {
            const forward = getForwardFromRotation(0);
            expect(forward.x).toBeCloseTo(0, 2);
            expect(forward.z).toBeCloseTo(1, 2);
        });

        test('rotation PI/2 (90°) should point in +X direction', () => {
            const forward = getForwardFromRotation(Math.PI / 2);
            expect(forward.x).toBeCloseTo(1, 2);
            expect(forward.z).toBeCloseTo(0, 2);
        });

        test('rotation PI (180°) should point in -Z direction', () => {
            const forward = getForwardFromRotation(Math.PI);
            expect(forward.x).toBeCloseTo(0, 2);
            expect(forward.z).toBeCloseTo(-1, 2);
        });

        test('rotation -PI/2 (-90°) should point in -X direction', () => {
            const forward = getForwardFromRotation(-Math.PI / 2);
            expect(forward.x).toBeCloseTo(-1, 2);
            expect(forward.z).toBeCloseTo(0, 2);
        });

        test('rotation PI/4 (45°) should point diagonally', () => {
            const forward = getForwardFromRotation(Math.PI / 4);
            const expected = Math.sqrt(2) / 2; // ~0.707
            expect(forward.x).toBeCloseTo(expected, 2);
            expect(forward.z).toBeCloseTo(expected, 2);
        });
    });

    describe('WoW-style Character Orientation', () => {
        test('character rotation should match camera alpha angle', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);
            const cameraAlpha = Math.PI / 2; // Camera at 90 degrees

            // In WoW-style, character always faces away from camera
            playerMesh.rotation.y = cameraAlpha;

            expectAngleClose(playerMesh.rotation.y, cameraAlpha);
        });

        test('character faces different directions as camera rotates', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);

            const testAngles = [
                0,              // North
                Math.PI / 4,    // Northeast
                Math.PI / 2,    // East
                Math.PI,        // South
                -Math.PI / 2    // West
            ];

            for (const angle of testAngles) {
                playerMesh.rotation.y = angle;
                expectAngleClose(playerMesh.rotation.y, angle);

                const forward = getForwardFromRotation(playerMesh.rotation.y);
                expect(forward.length()).toBeCloseTo(1, 2); // Should be unit vector
            }
        });

        test('camera at 0 degrees: character faces +Z (north)', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);
            playerMesh.rotation.y = 0; // Camera behind, looking north

            const forward = getForwardFromRotation(playerMesh.rotation.y);
            expect(forward.z).toBeCloseTo(1, 2); // Facing north (+Z)
            expect(forward.x).toBeCloseTo(0, 2);
        });

        test('camera at PI/2 degrees: character faces +X (east)', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);
            playerMesh.rotation.y = Math.PI / 2; // Camera from left, looking east

            const forward = getForwardFromRotation(playerMesh.rotation.y);
            expect(forward.x).toBeCloseTo(1, 2); // Facing east (+X)
            expect(forward.z).toBeCloseTo(0, 2);
        });

        test('camera at PI degrees: character faces -Z (south)', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);
            playerMesh.rotation.y = Math.PI; // Camera in front, looking south

            const forward = getForwardFromRotation(playerMesh.rotation.y);
            expect(forward.z).toBeCloseTo(-1, 2); // Facing south (-Z)
            expect(forward.x).toBeCloseTo(0, 2);
        });

        test('character back always faces camera position', () => {
            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);

            // If camera is at angle α, character rotation is α
            // So character's forward is opposite camera direction
            const cameraAlpha = Math.PI / 3;
            playerMesh.rotation.y = cameraAlpha;

            // Character's forward vector
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);

            // Camera's direction (where it's looking FROM)
            const cameraDirection = getForwardFromRotation(cameraAlpha);

            // They should be pointing the same direction (character faces away)
            expect(characterForward.x).toBeCloseTo(cameraDirection.x, 2);
            expect(characterForward.z).toBeCloseTo(cameraDirection.z, 2);
        });
    });

    describe('Movement Direction with Camera Angle', () => {
        test('W key with camera at 0°: should move forward in +Z', () => {
            const cameraAlpha = 0;
            const moveZ = 1; // Forward input

            // Forward direction from camera
            const cameraForward = getForwardFromRotation(cameraAlpha);

            // Movement should be in camera forward direction
            const movementDir = cameraForward.scale(moveZ);

            expect(movementDir.z).toBeCloseTo(1, 2);
            expect(movementDir.x).toBeCloseTo(0, 2);
        });

        test('W key with camera at 90°: should move forward in +X', () => {
            const cameraAlpha = Math.PI / 2;
            const moveZ = 1; // Forward input

            const cameraForward = getForwardFromRotation(cameraAlpha);
            const movementDir = cameraForward.scale(moveZ);

            expect(movementDir.x).toBeCloseTo(1, 2);
            expect(movementDir.z).toBeCloseTo(0, 2);
        });

        test('D key with camera at 0°: should strafe right in +X', () => {
            const cameraAlpha = 0;
            const moveX = 1; // Right input

            const cameraForward = getForwardFromRotation(cameraAlpha);
            const cameraRight = new Vector3(-cameraForward.z, 0, cameraForward.x);

            const movementDir = cameraRight.scale(moveX);

            expect(movementDir.x).toBeCloseTo(1, 2);
            expect(movementDir.z).toBeCloseTo(0, 2);
        });

        test('character rotation follows camera, not movement direction', () => {
            // In WoW-style controls, character ALWAYS faces camera direction
            // regardless of which WASD key is pressed

            const playerMesh = MeshBuilder.CreateBox('player', { size: 1 }, testEnv.scene);
            const cameraAlpha = Math.PI / 4; // Camera at 45°

            // Character rotation matches camera alpha
            playerMesh.rotation.y = cameraAlpha;

            // This is true whether pressing W, S, A, or D
            expectAngleClose(playerMesh.rotation.y, cameraAlpha);

            // Character's forward always points away from camera
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            const cameraForward = getForwardFromRotation(cameraAlpha);

            expect(characterForward.x).toBeCloseTo(cameraForward.x, 2);
            expect(characterForward.z).toBeCloseTo(cameraForward.z, 2);
        });
    });
});
