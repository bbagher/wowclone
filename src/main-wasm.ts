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
import { TargetingSystem } from './controllers/TargetingSystem';
import { CombatTextManager, DamageType } from './controllers/CombatTextManager';
import { GameConfig } from './config';
import { CollisionManager } from './services/CollisionManager';

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
    private targetingSystem: TargetingSystem;
    private combatTextManager: CombatTextManager;
    private shadowGenerator: ShadowGenerator | null = null;
    private physics!: PlayerPhysics;
    private collisionManager: CollisionManager;

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

        // Initialize collision manager first
        this.collisionManager = new CollisionManager(this.scene);

        // Initialize controllers (physics initialized in init())
        this.cameraController = new CameraController(this.scene, this.canvas);
        this.inputManager = new InputManager(this.canvas, this.scene);
        this.combatSystem = new CombatSystem();
        this.targetingSystem = new TargetingSystem();
        this.combatTextManager = new CombatTextManager(this.scene);

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

        // Now we can create player controller with collision manager
        this.playerController = new WasmPlayerController(this.scene, this.physics, this.collisionManager);

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

        this.environmentManager = new EnvironmentManager(this.scene, this.shadowGenerator, this.collisionManager);
        await this.environmentManager.createGround();
        await this.environmentManager.loadNatureAssets();

        // Enable debug visualization for collision bounds
        this.collisionManager.enableDebugVisualization(true);
        console.log('Collision debug visualization enabled');
        console.log('Registered collidables:', this.collisionManager.getCollidableMeshes().length);
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

            // Update ability bar range indicators
            this.updateAbilityBar();
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

        // Setup ability keybinds and tab targeting
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key;

            if (kbInfo.type === GameConfig.KEYBOARD_EVENT_TYPE.KEY_DOWN) {
                if (key === '1') {
                    this.useAbility(1);
                } else if (key === 'Tab') {
                    kbInfo.event.preventDefault();
                    this.tabTarget();
                }
            }
        });

        // Setup ability bar click handlers
        document.querySelectorAll('.ability-slot').forEach((slot) => {
            slot.addEventListener('click', () => {
                const slotNumber = parseInt(slot.getAttribute('data-slot') || '0');
                if (slotNumber > 0) {
                    this.useAbility(slotNumber);
                }
            });
        });
    }

    private useAbility(slotNumber: number) {
        // Slot 1: Melee Attack
        if (slotNumber === 1) {
            this.performMeleeAttack();
        }
    }

    private performMeleeAttack() {
        const playerMesh = this.playerController.getMesh();
        if (!playerMesh) return;

        // Check if we have a valid target
        if (!this.targetingSystem.hasTarget()) {
            console.log('Melee Attack - No target selected! Press Tab to target an enemy.');
            return;
        }

        const target = this.targetingSystem.getCurrentTarget();
        if (!target) return;

        // Check if target is in range
        if (!this.targetingSystem.isTargetInRange(playerMesh.position, this.combatSystem.getAttackRange())) {
            console.log('Melee Attack - Target is out of range!');
            return;
        }

        // Check if target is in front of player
        const playerRotation = playerMesh.rotation.y;
        if (!this.targetingSystem.isTargetInFront(playerMesh.position, playerRotation)) {
            console.log('Melee Attack - Target is not in front of you!');
            return;
        }

        // Play attack animation
        const attacked = this.playerController.performAttack();
        if (!attacked) return;

        // Deal damage to target
        const damageAmount = this.combatSystem.getAttackDamage();
        const isDead = target.takeDamage(damageAmount);
        console.log(`Melee Attack! ${target.mesh.name} - ${isDead ? 'KILLED' : `${target.health}/${target.maxHealth} HP`}`);

        // Show damage number
        this.combatTextManager.showDamage(damageAmount, target.mesh.position, DamageType.Outgoing);

        // Visual feedback
        this.flashAbilitySlot(1);
        this.updateTargetUI();
    }

    private updateAbilityBar() {
        const playerMesh = this.playerController.getMesh();
        if (!playerMesh) return;

        // Update melee ability slot based on target status
        const meleeSlot = document.querySelector('.ability-slot[data-slot="1"]');
        if (meleeSlot) {
            const hasTarget = this.targetingSystem.hasTarget();
            const inRange = this.targetingSystem.isTargetInRange(playerMesh.position, this.combatSystem.getAttackRange());
            const inFront = this.targetingSystem.isTargetInFront(playerMesh.position, playerMesh.rotation.y);

            // Ability is usable if we have a target that's in range and in front of us
            if (hasTarget && inRange && inFront) {
                meleeSlot.classList.remove('out-of-range');
            } else {
                meleeSlot.classList.add('out-of-range');
            }
        }

        // Update target UI to reflect dead targets
        this.updateTargetUI();
    }

    private flashAbilitySlot(slotNumber: number) {
        const slot = document.querySelector(`.ability-slot[data-slot="${slotNumber}"]`);
        if (slot) {
            slot.classList.add('active');
            setTimeout(() => {
                slot.classList.remove('active');
            }, 200);
        }
    }

    private tabTarget() {
        const playerMesh = this.playerController.getMesh();
        if (!playerMesh) return;

        const npcs = this.npcManager.getAllNPCs();
        const target = this.targetingSystem.cycleTarget(npcs, playerMesh.position);

        if (target) {
            console.log(`Targeted: ${target.mesh.name}`);
        }

        this.updateTargetUI();
    }

    private updateTargetUI() {
        const targetFrame = document.getElementById('target-frame');
        const targetName = document.getElementById('target-name');
        const targetHealthText = document.getElementById('target-health-text');
        const targetHealthFill = document.getElementById('target-health-fill');

        if (!targetFrame || !targetName || !targetHealthText || !targetHealthFill) return;

        const currentTarget = this.targetingSystem.getCurrentTarget();

        if (currentTarget && currentTarget.health > 0) {
            targetFrame.style.display = 'block';
            targetName.textContent = currentTarget.mesh.name;
            targetHealthText.textContent = `${Math.max(0, currentTarget.health).toFixed(0)}/${currentTarget.maxHealth}`;

            const healthPercent = (currentTarget.health / currentTarget.maxHealth) * 100;
            targetHealthFill.style.width = `${Math.max(0, healthPercent)}%`;

            // Change color based on health
            if (healthPercent > 50) {
                targetHealthFill.style.background = 'linear-gradient(to bottom, #ff6666, #cc0000)';
            } else if (healthPercent > 25) {
                targetHealthFill.style.background = 'linear-gradient(to bottom, #ffaa00, #ff8800)';
            } else {
                targetHealthFill.style.background = 'linear-gradient(to bottom, #ff0000, #aa0000)';
            }
        } else {
            targetFrame.style.display = 'none';
            this.targetingSystem.clearTarget();
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

            // Show damage number on player
            if (playerMesh) {
                this.combatTextManager.showDamage(attack.damage, playerMesh.position, DamageType.Incoming);
            }
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
        this.combatTextManager.dispose();
        this.collisionManager.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
}

// Start the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
