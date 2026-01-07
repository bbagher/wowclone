// Import Ray first for side effects
import '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
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

describe('Player Integration Tests', () => {
    let testEnv: TestEnvironment;
    let playerController: PlayerController;
    let cameraController: CameraController;
    let physicsSystem: PhysicsSystem;

    beforeEach(() => {
        testEnv = createTestScene();

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

        // Create a test player mesh
        const playerMesh = MeshBuilder.CreateBox('testPlayer', { size: 1 }, testEnv.scene);
        playerMesh.position = Vector3.Zero();
        (playerController as any).state.mesh = playerMesh;

        cameraController.setTarget(playerMesh);
    });

    afterEach(() => {
        testEnv.scene.dispose();
        testEnv.engine.dispose();
    });

    describe('Character Facing Direction with Movement', () => {
        test('pressing W (forward): character should face forward (camera direction)', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            // Camera behind player, looking north (alpha = 0)
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

            // Character rotation should match camera alpha (WoW-style: faces away from camera)
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // When camera alpha = 0, character rotation = 0, which means facing +Z direction
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });

        test('pressing A (left): character should still face camera direction, not left', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

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

            // Character should face camera direction (not the movement direction)
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character forward should point in +Z (same as when pressing W)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });

        test('pressing D (right): character should still face camera direction, not right', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

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

            // Character should face camera direction (not the movement direction)
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character forward should point in +Z
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });

        test('pressing S (backward): character should still face camera direction', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

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

            // Character should face camera direction (not backward)
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character forward should point in +Z
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });
    });

    describe('Character Facing with Different Camera Angles', () => {
        test('camera at 90° (PI/2): pressing W should make character face east (+X)', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            // Camera to the left, looking east
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

            // Character rotation should match camera.alpha = PI/2
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character should face +X direction (east)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.x).toBeCloseTo(1, 1);
            expect(characterForward.z).toBeCloseTo(0, 1);
        });

        test('camera at 180° (PI): pressing W should make character face south (-Z)', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            // Camera in front, looking south
            camera.alpha = Math.PI;

            const forwardInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(forwardInput, cameraController, physicsSystem);

            // Character rotation should match camera.alpha = PI
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character should face -Z direction (south)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(-1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });

        test('camera at -90° (-PI/2): pressing W should make character face west (-X)', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            // Camera to the right, looking west
            camera.alpha = -Math.PI / 2;

            const forwardInput: MovementInput = {
                forward: true,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(forwardInput, cameraController, physicsSystem);

            // Character rotation should match camera.alpha = -PI/2
            expectAngleClose(playerMesh.rotation.y, camera.alpha);

            // Character should face -X direction (west)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.x).toBeCloseTo(-1, 1);
            expect(characterForward.z).toBeCloseTo(0, 1);
        });

        test('camera at 45° (PI/4): pressing A (left) should still face camera direction', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            camera.alpha = Math.PI / 4;

            const leftInput: MovementInput = {
                forward: false,
                backward: false,
                left: true,
                right: false,
                jump: false,
                sprint: false
            };

            playerController.update(leftInput, cameraController, physicsSystem);

            // Character should face camera.alpha, not the strafe direction
            expectAngleClose(playerMesh.rotation.y, camera.alpha);
        });
    });

    describe('Movement Direction vs Facing Direction', () => {
        test('pressing A (left) should move left relative to camera, but face camera direction', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            camera.alpha = 0;

            const startPos = playerMesh.position.clone();

            const leftInput: MovementInput = {
                forward: false,
                backward: false,
                left: true,
                right: false,
                jump: false,
                sprint: false
            };

            // Run multiple updates to accumulate movement
            for (let i = 0; i < 10; i++) {
                playerController.update(leftInput, cameraController, physicsSystem);
            }

            const endPos = playerMesh.position;
            const movement = endPos.subtract(startPos);

            // Should have moved in -X direction (left when camera alpha = 0)
            expect(movement.x).toBeLessThan(0);
            expect(Math.abs(movement.z)).toBeLessThan(Math.abs(movement.x) * 0.1); // Mostly X movement

            // But character should face camera direction (+Z), not left (-X)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });

        test('pressing D (right) should move right relative to camera, but face camera direction', () => {
            const camera = cameraController.getCamera();
            const playerMesh = playerController.getMesh()!;

            camera.alpha = 0;

            const startPos = playerMesh.position.clone();

            const rightInput: MovementInput = {
                forward: false,
                backward: false,
                left: false,
                right: true,
                jump: false,
                sprint: false
            };

            // Run multiple updates to accumulate movement
            for (let i = 0; i < 10; i++) {
                playerController.update(rightInput, cameraController, physicsSystem);
            }

            const endPos = playerMesh.position;
            const movement = endPos.subtract(startPos);

            // Should have moved in +X direction (right when camera alpha = 0)
            expect(movement.x).toBeGreaterThan(0);
            expect(Math.abs(movement.z)).toBeLessThan(Math.abs(movement.x) * 0.1); // Mostly X movement

            // But character should face camera direction (+Z), not right (+X)
            const characterForward = getForwardFromRotation(playerMesh.rotation.y);
            expect(characterForward.z).toBeCloseTo(1, 1);
            expect(characterForward.x).toBeCloseTo(0, 1);
        });
    });
});
