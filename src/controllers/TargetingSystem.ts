import { Vector3 } from '@babylonjs/core/Maths/math';
import { NPC } from '../NPC';

export class TargetingSystem {
    private currentTarget: NPC | null = null;

    public getCurrentTarget(): NPC | null {
        return this.currentTarget;
    }

    public setTarget(npc: NPC | null): void {
        this.currentTarget = npc;
    }

    public clearTarget(): void {
        this.currentTarget = null;
    }

    public hasTarget(): boolean {
        return this.currentTarget !== null && this.currentTarget.health > 0;
    }

    public cycleTarget(availableNPCs: NPC[], playerPosition: Vector3): NPC | null {
        if (availableNPCs.length === 0) {
            this.clearTarget();
            return null;
        }

        // Sort NPCs by distance to player
        const sortedNPCs = this.sortNPCsByDistance(availableNPCs, playerPosition);

        // If no current target or target is dead, select the nearest NPC
        if (!this.currentTarget || this.currentTarget.health <= 0) {
            this.setTarget(sortedNPCs[0]);
            return this.currentTarget;
        }

        // Find current target index
        const currentIndex = sortedNPCs.findIndex(npc => npc === this.currentTarget);

        // Select next target (cycle through)
        if (currentIndex === -1 || currentIndex === sortedNPCs.length - 1) {
            this.setTarget(sortedNPCs[0]);
        } else {
            this.setTarget(sortedNPCs[currentIndex + 1]);
        }

        return this.currentTarget;
    }

    public isTargetInRange(playerPosition: Vector3, range: number): boolean {
        if (!this.hasTarget() || !this.currentTarget) {
            return false;
        }

        const distance = Vector3.Distance(playerPosition, this.currentTarget.mesh.position);
        return distance <= range;
    }

    public isTargetInFront(playerPosition: Vector3, playerRotation: number, fieldOfView: number = Math.PI / 2): boolean {
        if (!this.hasTarget() || !this.currentTarget) {
            return false;
        }

        // Calculate direction from player to target
        const directionToTarget = this.currentTarget.mesh.position.subtract(playerPosition);
        const angleToTarget = Math.atan2(directionToTarget.x, directionToTarget.z);

        // Normalize angles to [-PI, PI]
        const normalizeAngle = (angle: number): number => {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        };

        const normalizedPlayerRotation = normalizeAngle(playerRotation);
        const normalizedTargetAngle = normalizeAngle(angleToTarget);

        // Calculate angle difference
        let angleDiff = Math.abs(normalizedTargetAngle - normalizedPlayerRotation);
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
        }

        // Check if target is within field of view
        return angleDiff <= fieldOfView;
    }

    private sortNPCsByDistance(npcs: NPC[], position: Vector3): NPC[] {
        return npcs
            .map(npc => ({
                npc,
                distance: Vector3.Distance(position, npc.mesh.position)
            }))
            .sort((a, b) => a.distance - b.distance)
            .map(item => item.npc);
    }
}
