import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

/**
 * CollisionManager handles static object collision detection
 * Uses bounding box/sphere intersection for efficient collision checking
 * This is similar to how WoW handles collision with environmental objects
 */
export class CollisionManager {
    private collidableMeshes: Set<AbstractMesh> = new Set();
    private playerRadius: number = 0.5; // Collision capsule radius
    private debugMode: boolean = false;

    constructor(_scene: Scene) {
        // Scene stored for future use if needed
    }

    /**
     * Register a mesh as collidable
     * Creates simplified collision geometry for efficient checks
     */
    public registerCollidable(mesh: AbstractMesh): void {
        if (!mesh) return;

        // Compute bounding info for this mesh
        mesh.computeWorldMatrix(true);
        mesh.getBoundingInfo();
        mesh.refreshBoundingInfo();

        // Mark mesh as collidable
        mesh.checkCollisions = true;

        // Store in our collection
        this.collidableMeshes.add(mesh);
    }

    /**
     * Unregister a collidable mesh
     */
    public unregisterCollidable(mesh: AbstractMesh): void {
        this.collidableMeshes.delete(mesh);
        mesh.checkCollisions = false;
    }

    /**
     * Check if moving from 'from' to 'to' would cause a collision
     * Returns the corrected position if collision detected, or the target position if clear
     *
     * This uses a capsule collision model for the player (similar to WoW)
     */
    public checkCollision(
        from: Vector3,
        to: Vector3,
        playerRadius: number = this.playerRadius
    ): Vector3 {
        if (this.collidableMeshes.size === 0) {
            return to.clone();
        }

        // Calculate movement vector
        const movement = to.subtract(from);
        const distance = movement.length();

        if (distance < 0.001) {
            return to.clone();
        }

        let correctedPosition = to.clone();

        // Check collision with each registered mesh
        for (const mesh of this.collidableMeshes) {
            if (!mesh.isEnabled() || !mesh.isVisible) continue;

            const boundingInfo = mesh.getBoundingInfo();
            if (!boundingInfo) continue;

            // Get mesh bounding sphere for broad phase
            const meshCenter = boundingInfo.boundingSphere.centerWorld;
            const meshRadius = boundingInfo.boundingSphere.radiusWorld;

            // Broad phase: Check if player sphere could possibly intersect
            const distToMesh = Vector3.Distance(to, meshCenter);
            const combinedRadius = playerRadius + meshRadius;

            if (distToMesh < combinedRadius) {
                // Narrow phase: More precise collision check
                if (this.isPointInsideOrNearMesh(to, mesh, playerRadius)) {
                    // Instead of pushing out, just stop at current position
                    // This prevents bouncing/jittering
                    correctedPosition.x = from.x;
                    correctedPosition.z = from.z;
                    correctedPosition.y = to.y; // Allow vertical movement (jumping/falling)

                    // Early exit - we found a collision, use previous position
                    return correctedPosition;
                }
            }
        }

        return correctedPosition;
    }

    /**
     * Slide along collision surface instead of stopping completely
     * This gives smoother movement when colliding at an angle (like WoW)
     */
    public checkCollisionWithSliding(
        from: Vector3,
        to: Vector3,
        playerRadius: number = this.playerRadius
    ): Vector3 {
        // First check for direct collision
        const directResult = this.checkCollision(from, to, playerRadius);

        // If no collision occurred, return direct path
        if (Vector3.DistanceSquared(directResult, to) < 0.001) {
            return directResult;
        }

        // Collision detected - try sliding along the obstacle
        // This is the WoW-style sliding behavior

        // Try moving only along X axis
        const slideX = new Vector3(to.x, to.y, from.z);
        const resultX = this.checkCollision(from, slideX, playerRadius);
        const movedX = Vector3.DistanceSquared(from, resultX) > 0.0001;

        // Try moving only along Z axis
        const slideZ = new Vector3(from.x, to.y, to.z);
        const resultZ = this.checkCollision(from, slideZ, playerRadius);
        const movedZ = Vector3.DistanceSquared(from, resultZ) > 0.0001;

        // If we can move along X, use that
        if (movedX && !movedZ) {
            return resultX;
        }

        // If we can move along Z, use that
        if (movedZ && !movedX) {
            return resultZ;
        }

        // If we can move along both axes, choose the one that gives more movement
        if (movedX && movedZ) {
            const distX = Vector3.DistanceSquared(from, resultX);
            const distZ = Vector3.DistanceSquared(from, resultZ);
            return distX > distZ ? resultX : resultZ;
        }

        // Can't move in any direction - stop in place
        return new Vector3(from.x, to.y, from.z);
    }

    /**
     * Check if a point is inside or very close to a mesh's bounding volume
     */
    private isPointInsideOrNearMesh(
        point: Vector3,
        mesh: AbstractMesh,
        buffer: number = 0
    ): boolean {
        const boundingInfo = mesh.getBoundingInfo();
        if (!boundingInfo) return false;

        // Get bounding box
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;

        // Expand bounding box by buffer amount
        return (
            point.x >= min.x - buffer && point.x <= max.x + buffer &&
            point.z >= min.z - buffer && point.z <= max.z + buffer &&
            point.y >= min.y - buffer && point.y <= max.y + buffer
        );
    }

    /**
     * Set player collision radius
     */
    public setPlayerRadius(radius: number): void {
        this.playerRadius = radius;
    }

    /**
     * Get all collidable meshes
     */
    public getCollidableMeshes(): AbstractMesh[] {
        return Array.from(this.collidableMeshes);
    }

    /**
     * Clear all collidable meshes
     */
    public clearAll(): void {
        for (const mesh of this.collidableMeshes) {
            mesh.checkCollisions = false;
        }
        this.collidableMeshes.clear();
    }

    /**
     * Debug visualization of collision bounds
     */
    public enableDebugVisualization(enable: boolean): void {
        this.debugMode = enable;
        for (const mesh of this.collidableMeshes) {
            mesh.showBoundingBox = enable;
        }
        console.log(`Collision debug mode: ${enable ? 'ON' : 'OFF'}`);
        console.log(`Total collidable meshes: ${this.collidableMeshes.size}`);
    }

    public dispose(): void {
        this.clearAll();
    }
}
