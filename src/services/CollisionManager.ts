import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

/**
 * CollisionManager handles static object collision detection
 * Uses bounding box/sphere intersection for efficient collision checking
 * This is similar to how WoW handles collision with environmental objects
 */
export class CollisionManager {
    private collidableMeshes: Set<AbstractMesh> = new Set();
    private playerRadius: number = 0.5; // Collision capsule radius
    private debugMode: boolean = false;
    private debugMeshes: Map<AbstractMesh, Mesh> = new Map();
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Register a mesh as collidable
     * Creates simplified collision geometry for efficient checks
     */
    public registerCollidable(mesh: AbstractMesh): void {
        if (!mesh) return;

        // Skip meshes without geometry (empty parent nodes)
        const boundingInfo = mesh.getBoundingInfo();
        if (!boundingInfo) return;

        // Check if this mesh has actual geometry (not just a container)
        const boundingSize = boundingInfo.boundingBox.extendSize;
        const volume = boundingSize.x * boundingSize.y * boundingSize.z;

        // Skip if bounding box is too small (degenerate) or suspiciously large (likely a parent container)
        if (volume < 0.001 || volume > 10000) {
            return;
        }

        // Compute bounding info for this mesh
        mesh.computeWorldMatrix(true);

        // Mark mesh as collidable
        mesh.checkCollisions = true;

        // Store in our collection
        this.collidableMeshes.add(mesh);

        if (this.debugMode) {
            console.log(`Registered ${mesh.name} - volume: ${volume.toFixed(2)}, bounds: ${boundingSize.x.toFixed(2)}x${boundingSize.y.toFixed(2)}x${boundingSize.z.toFixed(2)}`);
            this.createDebugVisualization(mesh);
        }
    }

    /**
     * Unregister a collidable mesh
     */
    public unregisterCollidable(mesh: AbstractMesh): void {
        this.collidableMeshes.delete(mesh);
        mesh.checkCollisions = false;

        // Remove debug visualization
        const debugMesh = this.debugMeshes.get(mesh);
        if (debugMesh) {
            debugMesh.dispose();
            this.debugMeshes.delete(mesh);
        }
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
     * Create a custom debug visualization box for a collidable mesh
     */
    private createDebugVisualization(mesh: AbstractMesh): void {
        const boundingInfo = mesh.getBoundingInfo();
        if (!boundingInfo) return;

        const boundingBox = boundingInfo.boundingBox;
        const size = boundingBox.extendSize;
        const center = boundingBox.centerWorld;

        // Create a wireframe box matching the bounding box
        const debugBox = MeshBuilder.CreateBox(
            `debug_${mesh.name}`,
            {
                width: size.x * 2,
                height: size.y * 2,
                depth: size.z * 2
            },
            this.scene
        );

        // Position at the bounding box center
        debugBox.position = center.clone();

        // Make it wireframe and semi-transparent
        const debugMaterial = new StandardMaterial(`debugMat_${mesh.name}`, this.scene);
        debugMaterial.wireframe = true;
        debugMaterial.emissiveColor = new Color3(1, 0, 0); // Red
        debugMaterial.alpha = 0.6;
        debugBox.material = debugMaterial;

        // Don't let debug boxes collide or cast shadows
        debugBox.isPickable = false;
        debugBox.checkCollisions = false;

        // Store reference
        this.debugMeshes.set(mesh, debugBox);
    }

    /**
     * Debug visualization of collision bounds
     */
    public enableDebugVisualization(enable: boolean): void {
        this.debugMode = enable;

        console.log(`Collision debug mode: ${enable ? 'ON' : 'OFF'}`);

        if (enable) {
            // Create debug visualizations for all registered meshes
            for (const mesh of this.collidableMeshes) {
                this.createDebugVisualization(mesh);

                const boundingInfo = mesh.getBoundingInfo();
                const size = boundingInfo.boundingBox.extendSize;
                console.log(`  - ${mesh.name}: ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
            }
        } else {
            // Remove all debug visualizations
            for (const debugMesh of this.debugMeshes.values()) {
                debugMesh.dispose();
            }
            this.debugMeshes.clear();
        }

        console.log(`Total collidable meshes: ${this.collidableMeshes.size}`);
    }

    public dispose(): void {
        // Dispose all debug meshes
        for (const debugMesh of this.debugMeshes.values()) {
            debugMesh.dispose();
        }
        this.debugMeshes.clear();

        this.clearAll();
    }
}
