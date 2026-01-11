import { Pathfinder } from '../wasm/game_physics';
import { CollisionManager } from './CollisionManager';
import { Vector3 } from '@babylonjs/core/Maths/math';

/**
 * PathfindingService provides WASM-based A* pathfinding for NPCs
 *
 * This service creates a navigation grid based on the collision system
 * and provides methods for finding paths and random walkable positions.
 */
export class PathfindingService {
    private pathfinder: Pathfinder;
    private readonly worldSize: number;
    private readonly cellSize: number;
    private readonly gridSize: number;
    private isInitialized: boolean = false;

    /**
     * @param worldSize - Total size of the game world (should match GROUND_SIZE)
     * @param cellSize - Size of each navigation grid cell (smaller = more precise but slower)
     */
    constructor(worldSize: number = 100, cellSize: number = 1.0) {
        this.worldSize = worldSize;
        this.cellSize = cellSize;
        this.gridSize = Math.ceil(worldSize / cellSize);

        // Initialize WASM pathfinder
        this.pathfinder = new Pathfinder(this.gridSize, this.cellSize, this.worldSize);
    }

    /**
     * Build the navigation grid from collision data
     * Must be called after environment assets are loaded
     */
    public buildNavigationGrid(collisionManager: CollisionManager): void {
        console.log('Building navigation grid...');

        const halfWorld = this.worldSize / 2;
        const colliders = (collisionManager as any).colliders;

        if (!colliders || colliders.length === 0) {
            console.warn('No colliders found in CollisionManager');
            this.isInitialized = true;
            return;
        }

        // Mark all collider positions as blocked
        for (const collider of colliders) {
            const position = collider.position;

            // Mark circular area as blocked based on collider radius
            const radius = collider.radius || 1.0;
            this.pathfinder.set_blocked_circle(position.x, position.z, radius);
        }

        // Mark out-of-bounds areas as blocked
        const margin = this.cellSize;
        for (let x = -halfWorld; x <= halfWorld; x += this.cellSize) {
            for (let z = -halfWorld; z <= halfWorld; z += this.cellSize) {
                const isOutOfBounds =
                    Math.abs(x) > (halfWorld - margin) ||
                    Math.abs(z) > (halfWorld - margin);

                if (isOutOfBounds) {
                    this.pathfinder.set_blocked(x, z);
                }
            }
        }

        this.isInitialized = true;
        console.log(`Navigation grid built: ${this.gridSize}x${this.gridSize} cells`);
    }

    /**
     * Find a path from start to goal using A* algorithm
     *
     * @returns Array of waypoints [Vector3, Vector3, ...] or empty array if no path found
     */
    public findPath(start: Vector3, goal: Vector3): Vector3[] {
        if (!this.isInitialized) {
            console.warn('PathfindingService not initialized. Call buildNavigationGrid() first.');
            return [];
        }

        // Get path from WASM (returns flat array: [x1, z1, x2, z2, ...])
        const flatPath = this.pathfinder.find_path(start.x, start.z, goal.x, goal.z);

        if (flatPath.length === 0) {
            return [];
        }

        // Convert flat array to Vector3 array
        const path: Vector3[] = [];
        for (let i = 0; i < flatPath.length; i += 2) {
            const x = flatPath[i];
            const z = flatPath[i + 1];
            // Use start Y position as base (terrain height will be applied later)
            path.push(new Vector3(x, start.y, z));
        }

        return path;
    }

    /**
     * Get a random walkable position within radius of a center point
     * Useful for wandering behavior
     */
    public getRandomWalkablePosition(center: Vector3, radius: number): Vector3 | null {
        if (!this.isInitialized) {
            console.warn('PathfindingService not initialized. Call buildNavigationGrid() first.');
            return null;
        }

        const result = this.pathfinder.get_random_walkable_position(center.x, center.z, radius);

        if (result.length === 2) {
            return new Vector3(result[0], center.y, result[1]);
        }

        return null;
    }

    /**
     * Check if a position is walkable (not blocked by obstacles)
     */
    public isWalkable(position: Vector3): boolean {
        if (!this.isInitialized) {
            return false;
        }

        return this.pathfinder.is_walkable(position.x, position.z);
    }

    /**
     * Manually mark a position as blocked (useful for dynamic obstacles)
     */
    public setBlocked(position: Vector3, radius: number = 0.5): void {
        if (!this.isInitialized) {
            return;
        }

        if (radius > this.cellSize) {
            this.pathfinder.set_blocked_circle(position.x, position.z, radius);
        } else {
            this.pathfinder.set_blocked(position.x, position.z);
        }
    }

    /**
     * Get navigation grid info for debugging
     */
    public getGridInfo(): { worldSize: number; cellSize: number; gridSize: number; initialized: boolean } {
        return {
            worldSize: this.worldSize,
            cellSize: this.cellSize,
            gridSize: this.gridSize,
            initialized: this.isInitialized,
        };
    }
}
