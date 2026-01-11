import { Scene, Vector3, ParticleSystem, Texture, Color4 } from '@babylonjs/core';

export class ParticleManager {
    private scene: Scene;
    private activeParticleSystems: ParticleSystem[] = [];

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Creates a blood splatter effect at the specified position
     * @param position World position where the blood splatter should appear
     * @param intensity How intense the splatter should be (affects particle count)
     */
    public createBloodSplatter(position: Vector3, intensity: number = 1.0): void {
        const particleSystem = new ParticleSystem(
            "bloodSplatter",
            Math.floor(30 * intensity), // Base 30 particles, scaled by intensity
            this.scene
        );

        // Use a custom texture for blood particles (you can replace with actual texture later)
        // For now, we'll use the default particle texture which will be tinted red
        try {
            // Try to load a particle texture if available
            particleSystem.particleTexture = new Texture("textures/flare.png", this.scene);
        } catch {
            // If texture doesn't exist, particles will still render as colored points
            particleSystem.particleTexture = new Texture("", this.scene);
        }

        // Set the emitter position
        particleSystem.emitter = position.clone();
        particleSystem.minEmitBox = new Vector3(-0.1, 0, -0.1);
        particleSystem.maxEmitBox = new Vector3(0.1, 0.2, 0.1);

        // Blood colors - dark red to bright red
        particleSystem.color1 = new Color4(0.8, 0.0, 0.0, 1.0); // Bright red
        particleSystem.color2 = new Color4(0.4, 0.0, 0.0, 1.0); // Dark red
        particleSystem.colorDead = new Color4(0.2, 0.0, 0.0, 0.0); // Fade to transparent dark red

        // Size of each particle
        particleSystem.minSize = 0.05;
        particleSystem.maxSize = 0.15;

        // Life time of each particle (in seconds)
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 0.8;

        // Emission rate - emit all particles at once (burst)
        particleSystem.emitRate = 1000;
        particleSystem.manualEmitCount = Math.floor(30 * intensity);

        // Blend mode for blood (makes it look more like liquid)
        particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

        // Speed and direction
        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 4;
        particleSystem.updateSpeed = 0.016; // 60 FPS

        // Gravity effect (blood falls down)
        particleSystem.gravity = new Vector3(0, -9.81, 0);

        // Direction - emit in random directions (splatter effect)
        particleSystem.direction1 = new Vector3(-1, 0.5, -1);
        particleSystem.direction2 = new Vector3(1, 1.5, 1);

        // Angular velocity for rotation
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;

        // Start the particle system
        particleSystem.start();

        // Store reference
        this.activeParticleSystems.push(particleSystem);

        // Auto-dispose after particles die
        const maxLifeTime = particleSystem.maxLifeTime;
        setTimeout(() => {
            particleSystem.stop();
            setTimeout(() => {
                particleSystem.dispose();
                const index = this.activeParticleSystems.indexOf(particleSystem);
                if (index > -1) {
                    this.activeParticleSystems.splice(index, 1);
                }
            }, 100); // Small delay to ensure all particles are gone
        }, maxLifeTime * 1000);
    }

    /**
     * Creates a more intense blood splatter for critical hits or kills
     * @param position World position where the blood splatter should appear
     */
    public createCriticalBloodSplatter(position: Vector3): void {
        // Create multiple splatter effects for a more dramatic effect
        this.createBloodSplatter(position, 1.5);

        // Add a second burst with slight delay for extra impact
        setTimeout(() => {
            this.createBloodSplatter(position.add(new Vector3(0, 0.2, 0)), 1.0);
        }, 50);
    }

    /**
     * Creates a directional blood spray effect (e.g., when hit from a specific direction)
     * @param position World position where the blood spray should appear
     * @param direction Direction the blood should spray towards
     * @param intensity How intense the spray should be
     */
    public createBloodSpray(position: Vector3, direction: Vector3, intensity: number = 1.0): void {
        const particleSystem = new ParticleSystem(
            "bloodSpray",
            Math.floor(40 * intensity),
            this.scene
        );

        try {
            particleSystem.particleTexture = new Texture("textures/flare.png", this.scene);
        } catch {
            particleSystem.particleTexture = new Texture("", this.scene);
        }

        particleSystem.emitter = position.clone();
        particleSystem.minEmitBox = new Vector3(-0.05, 0, -0.05);
        particleSystem.maxEmitBox = new Vector3(0.05, 0.1, 0.05);

        // Blood colors
        particleSystem.color1 = new Color4(0.9, 0.0, 0.0, 1.0);
        particleSystem.color2 = new Color4(0.5, 0.0, 0.0, 1.0);
        particleSystem.colorDead = new Color4(0.3, 0.0, 0.0, 0.0);

        particleSystem.minSize = 0.03;
        particleSystem.maxSize = 0.12;

        particleSystem.minLifeTime = 0.4;
        particleSystem.maxLifeTime = 1.0;

        particleSystem.emitRate = 1000;
        particleSystem.manualEmitCount = Math.floor(40 * intensity);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

        // Directional spray - particles move in the hit direction
        const normalizedDir = direction.normalize();
        particleSystem.minEmitPower = 3;
        particleSystem.maxEmitPower = 6;
        particleSystem.updateSpeed = 0.016;

        particleSystem.gravity = new Vector3(0, -9.81, 0);

        // Cone-shaped spray in the direction
        const perpendicular = Vector3.Cross(normalizedDir, Vector3.Up()).normalize();
        particleSystem.direction1 = normalizedDir.add(perpendicular.scale(-0.3));
        particleSystem.direction2 = normalizedDir.add(perpendicular.scale(0.3));

        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI * 2;

        particleSystem.start();
        this.activeParticleSystems.push(particleSystem);

        const maxLifeTime = particleSystem.maxLifeTime;
        setTimeout(() => {
            particleSystem.stop();
            setTimeout(() => {
                particleSystem.dispose();
                const index = this.activeParticleSystems.indexOf(particleSystem);
                if (index > -1) {
                    this.activeParticleSystems.splice(index, 1);
                }
            }, 100);
        }, maxLifeTime * 1000);
    }

    /**
     * Cleanup all active particle systems
     */
    public dispose(): void {
        this.activeParticleSystems.forEach(ps => {
            ps.stop();
            ps.dispose();
        });
        this.activeParticleSystems = [];
    }

    /**
     * Update loop (call this in your game loop if needed for custom particle updates)
     */
    public update(_deltaTime: number): void {
        // Currently particles are self-managing, but this method is here
        // for future extensions that might need per-frame updates
    }
}
