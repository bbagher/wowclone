import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Ray } from '@babylonjs/core/Culling/ray';
import { GameConfig } from '../config';
import { CollisionManager } from '../services/CollisionManager';

interface NatureAsset {
    name: string;
    count: number;
    scale: number;
    collidable: boolean; // Whether this object should block player movement
}

export class EnvironmentManager {
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;
    private collisionManager: CollisionManager;

    constructor(scene: Scene, shadowGenerator: ShadowGenerator, collisionManager: CollisionManager) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.collisionManager = collisionManager;
    }

    public async createGround(): Promise<void> {
        // Create ground
        const ground = MeshBuilder.CreateGround(
            'ground',
            { width: GameConfig.GROUND_SIZE, height: GameConfig.GROUND_SIZE },
            this.scene
        );

        const groundMaterial = new StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.3);
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;
        ground.receiveShadows = true;

        // Add some terrain variation with simple hills
        const positions = ground.getVerticesData('position');
        if (positions) {
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i + 2];
                // Simple noise-like height variation
                positions[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * GameConfig.TERRAIN_HEIGHT_SCALE;
            }
            ground.setVerticesData('position', positions);
            ground.createNormals(false);
        }
    }

    public async loadNatureAssets(): Promise<void> {
        console.log('Loading nature assets...');

        const natureAssets: NatureAsset[] = [
            // Trees - solid collision
            { name: 'CommonTree_1.gltf', count: 15, scale: 1.5, collidable: true },
            { name: 'CommonTree_2.gltf', count: 12, scale: 1.5, collidable: true },
            { name: 'CommonTree_3.gltf', count: 10, scale: 1.5, collidable: true },
            { name: 'DeadTree_1.gltf', count: 5, scale: 1.5, collidable: true },

            // Bushes and vegetation - no collision (walkable)
            { name: 'Bush_Common.gltf', count: 20, scale: 1.0, collidable: false },
            { name: 'Bush_Common_Flowers.gltf', count: 15, scale: 1.0, collidable: false },
            { name: 'Fern_1.gltf', count: 25, scale: 0.8, collidable: false },

            // Rocks - solid collision
            { name: 'Rock_Medium_1.gltf', count: 15, scale: 1.2, collidable: true },
            { name: 'Rock_Medium_2.gltf', count: 12, scale: 1.2, collidable: true },
            { name: 'Rock_Small_1.gltf', count: 20, scale: 0.8, collidable: true },

            // Grass patches - no collision (walkable)
            { name: 'Grass_Common_Tall.gltf', count: 30, scale: 1.0, collidable: false },
            { name: 'Grass_Wispy_Tall.gltf', count: 25, scale: 1.0, collidable: false },
        ];

        for (const asset of natureAssets) {
            try {
                await this.loadAsset(asset);
            } catch (error) {
                console.warn(`Failed to load ${asset.name}:`, error);
                // Continue loading other assets even if one fails
            }
        }

        console.log('Nature assets loading complete!');
    }

    private async loadAsset(asset: NatureAsset): Promise<void> {
        const result = await SceneLoader.ImportMeshAsync(
            '',
            '/assets/nature/glTF/',
            asset.name,
            this.scene
        );

        if (result.meshes.length === 0) {
            throw new Error(`No meshes found in ${asset.name}`);
        }

        const templateMesh = result.meshes[0];
        templateMesh.setEnabled(false); // Hide the template

        // Create instances at random positions
        for (let i = 0; i < asset.count; i++) {
            // Random position within the terrain bounds
            const x = (Math.random() - 0.5) * 80; // Spread across 80x80 area
            const z = (Math.random() - 0.5) * 80;

            // Create instance
            const instance = templateMesh.clone(`${asset.name}_${i}`, null);
            if (instance) {
                // Apply scaling first
                const scaleVariation = 0.8 + Math.random() * 0.4; // 80% to 120%
                const finalScale = asset.scale * scaleVariation;
                instance.scaling = new Vector3(finalScale, finalScale, finalScale);

                // Use raycast to find exact ground height
                const origin = new Vector3(x, 100, z);
                const direction = new Vector3(0, -1, 0);
                const ray = new Ray(origin, direction, 200);
                const hit = this.scene.pickWithRay(ray, (mesh) => mesh.name === 'ground');

                if (hit && hit.pickedPoint) {
                    // Get model's lowest point
                    const modelBounds = instance.getHierarchyBoundingVectors();
                    const lowestPoint = modelBounds.min.y;

                    // Position so lowest point touches ground
                    instance.position = new Vector3(
                        x,
                        hit.pickedPoint.y - lowestPoint,
                        z
                    );
                } else {
                    // Fallback to approximate height
                    instance.position = new Vector3(x, 0, z);
                }

                // Random rotation for variety
                instance.rotation.y = Math.random() * Math.PI * 2;

                instance.setEnabled(true);

                // Add shadow casting for larger objects
                if (asset.name.includes('Tree') || asset.name.includes('Rock')) {
                    this.shadowGenerator.addShadowCaster(instance);
                }

                // Register collidable objects with collision manager
                if (asset.collidable) {
                    // Register the root mesh
                    this.collisionManager.registerCollidable(instance);

                    // Also register all child meshes with geometry
                    const childMeshes = instance.getChildMeshes(false);
                    childMeshes.forEach(child => {
                        this.collisionManager.registerCollidable(child);
                    });
                }
            }
        }

        console.log(`Loaded ${asset.count} instances of ${asset.name}`);
    }

    public dispose(): void {
        // Scene cleanup will handle mesh disposal
    }
}
