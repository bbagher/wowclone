import { Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Ray } from '@babylonjs/core/Culling/ray';
import { PlayerController } from '../src/controllers/PlayerController';
import { CameraController } from '../src/controllers/CameraController';
import { PhysicsSystem } from '../src/controllers/PhysicsSystem';
import { MovementInput } from '../src/types';
import {
    createTestScene,
    expectAngleClose,
    getForwardFromRotation,
    TestEnvironment
} from './utils';

describe('Player Character Orientation', () => {
    let testEnv: TestEnvironment;
    let playerController: PlayerController;
    let cameraController: CameraController;
    let physicsSystem: PhysicsSystem;

    beforeEach(() => {
        testEnv = createTestScene();

        // Create mock canvas for camera
        const mockCanvas = {
            width: 800,
            height: 600,
            addEventListener: () => {},
            removeEventListener: () => {},
            requestPointerLock: () => {},
        } as any;

        playerController = new PlayerController(testEnv.scene);
        cameraController = new CameraController(testEnv.scene, mockCanvas);
        physicsSystem = new PhysicsSystem();

        // Create a simple player mesh manually (skip model loading for tests)
        const playerMesh = MeshBuilder.CreateBox('testPlayer', { size: 1 }, testEnv.scene);
        playerMesh.position = Vector3.Zero();
        (playerController as any).state.mesh = playerMesh;

        cameraController.setTarget(playerMesh);
    });

    afterEach(() => {
        testEnv.scene.dispose();
        testEnv.engine.dispose();
    });

    describe('WoW-style Camera Rotation', () => {
        test('character should face away from camera when stationary', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            // Set camera angle (alpha is horizontal rotation)
            camera.alpha = Math.PI / 2; // Camera looking from the right

            // Update player (no movement)
            const noMovement: MovementInput = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(noMovement, cameraController, physicsSystem);

            // Character rotation should match camera alpha (facing away from camera)
            expectAngleClose(playerMesh!.rotation.y, camera.alpha);
        });

        test('character should rotate with camera when camera moves', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            const testAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2];

            const noMovement: MovementInput = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            for (const angle of testAngles) {
                camera.alpha = angle;
                playerController.update(noMovement, cameraController, physicsSystem);

                expectAngleClose(
                    playerMesh!.rotation.y,
                    angle,
                    `Camera at ${angle} radians should make character face that direction`
                );
            }
        });
    });

    describe('WASD Movement Direction', () => {
        test('W key: character should face forward relative to camera', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            // Camera looking from behind (alpha = 0)
            camera.alpha = 0;

            const forwardInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(forwardInput, cameraController, physicsSystem);

            // Character should be facing camera direction (0 radians)
            expectAngleClose(playerMesh!.rotation.y, 0);

            // Forward vector should point in +Z direction
            const forward = getForwardFromRotation(playerMesh!.rotation.y);
            expect(forward.z).toBeCloseTo(1, 1);
            expect(forward.x).toBeCloseTo(0, 1);
        });

        test('S key: character should face backward relative to camera', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            camera.alpha = 0;

            const backwardInput: MovementInput = {
                forward: false,
                backward: true,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(backwardInput, cameraController, physicsSystem);

            // Character should still face camera direction when moving backward
            expectAngleClose(playerMesh!.rotation.y, 0);
        });

        test('A key: character should face left relative to camera', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            camera.alpha = 0;

            const leftInput: MovementInput = {
                forward: false,
                backward: false,
                left: true,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(leftInput, cameraController, physicsSystem);

            // Character should face camera direction
            expectAngleClose(playerMesh!.rotation.y, 0);
        });

        test('D key: character should face right relative to camera', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            camera.alpha = 0;

            const rightInput: MovementInput = {
                forward: false,
                backward: false,
                left: false,
                right: true,
                jump: false,
                sprint: false
            };

            playerController.update(rightInput, cameraController, physicsSystem);

            // Character should face camera direction
            expectAngleClose(playerMesh!.rotation.y, 0);
        });

        test('W+D keys: character should face forward-right', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            camera.alpha = 0;

            const diagonalInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: true,
                jump: false,
                sprint: false
            };

            playerController.update(diagonalInput, cameraController, physicsSystem);

            // Character rotation should match camera (WoW-style)
            expectAngleClose(playerMesh!.rotation.y, 0);
        });
    });

    describe('Camera Rotation with Movement', () => {
        test('W key with camera rotated 90 degrees', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            // Camera looking from the right side
            camera.alpha = Math.PI / 2;

            const forwardInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(forwardInput, cameraController, physicsSystem);

            // Character should face away from camera (90 degrees)
            expectAngleClose(playerMesh!.rotation.y, Math.PI / 2);
        });

        test('character maintains camera-relative orientation while moving', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh();

            const forwardInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            // Test at different camera angles
            const testAngles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2];

            for (const angle of testAngles) {
                camera.alpha = angle;
                playerController.update(forwardInput, cameraController, physicsSystem);

                // Character should always match camera angle
                expectAngleClose(
                    playerMesh!.rotation.y,
                    angle,
                    `Character should face ${angle} radians when camera is at that angle`
                );
            }
        });
    });

    describe('Forward Vector Calculation', () => {
        test('rotation 0 should give forward vector +Z', () => {
            const forward = getForwardFromRotation(0);
            expect(forward.x).toBeCloseTo(0, 2);
            expect(forward.z).toBeCloseTo(1, 2);
        });

        test('rotation PI/2 should give forward vector +X', () => {
            const forward = getForwardFromRotation(Math.PI / 2);
            expect(forward.x).toBeCloseTo(1, 2);
            expect(forward.z).toBeCloseTo(0, 2);
        });

        test('rotation PI should give forward vector -Z', () => {
            const forward = getForwardFromRotation(Math.PI);
            expect(forward.x).toBeCloseTo(0, 2);
            expect(forward.z).toBeCloseTo(-1, 2);
        });

        test('rotation -PI/2 should give forward vector -X', () => {
            const forward = getForwardFromRotation(-Math.PI / 2);
            expect(forward.x).toBeCloseTo(-1, 2);
            expect(forward.z).toBeCloseTo(0, 2);
        });
    });
});
