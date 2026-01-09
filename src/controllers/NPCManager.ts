import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { NPC } from '../NPC';
import { TerrainService } from '../services/TerrainService';

export interface NPCUpdateResult {
    npcAttacks: Array<{ damage: number }>;
}

export class NPCManager {
    private npcs: NPC[] = [];
    private scene: Scene;
    private terrainService: TerrainService;

    constructor(scene: Scene) {
        this.scene = scene;
        this.terrainService = new TerrainService(scene);
    }

    public spawnNPCs(npcCount: number = 1): void {
        const spawnRadius = 40;

        const monsterModels = [
            'Slime.glb',
            'Bat.glb',
            'Skeleton.glb',
        ];

        for (let i = 0; i < npcCount; i++) {
            const angle = (Math.PI * 2 * i) / npcCount + Math.random() * 0.5;
            const distance = 10 + Math.random() * spawnRadius;

            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            // Use terrain service to get accurate spawn position
            // Start with a temporary position, NPC will snap to ground after model loads
            const tempSpawnPos = this.terrainService.getSpawnPosition(x, z, 0);
            const spawnPos = tempSpawnPos || new Vector3(x, 0, z);

            // Randomly select a monster model
            const modelName = monsterModels[i % monsterModels.length];

            const npc = new NPC(this.scene, spawnPos, `Enemy_${i}`, modelName, this.terrainService);
            this.npcs.push(npc);
        }

        console.log(`Spawned ${npcCount} NPCs with models: ${monsterModels.join(', ')}`);
    }

    public update(playerPosition: Vector3, deltaTime: number): NPCUpdateResult {
        const npcAttacks: Array<{ damage: number }> = [];

        // Periodically clean terrain cache to prevent memory buildup
        if (Math.random() < 0.01) { // ~1% chance per frame
            this.terrainService.cleanCache();
        }

        // Update each NPC and collect attack results
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];

            if (npc.health <= 0) {
                // Remove dead NPCs
                this.npcs.splice(i, 1);
                continue;
            }

            const result = npc.update(playerPosition, deltaTime);

            if (result.attacked) {
                npcAttacks.push({ damage: result.damage });
            }
        }

        return { npcAttacks };
    }

    public findNearestNPC(position: Vector3, maxDistance: number): NPC | null {
        let nearestNPC: NPC | null = null;
        let nearestDistance = maxDistance;

        for (const npc of this.npcs) {
            const distance = Vector3.Distance(position, npc.mesh.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestNPC = npc;
            }
        }

        return nearestNPC;
    }

    public getNPCCount(): number {
        return this.npcs.length;
    }

    public getAllNPCs(): NPC[] {
        return this.npcs.filter(npc => npc.health > 0);
    }

    public dispose(): void {
        // Clean up all NPCs
        this.npcs.forEach(npc => {
            if (npc.mesh) {
                npc.mesh.dispose();
            }
        });
        this.npcs = [];
    }
}
