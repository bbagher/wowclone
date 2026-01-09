import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { TerrainService } from './services/TerrainService';

export enum NPCState {
    Idle,
    Chasing,
    Attacking
}

export class NPC {
    public mesh: Mesh;
    public health: number = 100;
    public maxHealth: number = 100;
    public state: NPCState = NPCState.Idle;
    private velocity: Vector3 = Vector3.Zero();
    private readonly moveSpeed: number = 0.15;
    private readonly detectionRange: number = 15;
    private readonly attackRange: number = 2.5;
    private readonly attackCooldown: number = 1000; // ms
    private lastAttackTime: number = 0;
    private readonly attackDamage: number = 10;
    private modelRoot: AbstractMesh | null = null;
    private framesSinceLastSnap: number = 0;
    private readonly SNAP_INTERVAL: number = 3; // Only snap every N frames to reduce flickering
    private animationGroups: AnimationGroup[] = [];
    private currentAnimation: AnimationGroup | null = null;

    constructor(
        private scene: Scene,
        private spawnPosition: Vector3,
        private name: string,
        private modelName: string = 'Slime.glb',
        private terrainService: TerrainService
    ) {
        // Create invisible controller mesh immediately
        this.mesh = MeshBuilder.CreateBox(`${this.name}_controller`, { size: 0.1 }, this.scene);
        this.mesh.isVisible = false;
        this.mesh.position = this.spawnPosition.clone();

        // Load the model asynchronously
        this.loadModel();
    }

    private async loadModel(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync(
                '',
                '/models/',
                this.modelName,
                this.scene
            );

            if (result.meshes.length > 0) {
                this.modelRoot = result.meshes[0];
                this.modelRoot.parent = this.mesh;

                // Position model relative to controller
                this.modelRoot.position = new Vector3(0, 0, 0);

                // Store animation groups
                this.animationGroups = result.animationGroups;

                // Start with idle animation if available
                const idleAnim = this.findAnimation('idle');
                if (idleAnim) {
                    this.playAnimation(idleAnim);
                }

                // Snap controller to ground using terrain service
                this.snapToGround();

                // Add shadow casting
                const shadowGenerator = (this.scene as any).shadowGenerator as ShadowGenerator;
                if (shadowGenerator) {
                    result.meshes.forEach(mesh => {
                        if (mesh !== this.modelRoot) {
                            shadowGenerator.addShadowCaster(mesh);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn(`Failed to load model ${this.modelName} for ${this.name}, using fallback`);
            this.createFallbackMesh();
        }
    }

    private snapToGround(): void {
        // Get the lowest point of the model for proper ground alignment
        let lowestPoint = 0;
        if (this.modelRoot) {
            const boundingInfo = this.modelRoot.getHierarchyBoundingVectors();
            lowestPoint = boundingInfo.min.y;
        }

        // Use terrain service to get ground-snapped position
        const snappedPos = this.terrainService.snapPositionToGround(
            this.mesh.position,
            lowestPoint
        );

        if (snappedPos) {
            this.mesh.position.y = snappedPos.y;
        }
    }

    private findAnimation(name: string): AnimationGroup | null {
        const lowerName = name.toLowerCase();
        return this.animationGroups.find(anim =>
            anim.name.toLowerCase().includes(lowerName)
        ) || null;
    }

    private playAnimation(animation: AnimationGroup): void {
        if (this.currentAnimation === animation && animation.isPlaying) {
            return; // Already playing this animation
        }

        // Stop all other animations
        this.animationGroups.forEach(anim => {
            if (anim !== animation && anim.isPlaying) {
                anim.stop();
            }
        });

        // Play the new animation
        this.currentAnimation = animation;
        animation.start(true, 1.0, animation.from, animation.to, false);
    }

    private createFallbackMesh(): void {
        // Fallback to capsule if model fails to load
        const fallback = MeshBuilder.CreateCapsule(
            `${this.name}_fallback`,
            { height: 2, radius: 0.5 },
            this.scene
        );
        fallback.parent = this.mesh;
        fallback.position = new Vector3(0, 1, 0);

        const material = new StandardMaterial(`${this.name}_mat`, this.scene);
        material.diffuseColor = new Color3(0.8, 0.2, 0.2);
        material.specularColor = new Color3(0.2, 0.2, 0.2);
        fallback.material = material;

        const shadowGenerator = (this.scene as any).shadowGenerator as ShadowGenerator;
        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(fallback);
        }

        this.modelRoot = fallback;
    }

    public update(playerPosition: Vector3, deltaTime: number): { attacked: boolean, damage: number } {
        if (this.health <= 0) {
            this.state = NPCState.Idle;
            return { attacked: false, damage: 0 };
        }

        const distanceToPlayer = Vector3.Distance(this.mesh.position, playerPosition);
        let attacked = false;
        let damage = 0;

        const previousState = this.state;

        // State machine
        if (distanceToPlayer <= this.attackRange) {
            // Attack state
            this.state = NPCState.Attacking;
            this.velocity = Vector3.Zero();

            // Face the player
            const direction = playerPosition.subtract(this.mesh.position);
            direction.y = 0;
            if (direction.length() > 0) {
                // Adjust rotation by 90 degrees to match model's forward direction
                const angle = Math.atan2(direction.x, direction.z) + Math.PI / 2;
                this.mesh.rotation.y = angle;
            }

            // Attack if cooldown is ready
            const currentTime = Date.now();
            if (currentTime - this.lastAttackTime >= this.attackCooldown) {
                attacked = true;
                damage = this.attackDamage;
                this.lastAttackTime = currentTime;

                // Visual feedback - quick scale pulse
                this.mesh.scaling = new Vector3(1.2, 1.2, 1.2);
                setTimeout(() => {
                    if (this.mesh) {
                        this.mesh.scaling = new Vector3(1, 1, 1);
                    }
                }, 100);
            }
        } else if (distanceToPlayer <= this.detectionRange) {
            // Chase state
            this.state = NPCState.Chasing;

            // Calculate direction to player
            const direction = playerPosition.subtract(this.mesh.position);
            direction.y = 0;
            direction.normalize();

            // Move towards player
            this.velocity = direction.scale(this.moveSpeed * deltaTime);
            this.mesh.position.addInPlace(this.velocity);

            // Face movement direction
            if (this.velocity.length() > 0) {
                // Adjust rotation by 90 degrees to match model's forward direction
                const angle = Math.atan2(direction.x, direction.z) + Math.PI / 2;
                this.mesh.rotation.y = angle;
            }

            // Snap to ground only every N frames to prevent flickering
            this.framesSinceLastSnap++;
            if (this.framesSinceLastSnap >= this.SNAP_INTERVAL) {
                this.snapToGround();
                this.framesSinceLastSnap = 0;
            }
        } else {
            // Idle state - wander around spawn point
            this.state = NPCState.Idle;

            // Simple idle behavior - slowly return to spawn point if too far
            const distanceToSpawn = Vector3.Distance(this.mesh.position, this.spawnPosition);
            if (distanceToSpawn > 5) {
                const direction = this.spawnPosition.subtract(this.mesh.position);
                direction.y = 0;
                direction.normalize();

                this.velocity = direction.scale(this.moveSpeed * 0.3 * deltaTime);
                this.mesh.position.addInPlace(this.velocity);

                // Face movement direction
                if (this.velocity.length() > 0) {
                    // Adjust rotation by 90 degrees to match model's forward direction
                    const angle = Math.atan2(direction.x, direction.z) + Math.PI / 2;
                    this.mesh.rotation.y = angle;
                }

                // Snap to ground only every N frames to prevent flickering
                this.framesSinceLastSnap++;
                if (this.framesSinceLastSnap >= this.SNAP_INTERVAL) {
                    this.snapToGround();
                    this.framesSinceLastSnap = 0;
                }
            } else {
                this.velocity = Vector3.Zero();
            }
        }

        // Update animations based on state changes
        if (previousState !== this.state) {
            this.updateStateAnimation();
        }

        return { attacked, damage };
    }

    private updateStateAnimation(): void {
        if (this.animationGroups.length === 0) return;

        switch (this.state) {
            case NPCState.Attacking:
                const attackAnim = this.findAnimation('attack');
                if (attackAnim) {
                    this.playAnimation(attackAnim);
                }
                break;

            case NPCState.Chasing:
                const walkAnim = this.findAnimation('walk') || this.findAnimation('run');
                if (walkAnim) {
                    this.playAnimation(walkAnim);
                }
                break;

            case NPCState.Idle:
                const idleAnim = this.findAnimation('idle');
                if (idleAnim) {
                    this.playAnimation(idleAnim);
                }
                break;
        }
    }

    public takeDamage(damage: number): boolean {
        this.health -= damage;

        // Visual feedback - flash red
        const material = this.mesh.material as StandardMaterial;
        if (material) {
            const originalColor = material.diffuseColor.clone();
            material.diffuseColor = new Color3(1, 0, 0);
            setTimeout(() => {
                if (material) {
                    material.diffuseColor = originalColor;
                }
            }, 100);
        }

        if (this.health <= 0) {
            this.die();
            return true; // NPC is dead
        }
        return false;
    }

    private die(): void {
        // Play death animation if available
        const deathAnim = this.findAnimation('death') || this.findAnimation('die');

        if (deathAnim) {
            // Stop all other animations
            this.animationGroups.forEach(anim => {
                if (anim !== deathAnim) {
                    anim.stop();
                }
            });

            // Play death animation once (not looping)
            deathAnim.start(false, 1.0, deathAnim.from, deathAnim.to, false);

            // Wait for animation to complete before disposing
            deathAnim.onAnimationGroupEndObservable.addOnce(() => {
                this.dispose();
            });
        } else {
            // Fallback: fade out if no death animation
            if (this.modelRoot) {
                this.modelRoot.getChildMeshes().forEach(mesh => {
                    const material = mesh.material as StandardMaterial;
                    if (material) {
                        material.alpha = 0.5;
                    }
                });
            }

            setTimeout(() => {
                this.dispose();
            }, 1000);
        }
    }

    public getState(): string {
        switch (this.state) {
            case NPCState.Idle: return 'Idle';
            case NPCState.Chasing: return 'Chasing';
            case NPCState.Attacking: return 'Attacking';
            default: return 'Unknown';
        }
    }

    public dispose(): void {
        // Stop and dispose all animations
        this.animationGroups.forEach(anim => {
            anim.stop();
            anim.dispose();
        });
        this.animationGroups = [];

        // Dispose meshes
        if (this.modelRoot) {
            this.modelRoot.dispose();
        }
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}
