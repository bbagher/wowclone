import { Vector3, Matrix } from '@babylonjs/core/Maths/math';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';

export enum DamageType {
    Outgoing = 'outgoing',  // Damage dealt by player
    Incoming = 'incoming'   // Damage received by player
}

interface FloatingText {
    element: HTMLDivElement;
    startTime: number;
    duration: number;
    worldPosition: Vector3;
    initialY: number;
    velocity: number;
}

export class CombatTextManager {
    private container: HTMLDivElement;
    private floatingTexts: FloatingText[] = [];
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;

        // Create container for floating text
        this.container = document.createElement('div');
        this.container.id = 'combat-text-container';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '1000';
        document.body.appendChild(this.container);

        // Register update loop
        this.scene.registerBeforeRender(() => {
            this.update();
        });
    }

    public showDamage(amount: number, worldPosition: Vector3, damageType: DamageType): void {
        const element = document.createElement('div');
        element.className = 'combat-text';
        element.textContent = Math.round(amount).toString();

        // Style based on damage type
        if (damageType === DamageType.Outgoing) {
            element.style.color = '#ffff00'; // Yellow for damage dealt
            element.style.textShadow = '0 0 10px #ff8800, 2px 2px 6px rgba(0,0,0,1)';
            element.style.fontSize = '28px';
        } else {
            element.style.color = '#ff3333'; // Red for damage received
            element.style.textShadow = '0 0 10px #aa0000, 2px 2px 6px rgba(0,0,0,1)';
            element.style.fontSize = '26px';
        }

        element.style.position = 'absolute';
        element.style.fontWeight = 'bold';
        element.style.pointerEvents = 'none';
        element.style.userSelect = 'none';
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.whiteSpace = 'nowrap';

        this.container.appendChild(element);

        // Add slight random offset to prevent stacking
        const offsetX = (Math.random() - 0.5) * 1.5;
        const offsetZ = (Math.random() - 0.5) * 1.5;
        const startHeight = 2.0; // Start higher above the target

        const offsetPosition = new Vector3(
            worldPosition.x + offsetX,
            worldPosition.y + startHeight,
            worldPosition.z + offsetZ
        );

        this.floatingTexts.push({
            element,
            startTime: performance.now(),
            duration: 3000, // 2 seconds total
            worldPosition: offsetPosition,
            initialY: offsetPosition.y,
            velocity: 0.04 // Units per frame to rise
        });
    }

    public showHeal(amount: number, worldPosition: Vector3): void {
        const element = document.createElement('div');
        element.className = 'combat-text';
        element.textContent = `+${Math.round(amount)}`;
        element.style.color = '#00ff00'; // Green for healing
        element.style.textShadow = '0 0 10px #00aa00, 2px 2px 6px rgba(0,0,0,1)';
        element.style.position = 'absolute';
        element.style.fontSize = '26px';
        element.style.fontWeight = 'bold';
        element.style.pointerEvents = 'none';
        element.style.userSelect = 'none';
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.whiteSpace = 'nowrap';

        this.container.appendChild(element);

        const startHeight = 2.0;
        const offsetPosition = worldPosition.clone().add(new Vector3(0, startHeight, 0));

        this.floatingTexts.push({
            element,
            startTime: performance.now(),
            duration: 2000,
            worldPosition: offsetPosition,
            initialY: offsetPosition.y,
            velocity: 0.08
        });
    }

    private update(): void {
        const camera = this.scene.activeCamera;
        if (!camera) return;

        const currentTime = performance.now();
        const textsToRemove: FloatingText[] = [];

        for (const floatingText of this.floatingTexts) {
            const elapsed = currentTime - floatingText.startTime;
            const progress = elapsed / floatingText.duration;

            if (progress >= 1) {
                textsToRemove.push(floatingText);
                continue;
            }

            // Update world position (float upward with easing)
            // Use easeOut for more natural floating
            const easeOut = 1 - Math.pow(1 - progress, 2);
            floatingText.worldPosition.y = floatingText.initialY + (easeOut * 3); // Float up 3 units total

            // Convert world position to screen position
            const screenPos = this.worldToScreen(floatingText.worldPosition, camera);

            if (screenPos) {
                floatingText.element.style.left = `${screenPos.x}px`;
                floatingText.element.style.top = `${screenPos.y}px`;
                floatingText.element.style.transform = 'translate(-50%, -50%)';

                // Scale up slightly at start, then back to normal
                let scale = 1.0;
                if (progress < 0.2) {
                    scale = 1.0 + (progress / 0.2) * 0.3; // Scale from 1.0 to 1.3
                } else if (progress < 0.4) {
                    scale = 1.3 - ((progress - 0.2) / 0.2) * 0.3; // Scale from 1.3 back to 1.0
                }

                // Fade out in the last 60% of duration
                let opacity = 1.0;
                if (progress > 0.4) {
                    const fadeProgress = (progress - 0.4) / 0.6; // 0 to 1
                    opacity = 1 - fadeProgress;
                }

                floatingText.element.style.opacity = opacity.toString();
                floatingText.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
            } else {
                // If not visible on screen, still keep it if it's recent
                if (progress > 0.3) {
                    textsToRemove.push(floatingText);
                }
            }
        }

        // Clean up expired texts
        for (const text of textsToRemove) {
            text.element.remove();
            const index = this.floatingTexts.indexOf(text);
            if (index > -1) {
                this.floatingTexts.splice(index, 1);
            }
        }
    }

    private worldToScreen(position: Vector3, camera: Camera): { x: number; y: number } | null {
        const engine = this.scene.getEngine();
        const width = engine.getRenderWidth();
        const height = engine.getRenderHeight();

        // Get the transformation matrix (view * projection)
        const transformMatrix = camera.getTransformationMatrix();

        // Project the 3D world position to screen coordinates
        const screenPos = Vector3.Project(
            position,
            Matrix.Identity(), // World matrix (identity for world space positions)
            transformMatrix,   // View * Projection matrix
            camera.viewport.toGlobal(width, height)
        );

        // Check if position is behind camera or outside frustum
        if (screenPos.z < 0 || screenPos.z > 1) {
            return null;
        }

        return {
            x: screenPos.x,
            y: screenPos.y
        };
    }

    public dispose(): void {
        this.container.remove();
        this.floatingTexts = [];
    }
}
