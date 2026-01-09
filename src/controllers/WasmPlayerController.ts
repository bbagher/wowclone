import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MovementInput } from '../types';
import { AnimationController } from './AnimationController';
import { CameraController } from './CameraController';
import { PlayerPhysics } from '../wasm/game_physics.js';
import { GameConfig } from '../config';

export class WasmPlayerController {
    private mesh: Mesh | null = null;
    private skeletonRoot: AbstractMesh | null = null;
    private animationController: AnimationController | null = null;
    private scene: Scene;
    private physics: PlayerPhysics;
    private baseOffset: number = 0;
    private lastFrameTime: number = 0;
    private isAttacking: boolean = false;

    constructor(scene: Scene, physics: PlayerPhysics) {
        this.scene = scene;
        this.physics = physics;
        this.lastFrameTime = performance.now();
    }

    public async loadPlayer(shadowGenerator: ShadowGenerator): Promise<void> {
        try {
            await this.loadSkeletonModel(shadowGenerator);
        } catch (error) {
            console.error('Failed to load skeleton model:', error);
            this.createFallbackModel(shadowGenerator);
        }
    }

    private async loadSkeletonModel(shadowGenerator: ShadowGenerator): Promise<void> {
        console.log('Loading skeleton model...');

        const result = await SceneLoader.ImportMeshAsync(
            '',
            '/models/',
            'Skeleton.glb',
            this.scene
        );

        console.log('Skeleton loaded!', result.meshes.length, 'meshes');
        console.log('Animations found:', result.animationGroups.length);

        if (result.meshes.length === 0) {
            throw new Error('No meshes found in model');
        }

        const root = result.meshes[0];

        // Create a parent mesh for easier control
        this.mesh = MeshBuilder.CreateBox('playerController', { size: 0.1 }, this.scene);
        this.mesh.isVisible = false;
        this.mesh.position = new Vector3(0, 0, 0);

        // Parent the skeleton to the controller
        root.parent = this.mesh;

        // Calculate bounding box to find the height
        const boundingInfo = root.getHierarchyBoundingVectors();
        this.baseOffset = -boundingInfo.min.y;
        root.position = new Vector3(0, this.baseOffset - 1.0, 0);

        // Store reference to skeleton root
        this.skeletonRoot = root;

        // Add shadows to all meshes
        result.meshes.forEach(mesh => {
            if (mesh !== root) {
                shadowGenerator.addShadowCaster(mesh);
            }
        });

        // Setup animations
        if (result.animationGroups.length > 0) {
            this.animationController = new AnimationController(result.animationGroups);

            // Start with idle animation
            const idleAnim = this.animationController.findAnimation('idle');
            if (idleAnim) {
                this.animationController.playAnimation(idleAnim);
            }
        }

        console.log('Player setup complete');
    }

    private createFallbackModel(shadowGenerator: ShadowGenerator): void {
        console.log('Creating fallback capsule...');

        const body = MeshBuilder.CreateCapsule(
            'playerBody',
            { height: 2, radius: 0.5 },
            this.scene
        );
        body.position.y = 1;

        const playerMaterial = new StandardMaterial('playerMat', this.scene);
        playerMaterial.diffuseColor = new Color3(0.2, 0.5, 0.8);
        body.material = playerMaterial;

        this.mesh = body;
        shadowGenerator.addShadowCaster(body);
    }

    public update(
        input: MovementInput,
        cameraController: CameraController
    ): void {
        if (!this.mesh) return;

        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 16.67; // Normalize to 60fps
        this.lastFrameTime = currentTime;

        // Handle character rotation with Q and E keys
        if (input.rotateLeft) {
            this.mesh.rotation.y -= GameConfig.ROTATION_SPEED;
        }
        if (input.rotateRight) {
            this.mesh.rotation.y += GameConfig.ROTATION_SPEED;
        }

        // Get camera direction
        const forward = cameraController.getForwardDirection();
        const right = cameraController.getRightDirection();

        // Read input
        let moveX = 0;
        let moveZ = 0;

        if (input.forward) moveZ = 1;
        if (input.backward) moveZ = -1;
        if (input.left) moveX = -1;
        if (input.right) moveX = 1;

        // Update physics in WASM (all calculations happen in Rust)
        this.physics.update(
            moveX,
            moveZ,
            forward.x,
            forward.z,
            right.x,
            right.z,
            input.sprint,
            input.jump,
            deltaTime
        );

        // Read physics results and apply to player
        this.mesh.position.x = this.physics.get_position_x();
        this.mesh.position.y = this.physics.get_position_y();
        this.mesh.position.z = this.physics.get_position_z();

        const isMoving = this.physics.is_moving();

        // Character maintains its facing direction while moving
        // Character only rotates when idle and camera realigns, or when camera is actively rotated
        // Movement does NOT change character rotation

        // Update animations
        this.updateAnimations(input.sprint, isMoving);
    }

    private updateAnimations(isSprinting: boolean, isMoving: boolean): void {
        if (!this.animationController || this.isAttacking) {
            return;
        }

        const animations = this.animationController.getAnimations();
        if (animations.length === 0 || animations[0].targetedAnimations.length === 0) {
            return;
        }

        if (isMoving) {
            const walkAnim = this.animationController.findAnimation('walk') ||
                            this.animationController.findAnimation('run');

            if (walkAnim) {
                this.animationController.playAnimation(walkAnim);
                const speed = isSprinting ? 1.5 : 1.0;
                this.animationController.setAnimationSpeed(speed);
            }
        } else {
            const idleAnim = this.animationController.findAnimation('idle');
            if (idleAnim) {
                this.animationController.playAnimation(idleAnim);
            }
        }
    }

    public performAttack(): boolean {
        if (!this.animationController || this.isAttacking) {
            return false;
        }

        // Find attack animation
        const attackAnim = this.animationController.findAnimation('attack');
        if (!attackAnim) {
            console.warn('No attack animation found');
            return false;
        }

        // Set attacking state
        this.isAttacking = true;

        // Stop all animations and play attack
        const animations = this.animationController.getAnimations();
        animations.forEach(anim => anim.stop());
        attackAnim.start(false, 1.0, attackAnim.from, attackAnim.to, false);

        // Reset attacking state when animation completes
        attackAnim.onAnimationGroupEndObservable.addOnce(() => {
            this.isAttacking = false;
            // Return to appropriate animation
            const isMoving = this.physics && this.physics.is_moving();
            if (isMoving) {
                const walkAnim = this.animationController!.findAnimation('walk') ||
                                this.animationController!.findAnimation('run');
                if (walkAnim) {
                    this.animationController!.playAnimation(walkAnim);
                }
            } else {
                const idleAnim = this.animationController!.findAnimation('idle');
                if (idleAnim) {
                    this.animationController!.playAnimation(idleAnim);
                }
            }
        });

        return true;
    }

    public getMesh(): Mesh | null {
        return this.mesh;
    }

    public getAnimationController(): AnimationController | null {
        return this.animationController;
    }

    public getSkeletonRoot(): AbstractMesh | null {
        return this.skeletonRoot;
    }

    public getBaseOffset(): number {
        return this.baseOffset;
    }

    public isRotating(input: MovementInput): boolean {
        return input.rotateLeft || input.rotateRight;
    }

    /**
     * Smoothly rotate the character to match the camera's current angle.
     * This is used during right-click dragging for WoW-style character rotation.
     * Uses the same formula as Q/E rotation but with smooth interpolation.
     */
    public smoothRotateToMatchCamera(cameraAlpha: number, lerpSpeed: number = 0.15): void {
        if (!this.mesh) return;

        // Calculate target character rotation from camera alpha
        // Inverse of the camera-to-character formula: character.rotation.y = -camera.alpha - Math.PI / 2
        const targetRotation = -cameraAlpha - Math.PI / 2;

        // Smoothly interpolate towards target rotation
        const currentRotation = this.mesh.rotation.y;
        const diff = this.getShortestAngleDiff(currentRotation, targetRotation);

        // Apply smooth rotation
        this.mesh.rotation.y = this.normalizeAngle(currentRotation + diff * lerpSpeed);
    }

    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    private getShortestAngleDiff(from: number, to: number): number {
        const normFrom = this.normalizeAngle(from);
        const normTo = this.normalizeAngle(to);
        let diff = normTo - normFrom;

        // Take shortest path
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;

        return diff;
    }

    public setSkeletonVerticalOffset(adjustment: number): void {
        if (this.skeletonRoot) {
            this.skeletonRoot.position.y = this.baseOffset - 1.0 + adjustment;
        }
    }

    public dispose(): void {
        if (this.animationController) {
            this.animationController.dispose();
        }
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}
