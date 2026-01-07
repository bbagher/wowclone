import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Mesh, AbstractMesh } from '@babylonjs/core/Meshes/mesh';
import { PlayerState, MovementInput } from '../types';
import { AnimationController } from './AnimationController';
import { CameraController } from './CameraController';
import { PhysicsSystem } from './PhysicsSystem';
import { GameConfig } from '../config';

export class PlayerController {
    private state: PlayerState;
    private animationController: AnimationController | null = null;
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        this.state = {
            mesh: null,
            skeletonRoot: null,
            velocity: { x: 0, y: 0, z: 0 },
            isGrounded: false,
            baseOffset: 0
        };
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
        this.state.mesh = MeshBuilder.CreateBox('playerController', { size: 0.1 }, this.scene);
        this.state.mesh.isVisible = false;
        this.state.mesh.position = new Vector3(0, 0, 0);

        // Parent the skeleton to the controller
        root.parent = this.state.mesh;

        // Calculate bounding box to find the height
        const boundingInfo = root.getHierarchyBoundingVectors();
        const height = boundingInfo.max.y - boundingInfo.min.y;
        this.state.baseOffset = -boundingInfo.min.y; // Move feet to ground

        root.position = new Vector3(0, this.state.baseOffset, 0);
        root.scaling = new Vector3(1, 1, 1);

        // Store reference to skeleton root
        this.state.skeletonRoot = root;

        console.log('Skeleton height:', height, 'offset:', this.state.baseOffset);

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

        this.state.mesh = body;
        shadowGenerator.addShadowCaster(body);
    }

    public update(
        input: MovementInput,
        cameraController: CameraController,
        physics: PhysicsSystem
    ): void {
        if (!this.state.mesh) return;

        // Calculate movement
        const movement = this.calculateMovement(input, cameraController);

        // Apply movement to velocity
        const velocity = new Vector3(this.state.velocity.x, this.state.velocity.y, this.state.velocity.z);
        velocity.x = movement.x;
        velocity.z = movement.z;

        // Handle jump
        if (input.jump) {
            physics.jump(this.state);
        }

        // Apply physics
        physics.applyGravity(velocity);
        this.state.velocity = { x: velocity.x, y: velocity.y, z: velocity.z };

        physics.applyVelocity(this.state.mesh.position, velocity);
        physics.checkGroundCollision(this.state);

        // WoW-style: Character always faces away from camera
        this.state.mesh.rotation.y = cameraController.getAlpha();

        // Update animations
        this.updateAnimations(input);
    }

    private calculateMovement(input: MovementInput, cameraController: CameraController): Vector3 {
        const movement = Vector3.Zero();
        let moveZ = 0;
        let moveX = 0;
        let isMoving = false;

        if (input.forward) {
            moveZ = 1;
            isMoving = true;
        }
        if (input.backward) {
            moveZ = -1;
            isMoving = true;
        }
        if (input.left) {
            moveX = -1;
            isMoving = true;
        }
        if (input.right) {
            moveX = 1;
            isMoving = true;
        }

        if (isMoving) {
            const forward = cameraController.getForwardDirection();
            const right = cameraController.getRightDirection();

            let speed = GameConfig.MOVE_SPEED;
            if (input.sprint) {
                speed *= GameConfig.SPRINT_MULTIPLIER;
            }

            movement.addInPlace(forward.scale(moveZ * speed));
            movement.addInPlace(right.scale(moveX * speed));
        }

        return movement;
    }

    private updateAnimations(input: MovementInput): void {
        if (!this.animationController) {
            this.fallbackAnimation(input);
            return;
        }

        const animations = this.animationController.getAnimations();
        if (animations.length === 0 || animations[0].targetedAnimations.length === 0) {
            this.fallbackAnimation(input);
            return;
        }

        const isMoving = input.forward || input.backward || input.left || input.right;

        if (isMoving) {
            const walkAnim = this.animationController.findAnimation('walk') ||
                            this.animationController.findAnimation('run');

            if (walkAnim) {
                this.animationController.playAnimation(walkAnim);
                const speed = input.sprint ? 1.5 : 1.0;
                this.animationController.setAnimationSpeed(speed);
            }
        } else {
            const idleAnim = this.animationController.findAnimation('idle');
            if (idleAnim) {
                this.animationController.playAnimation(idleAnim);
            }
        }
    }

    private fallbackAnimation(input: MovementInput): void {
        // Simple visual feedback when animations don't work
        if (this.state.mesh && this.state.mesh.getChildren().length > 0) {
            const skeleton = this.state.mesh.getChildren()[0] as AbstractMesh;
            const isMoving = input.forward || input.backward || input.left || input.right;

            if (isMoving) {
                // Bob up and down while moving
                skeleton.position.y = Math.sin(Date.now() * 0.01) * 0.05;
            } else {
                skeleton.position.y = 0;
            }
        }
    }

    public getMesh(): Mesh | null {
        return this.state.mesh;
    }

    public getAnimationController(): AnimationController | null {
        return this.animationController;
    }

    public getSkeletonRoot(): AbstractMesh | null {
        return this.state.skeletonRoot;
    }

    public getBaseOffset(): number {
        return this.state.baseOffset;
    }

    public setSkeletonVerticalOffset(adjustment: number): void {
        if (this.state.skeletonRoot) {
            this.state.skeletonRoot.position.y = this.state.baseOffset + adjustment;
        }
    }

    public dispose(): void {
        if (this.animationController) {
            this.animationController.dispose();
        }
        if (this.state.mesh) {
            this.state.mesh.dispose();
        }
    }
}
