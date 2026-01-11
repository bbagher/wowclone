import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import collisionConfigData from '../collision-config.json';

interface CollisionConfig {
    radius: number;
    height: number;
    offsetY: number;
    enabled: boolean;
}

interface CustomCollisionData {
    center: Vector3;
    radius: number;
    minY: number;
    maxY: number;
}

type CollisionConfigMap = Record<string, CollisionConfig>;
const collisionConfig = collisionConfigData as CollisionConfigMap;

/**
 * CollisionManager handles static object collision detection
 * Uses custom cylindrical collision shapes defined in collision-config.json
 * This is similar to how WoW handles collision with environmental objects
 */
export class CollisionManager {
    private collidableMeshes: Set<AbstractMesh> = new Set();
    private customCollisions: Map<AbstractMesh, CustomCollisionData> = new Map();
    private playerRadius: number = 0.5; // Collision capsule radius
    private debugMode: boolean = false;
    private debugMeshes: Map<AbstractMesh, Mesh> = new Map();
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Extract the asset filename from a mesh's metadata or name
     */
    private getAssetName(mesh: AbstractMesh): string | null {
        // Check metadata first
        if (mesh.metadata?.assetName) {
            return mesh.metadata.assetName;
        }

        // Try to find it from the root parent's name
        let current: AbstractMesh | null = mesh;
        while (current) {
            if (current.name && current.name.includes('.gltf')) {
                return current.name;
            }
            current = current.parent as AbstractMesh | null;
        }

        return null;
    }

    /**
     * Register a mesh as collidable
     * Uses custom collision shapes from collision-config.json if available
     */
    public registerCollidable(mesh: AbstractMesh, assetName?: string): void {
        if (!mesh) return;

        const boundingInfo = mesh.getBoundingInfo();
        if (!boundingInfo) return;

        // Compute bounding info for this mesh
        mesh.computeWorldMatrix(true);

        // Try to get asset name
        const meshAssetName = assetName || this.getAssetName(mesh);

        // Check if we have custom collision config for this asset
        if (meshAssetName && collisionConfig[meshAssetName]) {
            const config = collisionConfig[meshAssetName];

            // Skip if collision is disabled for this asset
            if (!config.enabled) {
                if (this.debugMode) {
                    console.log(`Skipping ${meshAssetName} - collision disabled in config`);
                }
                return;
            }

            // Get mesh position (use world position)
            const position = mesh.getAbsolutePosition();

            // Create custom collision data using the configured cylinder
            const customData: CustomCollisionData = {
                center: new Vector3(position.x, position.y + config.height / 2 + config.offsetY, position.z),
                radius: config.radius,
                minY: position.y + config.offsetY,
                maxY: position.y + config.offsetY + config.height
            };

            this.customCollisions.set(mesh, customData);
            this.collidableMeshes.add(mesh);

            if (this.debugMode) {
                console.log(`Registered ${meshAssetName} with custom collision - radius: ${config.radius}, height: ${config.height}`);
                this.createDebugVisualization(mesh);
            }
        } else {
            // Fall back to automatic bounding box collision
            const boundingSize = boundingInfo.boundingBox.extendSize;
            const volume = boundingSize.x * boundingSize.y * boundingSize.z;

            // Skip if bounding box is too small (degenerate) or suspiciously large (likely a parent container)
            if (volume < 0.001 || volume > 10000) {
                return;
            }

            // Mark mesh as collidable
            mesh.checkCollisions = true;

            // Store in our collection
            this.collidableMeshes.add(mesh);

            if (this.debugMode) {
                console.log(`Registered ${mesh.name} with auto collision - volume: ${volume.toFixed(2)}, bounds: ${boundingSize.x.toFixed(2)}x${boundingSize.y.toFixed(2)}x${boundingSize.z.toFixed(2)}`);
                this.createDebugVisualization(mesh);
            }
        }
    }

    /**
     * Unregister a collidable mesh
     */
    public unregisterCollidable(mesh: AbstractMesh): void {
        this.collidableMeshes.delete(mesh);
        this.customCollisions.delete(mesh);
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

            // Check if this mesh has custom collision data
            const customData = this.customCollisions.get(mesh);

            if (customData) {
                // Use custom cylindrical collision
                if (this.checkCylinderCollision(to, playerRadius, customData)) {
                    // Collision detected - stop at previous position
                    correctedPosition.x = from.x;
                    correctedPosition.z = from.z;
                    correctedPosition.y = to.y; // Allow vertical movement (jumping/falling)
                    return correctedPosition;
                }
            } else {
                // Use default bounding box collision
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
     * Check collision with a custom cylindrical collision shape
     * Returns true if the player (at position with radius) collides with the cylinder
     */
    private checkCylinderCollision(
        playerPos: Vector3,
        playerRadius: number,
        cylinderData: CustomCollisionData
    ): boolean {
        // First check Y bounds (height check)
        // If player is standing on top (at maxY), don't block horizontal movement
        const standingOnTop = Math.abs(playerPos.y - cylinderData.maxY) < 0.1;
        if (standingOnTop) {
            return false; // Allow walking on top
        }

        if (playerPos.y < cylinderData.minY || playerPos.y > cylinderData.maxY) {
            return false;
        }

        // Check horizontal distance (2D circle collision in XZ plane)
        const dx = playerPos.x - cylinderData.center.x;
        const dz = playerPos.z - cylinderData.center.z;
        const horizontalDistSq = dx * dx + dz * dz;
        const combinedRadius = playerRadius + cylinderData.radius;

        return horizontalDistSq < combinedRadius * combinedRadius;
    }

    /**
     * Check if player should land on top of a cylinder (rock, platform, etc.)
     * Returns the top Y position if player should land on top, otherwise null
     *
     * This allows jumping on top of rocks and other collidable objects
     */
    public checkLandOnTop(
        position: Vector3,
        playerRadius: number = this.playerRadius
    ): number | null {
        if (this.collidableMeshes.size === 0) {
            return null;
        }

        let highestTopY: number | null = null;

        // Check all collidable meshes
        for (const mesh of this.collidableMeshes) {
            if (!mesh.isEnabled() || !mesh.isVisible) continue;

            const customData = this.customCollisions.get(mesh);
            if (!customData) continue; // Only check objects with custom collision data

            // Check horizontal distance (2D circle collision in XZ plane)
            const dx = position.x - customData.center.x;
            const dz = position.z - customData.center.z;
            const horizontalDistSq = dx * dx + dz * dz;
            const combinedRadius = playerRadius + customData.radius;

            // If player is within horizontal bounds of the cylinder
            if (horizontalDistSq < combinedRadius * combinedRadius) {
                // Check if player is at or above the top of the cylinder
                // We use a small threshold to allow for landing
                const topY = customData.maxY;

                // Only consider this surface if it's below the player (falling/landing)
                // and it's the highest one we've found
                if (position.y >= topY - 0.5) { // 0.5 unit threshold for landing detection
                    if (highestTopY === null || topY > highestTopY) {
                        highestTopY = topY;
                    }
                }
            }
        }

        return highestTopY;
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
     * Create a custom debug visualization for a collidable mesh
     */
    private createDebugVisualization(mesh: AbstractMesh): void {
        const customData = this.customCollisions.get(mesh);

        let debugShape: Mesh;

        if (customData) {
            // Create a wireframe cylinder for custom collision
            debugShape = MeshBuilder.CreateCylinder(
                `debug_${mesh.name}`,
                {
                    height: customData.maxY - customData.minY,
                    diameter: customData.radius * 2,
                    tessellation: 16
                },
                this.scene
            );

            // Position at the cylinder center
            debugShape.position = customData.center.clone();
        } else {
            // Create a wireframe box for default bounding box collision
            const boundingInfo = mesh.getBoundingInfo();
            if (!boundingInfo) return;

            const boundingBox = boundingInfo.boundingBox;
            const size = boundingBox.extendSize;
            const center = boundingBox.centerWorld;

            debugShape = MeshBuilder.CreateBox(
                `debug_${mesh.name}`,
                {
                    width: size.x * 2,
                    height: size.y * 2,
                    depth: size.z * 2
                },
                this.scene
            );

            // Position at the bounding box center
            debugShape.position = center.clone();
        }

        // Make it wireframe and semi-transparent
        const debugMaterial = new StandardMaterial(`debugMat_${mesh.name}`, this.scene);
        debugMaterial.wireframe = true;
        debugMaterial.emissiveColor = customData ? new Color3(0, 1, 0) : new Color3(1, 0, 0); // Green for custom, Red for default
        debugMaterial.alpha = 0.6;
        debugShape.material = debugMaterial;

        // Don't let debug shapes collide or cast shadows
        debugShape.isPickable = false;
        debugShape.checkCollisions = false;

        // Store reference
        this.debugMeshes.set(mesh, debugShape);
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
