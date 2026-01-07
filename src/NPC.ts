import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Ray } from '@babylonjs/core/Culling/ray';

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
    private baseOffset: number = 0;

    constructor(
        private scene: Scene,
        private spawnPosition: Vector3,
        private name: string,
        private modelName: string = 'Slime.glb'
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

                // Calculate vertical offset from model's bounding box
                const boundingInfo = this.modelRoot.getHierarchyBoundingVectors();
                this.baseOffset = -boundingInfo.min.y;

                // Position model relative to controller
                this.modelRoot.position = new Vector3(0, 0, 0);

                // Snap controller to ground using raycast
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
        // Cast a ray downward from high above the NPC position
        const origin = this.mesh.position.clone();
        origin.y = 100; // Start from high up

        const direction = new Vector3(0, -1, 0); // Point downward
        const length = 200; // Cast far down

        const ray = new Ray(origin, direction, length);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            // Only check against ground mesh
            return mesh.name === 'ground';
        });

        if (hit && hit.pickedPoint) {
            // Get the actual lowest point of the model in world space
            if (this.modelRoot) {
                const boundingInfo = this.modelRoot.getHierarchyBoundingVectors();
                const lowestPoint = boundingInfo.min.y;

                // Place mesh so the model's lowest point touches the ground
                // Controller is at model origin, so we need to offset by the lowest point
                this.mesh.position.y = hit.pickedPoint.y - lowestPoint;
            } else {
                // Fallback if model not loaded yet
                this.mesh.position.y = hit.pickedPoint.y;
            }
        }
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

        // State machine
        if (distanceToPlayer <= this.attackRange) {
            // Attack state
            this.state = NPCState.Attacking;
            this.velocity = Vector3.Zero();

            // Face the player
            const direction = playerPosition.subtract(this.mesh.position);
            direction.y = 0;
            if (direction.length() > 0) {
                const angle = Math.atan2(direction.x, direction.z);
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
                const angle = Math.atan2(direction.x, direction.z);
                this.mesh.rotation.y = angle;
            }

            // Snap to ground after movement
            this.snapToGround();
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
                    const angle = Math.atan2(direction.x, direction.z);
                    this.mesh.rotation.y = angle;
                }

                // Snap to ground after movement
                this.snapToGround();
            } else {
                this.velocity = Vector3.Zero();
            }
        }

        return { attacked, damage };
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
        // Death animation - fade out and fall
        if (this.modelRoot) {
            // Fade out the model
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

    public getState(): string {
        switch (this.state) {
            case NPCState.Idle: return 'Idle';
            case NPCState.Chasing: return 'Chasing';
            case NPCState.Attacking: return 'Attacking';
            default: return 'Unknown';
        }
    }

    public dispose(): void {
        if (this.modelRoot) {
            this.modelRoot.dispose();
        }
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}
