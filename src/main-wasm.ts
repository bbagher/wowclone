import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

// Import loaders
import '@babylonjs/loaders/glTF';

// Import required for side effects
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// WASM physics engine
import init, { PlayerPhysics } from './wasm/game_physics.js';

// Import controllers
import { WasmPlayerController } from './controllers/WasmPlayerController';
import { CameraController } from './controllers/CameraController';
import { InputManager } from './controllers/InputManager';
import { EnvironmentManager } from './controllers/EnvironmentManager';
import { NPCManager } from './controllers/NPCManager';
import { CombatSystem } from './controllers/CombatSystem';
import { GameConfig } from './config';

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private cameraController: CameraController;
    private playerController: WasmPlayerController;
    private inputManager: InputManager;
    private environmentManager: EnvironmentManager;
    private npcManager: NPCManager;
    private combatSystem: CombatSystem;
    private shadowGenerator: ShadowGenerator | null = null;
    private physics!: PlayerPhysics;

    // UI tracking
    private frameCount = 0;
    private lastFpsUpdateTime = 0;
    private currentFps = 0;

    // Resource cleanup
    private resizeHandler: (() => void) | null = null;

    constructor() {
        this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        // Enable animations in the scene
        this.scene.animationsEnabled = true;

        // Initialize controllers (physics initialized in init())
        this.cameraController = new CameraController(this.scene, this.canvas);
        this.inputManager = new InputManager(this.canvas, this.scene);
        this.combatSystem = new CombatSystem();

        // These will be initialized after async setup
        this.playerController = null as any; // Temporary
        this.environmentManager = null as any; // Temporary
        this.npcManager = new NPCManager(this.scene);

        this.init();
    }

    private async init() {
        console.log('Initializing game...');

        // Initialize WASM module
        console.log('Loading WASM physics engine...');
        await init();
        this.physics = new PlayerPhysics();
        console.log('WASM physics engine loaded!');

        // Now we can create player controller
        this.playerController = new WasmPlayerController(this.scene, this.physics);

        this.setupLights();
        console.log('Lights setup complete');

        await this.createEnvironment();
        console.log('Environment created');

        await this.createPlayer();
        console.log('Player created');

        this.spawnNPCs();
        console.log('NPCs spawned');

        this.inputManager.setup();
        console.log('Input setup complete');

        this.setupUI();
        console.log('UI setup complete');

        console.log('Starting render loop...');
        // Start render loop
        this.engine.runRenderLoop(() => {
            this.update();
            this.scene.render();
        });

        console.log('Game initialization complete!');

        // Handle window resize
        this.resizeHandler = () => {
            this.engine.resize();
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    private setupLights() {
        // Ambient light
        const hemisphericLight = new HemisphericLight(
            'hemiLight',
            new Vector3(0, 1, 0),
            this.scene
        );
        hemisphericLight.intensity = 0.6;
        hemisphericLight.diffuse = new Color3(0.8, 0.9, 1.0);
        hemisphericLight.groundColor = new Color3(0.4, 0.3, 0.2);

        // Sun light for shadows
        const sunLight = new DirectionalLight(
            'sunLight',
            new Vector3(-1, -2, -1),
            this.scene
        );
        sunLight.position = new Vector3(20, 40, 20);
        sunLight.intensity = 0.8;

        // Shadow generator
        this.shadowGenerator = new ShadowGenerator(GameConfig.SHADOW_MAP_SIZE, sunLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurScale = GameConfig.SHADOW_BLUR_SCALE;

        // Sky color
        this.scene.clearColor = new Color4(0.5, 0.7, 0.9, 1.0);
    }

    private async createEnvironment() {
        if (!this.shadowGenerator) {
            throw new Error('Shadow generator not initialized');
        }

        this.environmentManager = new EnvironmentManager(this.scene, this.shadowGenerator);
        await this.environmentManager.createGround();
        await this.environmentManager.loadNatureAssets();
    }

    private async createPlayer() {
        if (!this.shadowGenerator) {
            throw new Error('Shadow generator not initialized');
        }

        await this.playerController.loadPlayer(this.shadowGenerator);

        const playerMesh = this.playerController.getMesh();
        if (playerMesh) {
            this.cameraController.setTarget(playerMesh);
        }

        // Setup animation buttons
        const animController = this.playerController.getAnimationController();
        if (animController) {
            animController.setButtonContainer('animation-buttons');
        }
    }

    private spawnNPCs() {
        this.npcManager.spawnNPCs(1);
    }

    private setupUI() {
        const fpsElement = document.getElementById('fps');
        const posElement = document.getElementById('position');
        const healthText = document.getElementById('health-text');
        const healthFill = document.getElementById('health-fill');
        const npcCount = document.getElementById('npc-count');

        this.scene.registerBeforeRender(() => {
            // Calculate real-time FPS (not averaged)
            const currentTime = performance.now();
            this.frameCount++;

            // Update FPS display every 100ms for smoother reading
            if (currentTime - this.lastFpsUpdateTime >= GameConfig.FPS_UPDATE_INTERVAL) {
                const elapsed = currentTime - this.lastFpsUpdateTime;
                this.currentFps = (this.frameCount / elapsed) * 1000;
                this.frameCount = 0;
                this.lastFpsUpdateTime = currentTime;

                if (fpsElement) {
                    fpsElement.textContent = this.currentFps.toFixed(1);
                }
            }

            const playerMesh = this.playerController.getMesh();
            if (posElement && playerMesh) {
                const pos = playerMesh.position;
                posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
            }

            // Update health display
            if (healthText) {
                healthText.textContent = `${Math.max(0, this.combatSystem.getHealth()).toFixed(0)}/${this.combatSystem.getMaxHealth()}`;
            }
            if (healthFill) {
                const healthPercent = this.combatSystem.getHealthPercent();
                healthFill.style.width = `${Math.max(0, healthPercent)}%`;

                // Change color based on health
                if (healthPercent > 50) {
                    healthFill.style.background = 'linear-gradient(to bottom, #00ff00, #00aa00)';
                } else if (healthPercent > 25) {
                    healthFill.style.background = 'linear-gradient(to bottom, #ffaa00, #ff8800)';
                } else {
                    healthFill.style.background = 'linear-gradient(to bottom, #ff0000, #aa0000)';
                }
            }

            // Update NPC count
            if (npcCount) {
                npcCount.textContent = `${this.npcManager.getNPCCount()}`;
            }
        });

        // Setup vertical offset slider
        const slider = document.getElementById('vertical-offset') as HTMLInputElement;
        const offsetValue = document.getElementById('offset-value');

        if (slider && offsetValue) {
            slider.addEventListener('input', () => {
                const adjustment = parseFloat(slider.value);
                offsetValue.textContent = adjustment.toFixed(1);
                this.playerController.setSkeletonVerticalOffset(adjustment);
            });
        }

        // Setup attack key (F)
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();

            if (kbInfo.type === GameConfig.KEYBOARD_EVENT_TYPE.KEY_DOWN && key === 'f') {
                this.performAttack();
            }
        });
    }

    private performAttack() {
        const playerMesh = this.playerController.getMesh();
        if (!playerMesh) return;

        // Play attack animation
        const attacked = this.playerController.performAttack();
        if (!attacked) return;

        // Find and attack nearest NPC
        const nearestNPC = this.npcManager.findNearestNPC(
            playerMesh.position,
            this.combatSystem.getAttackRange()
        );

        if (nearestNPC) {
            const isDead = nearestNPC.takeDamage(this.combatSystem.getAttackDamage());
            if (isDead) {
                console.log(`Killed ${nearestNPC.mesh.name}!`);
            } else {
                console.log(`Hit ${nearestNPC.mesh.name}! Health: ${nearestNPC.health}/${nearestNPC.maxHealth}`);
            }
        }
    }

    private update() {
        const playerMesh = this.playerController.getMesh();
        if (!playerMesh) return;

        // Get input and update player
        const input = this.inputManager.getMovementInput();
        this.playerController.update(input, this.cameraController);

        // WoW-style: Continuously rotate character to match camera while right-clicking
        if (this.cameraController.isRightMouseDragging()) {
            const cameraAlpha = this.cameraController.getAlpha();
            this.playerController.smoothRotateToMatchCamera(cameraAlpha);
        }

        // Check if character is moving or rotating
        const isMoving = input.forward || input.backward || input.left || input.right;
        const isRotating = input.rotateLeft || input.rotateRight;

        // Update camera (lock behind character when rotating, auto-realign when not dragging and not moving)
        this.cameraController.update(isMoving, isRotating);

        // Update NPCs
        const deltaTime = 1.0; // This should ideally come from physics system
        const npcUpdateResult = this.npcManager.update(playerMesh.position, deltaTime);

        // Apply NPC damage to player
        npcUpdateResult.npcAttacks.forEach(attack => {
            this.combatSystem.takeDamage(attack.damage);
        });
    }

    public dispose(): void {
        // Clean up resources
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        this.inputManager.dispose();
        this.playerController.dispose();
        this.cameraController.dispose();
        this.environmentManager.dispose();
        this.npcManager.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
}

// Start the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
