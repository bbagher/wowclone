import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { Ray } from '@babylonjs/core/Culling/ray';

/**
 * Centralized service for terrain/ground detection and height queries.
 * Provides caching and optimization for ground snapping operations.
 */
export class TerrainService {
    private scene: Scene;
    private heightCache: Map<string, { height: number; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 500; // ms - how long to trust cached heights
    private readonly GRID_SIZE = 0.5; // Grid cell size for caching
    private readonly RAY_ORIGIN_HEIGHT = 100;
    private readonly RAY_LENGTH = 200;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Get the ground height at a specific X,Z position with caching
     */
    public getGroundHeight(x: number, z: number, useCache: boolean = true): number | null {
        const cacheKey = this.getCacheKey(x, z);

        // Check cache first
        if (useCache) {
            const cached = this.heightCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.height;
            }
        }

        // Perform raycast
        const origin = new Vector3(x, this.RAY_ORIGIN_HEIGHT, z);
        const direction = new Vector3(0, -1, 0);
        const ray = new Ray(origin, direction, this.RAY_LENGTH);

        const hit = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.name === 'ground';
        });

        if (hit && hit.pickedPoint) {
            const height = hit.pickedPoint.y;

            // Cache the result
            this.heightCache.set(cacheKey, {
                height,
                timestamp: Date.now()
            });

            return height;
        }

        return null;
    }

    /**
     * Snap a position to the ground, optionally accounting for model offset
     */
    public snapPositionToGround(
        position: Vector3,
        modelLowestPoint: number = 0
    ): Vector3 | null {
        const groundHeight = this.getGroundHeight(position.x, position.z);

        if (groundHeight !== null) {
            return new Vector3(
                position.x,
                groundHeight - modelLowestPoint,
                position.z
            );
        }

        return null;
    }

    /**
     * Get initial spawn position on terrain with no caching
     * Use this for spawning entities to ensure accurate placement
     */
    public getSpawnPosition(x: number, z: number, modelLowestPoint: number = 0): Vector3 | null {
        const groundHeight = this.getGroundHeight(x, z, false); // Don't use cache for spawning

        if (groundHeight !== null) {
            return new Vector3(x, groundHeight - modelLowestPoint, z);
        }

        return null;
    }

    /**
     * Clear old cache entries to prevent memory buildup
     */
    public cleanCache(): void {
        const now = Date.now();
        for (const [key, value] of this.heightCache.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.heightCache.delete(key);
            }
        }
    }

    /**
     * Create cache key by snapping position to grid
     * This allows nearby positions to share cache entries
     */
    private getCacheKey(x: number, z: number): string {
        const gridX = Math.floor(x / this.GRID_SIZE) * this.GRID_SIZE;
        const gridZ = Math.floor(z / this.GRID_SIZE) * this.GRID_SIZE;
        return `${gridX.toFixed(1)}_${gridZ.toFixed(1)}`;
    }
}
