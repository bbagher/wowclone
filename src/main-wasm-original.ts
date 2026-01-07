import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Ray } from '@babylonjs/core/Culling/ray';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

// Import loaders
import '@babylonjs/loaders/glTF';

// Import required for side effects
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// NPC system
import { NPC } from './NPC';

// WASM physics engine
import init, { PlayerPhysics } from './wasm/game_physics.js';

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private camera: ArcRotateCamera;
    private player: Mesh | null = null;
    private inputMap: { [key: string]: boolean } = {};
    private animations: AnimationGroup[] = [];
    private currentAnimation: AnimationGroup | null = null;
    private skeletonRoot: any = null;
    private baseOffset = 0;
    private physics!: PlayerPhysics; // WASM physics engine
    private lastFrameTime = 0;
    private frameCount = 0;
    private lastFpsUpdateTime = 0;
    private currentFps = 0;
    private npcs: NPC[] = [];
    private playerHealth: number = 100;
    private playerMaxHealth: number = 100;
    private isAttacking: boolean = false;

    constructor() {
        this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        // Enable animations in the scene
        this.scene.animationsEnabled = true;

        this.camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2,
            Math.PI / 3,
            10,
            Vector3.Zero(),
            this.scene
        );

        this.init();
    }

    private async init() {
        console.log('Initializing game...');

        // Initialize WASM module
        console.log('Loading WASM physics engine...');
        await init();
        this.physics = new PlayerPhysics();
        console.log('WASM physics engine loaded!');

        this.setupCamera();
        console.log('Camera setup complete');

        this.setupLights();
        console.log('Lights setup complete');

        await this.createEnvironment();
        console.log('Environment created');

        await this.createPlayer();
        console.log('Player created');

        this.spawnNPCs();
        console.log('NPCs spawned');

        this.setupInput();
        console.log('Input setup complete');

        this.setupUI();
        console.log('UI setup complete');

        console.log('Starting render loop...');
        this.lastFrameTime = performance.now();

        // Start render loop
        this.engine.runRenderLoop(() => {
            this.update();
            this.scene.render();
        });

        console.log('Game initialization complete!');

        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    private setupCamera() {
        this.camera.attachControl(this.canvas, true);
        this.camera.radius = 15;
        this.camera.beta = Math.PI / 3.5;
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 30;
        this.camera.lowerBetaLimit = 0.1;
        this.camera.upperBetaLimit = Math.PI / 2.2;
        this.camera.wheelPrecision = 50;

        // Make camera more responsive
        this.camera.angularSensibilityX = 500;
        this.camera.angularSensibilityY = 500;
        this.camera.inertia = 0.5;
        this.camera.panningSensibility = 0;
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
        const shadowGenerator = new ShadowGenerator(1024, sunLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurScale = 2;

        // Store for later use
        (this.scene as any).shadowGenerator = shadowGenerator;

        // Sky color
        this.scene.clearColor = new Color4(0.5, 0.7, 0.9, 1.0);
    }

    private async createEnvironment() {
        // Create ground
        const ground = MeshBuilder.CreateGround(
            'ground',
            { width: 100, height: 100 },
            this.scene
        );

        const groundMaterial = new StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.3);
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;
        ground.receiveShadows = true;

        // Add some terrain variation with simple hills
        const positions = ground.getVerticesData('position');
        if (positions) {
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i + 2];
                positions[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
            }
            ground.setVerticesData('position', positions);
            ground.createNormals(false);
        }

        await this.loadNatureAssets();
    }

    private async loadNatureAssets() {
        console.log('Loading nature assets...');

        const natureAssets = [
            // Trees
            { name: 'CommonTree_1.gltf', count: 15, scale: 1.5 },
            { name: 'CommonTree_2.gltf', count: 12, scale: 1.5 },
            { name: 'CommonTree_3.gltf', count: 10, scale: 1.5 },
            { name: 'DeadTree_1.gltf', count: 5, scale: 1.5 },

            // Bushes and vegetation
            { name: 'Bush_Common.gltf', count: 20, scale: 1.0 },
            { name: 'Bush_Common_Flowers.gltf', count: 15, scale: 1.0 },
            { name: 'Fern_1.gltf', count: 25, scale: 0.8 },

            // Rocks
            { name: 'Rock_Medium_1.gltf', count: 15, scale: 1.2 },
            { name: 'Rock_Medium_2.gltf', count: 12, scale: 1.2 },
            { name: 'Rock_Small_1.gltf', count: 20, scale: 0.8 },

            // Grass patches
            { name: 'Grass_Common_Tall.gltf', count: 30, scale: 1.0 },
            { name: 'Grass_Wispy_Tall.gltf', count: 25, scale: 1.0 },
        ];

        for (const asset of natureAssets) {
            try {
                const result = await SceneLoader.ImportMeshAsync(
                    '',
                    '/assets/nature/glTF/',
                    asset.name,
                    this.scene
                );

                if (result.meshes.length > 0) {
                    const templateMesh = result.meshes[0];
                    templateMesh.setEnabled(false); // Hide the template

                    // Create instances at random positions
                    for (let i = 0; i < asset.count; i++) {
                        // Random position within the terrain bounds
                        const x = (Math.random() - 0.5) * 80; // Spread across 80x80 area
                        const z = (Math.random() - 0.5) * 80;

                        // Create instance
                        const instance = templateMesh.clone(`${asset.name}_${i}`, null);
                        if (instance) {
                            // Apply scaling first
                            const scaleVariation = 0.8 + Math.random() * 0.4; // 80% to 120%
                            const finalScale = asset.scale * scaleVariation;
                            instance.scaling = new Vector3(finalScale, finalScale, finalScale);

                            // Use raycast to find exact ground height
                            const origin = new Vector3(x, 100, z);
                            const direction = new Vector3(0, -1, 0);
                            const ray = new Ray(origin, direction, 200);
                            const hit = this.scene.pickWithRay(ray, (mesh) => mesh.name === 'ground');

                            if (hit && hit.pickedPoint) {
                                // Get model's lowest point
                                const modelBounds = instance.getHierarchyBoundingVectors();
                                const lowestPoint = modelBounds.min.y;

                                // Position so lowest point touches ground
                                instance.position = new Vector3(
                                    x,
                                    hit.pickedPoint.y - lowestPoint,
                                    z
                                );
                            } else {
                                // Fallback to approximate height
                                instance.position = new Vector3(x, 0, z);
                            }

                            // Random rotation for variety
                            instance.rotation.y = Math.random() * Math.PI * 2;

                            instance.setEnabled(true);

                            // Add shadow casting for larger objects
                            if (asset.name.includes('Tree') || asset.name.includes('Rock')) {
                                const shadowGenerator = (this.scene as any).shadowGenerator as ShadowGenerator;
                                shadowGenerator.addShadowCaster(instance);
                            }
                        }
                    }

                    console.log(`Loaded ${asset.count} instances of ${asset.name}`);
                }
            } catch (error) {
                console.warn(`Failed to load ${asset.name}:`, error);
                // Continue loading other assets even if one fails
            }
        }

        console.log('Nature assets loading complete!');
    }

    private async createPlayer() {
        console.log('Loading skeleton model...');

        try {
            const result = await SceneLoader.ImportMeshAsync(
                '',
                '/models/',
                'Skeleton.glb',
                this.scene
            );

            console.log('Skeleton loaded!', result.meshes.length, 'meshes');
            console.log('Animations found:', result.animationGroups.length);

            if (result.meshes.length > 0) {
                const root = result.meshes[0];

                this.player = MeshBuilder.CreateBox('playerController', { size: 0.1 }, this.scene);
                this.player.isVisible = false;
                this.player.position = new Vector3(0, 0, 0);

                root.parent = this.player;

                const boundingInfo = root.getHierarchyBoundingVectors();
                this.baseOffset = -boundingInfo.min.y;
                root.position = new Vector3(0, this.baseOffset - 1.0, 0);

                this.skeletonRoot = root;

                const shadowGenerator = (this.scene as any).shadowGenerator as ShadowGenerator;
                result.meshes.forEach(mesh => {
                    if (mesh !== root) {
                        shadowGenerator.addShadowCaster(mesh);
                    }
                });

                this.animations = result.animationGroups;
                this.animations.forEach(anim => anim.stop());

                this.createAnimationButtons();

                if (this.animations.length > 0) {
                    const idleAnim = this.animations.find(a =>
                        a.name.toLowerCase().includes('idle')
                    ) || this.animations[0];
                    this.playAnimation(idleAnim);
                }

                this.camera.lockedTarget = this.player;
                console.log('Player setup complete');
            }
        } catch (error) {
            console.error('Failed to load skeleton model:', error);

            const body = MeshBuilder.CreateCapsule(
                'playerBody',
                { height: 2, radius: 0.5 },
                this.scene
            );
            body.position.y = 1;

            const playerMaterial = new StandardMaterial('playerMat', this.scene);
            playerMaterial.diffuseColor = new Color3(0.2, 0.5, 0.8);
            body.material = playerMaterial;

            this.player = body;

            const shadowGenerator = (this.scene as any).shadowGenerator as ShadowGenerator;
            shadowGenerator.addShadowCaster(body);

            this.camera.lockedTarget = this.player;
        }
    }

    private setupInput() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();

            switch (kbInfo.type) {
                case 1: // KeyDown
                    this.inputMap[key] = true;

                    // Attack when F key is pressed
                    if (key === 'f') {
                        this.performAttack();
                    }
                    break;
                case 2: // KeyUp
                    this.inputMap[key] = false;
                    break;
            }
        });

        // Left click to request pointer lock
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });
    }

    private performAttack() {
        if (!this.player || this.isAttacking) return;

        // Find attack animation
        const attackAnim = this.animations.find(a =>
            a.name.toLowerCase().includes('attack')
        );

        if (!attackAnim) {
            console.warn('No attack animation found');
            return;
        }

        // Set attacking state
        this.isAttacking = true;

        // Play attack animation (once, not looping)
        this.animations.forEach(anim => anim.stop());
        attackAnim.start(false, 1.0, attackAnim.from, attackAnim.to, false);

        // Attack nearest NPC within range
        const attackRange = 3;
        let nearestNPC: NPC | null = null;
        let nearestDistance = attackRange;

        for (const npc of this.npcs) {
            const distance = Vector3.Distance(this.player.position, npc.mesh.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestNPC = npc;
            }
        }

        if (nearestNPC) {
            const isDead = nearestNPC.takeDamage(25);
            if (isDead) {
                console.log(`Killed ${nearestNPC.mesh.name}!`);
            } else {
                console.log(`Hit ${nearestNPC.mesh.name}! Health: ${nearestNPC.health}/${nearestNPC.maxHealth}`);
            }
        }

        // Reset attacking state when animation completes
        attackAnim.onAnimationGroupEndObservable.addOnce(() => {
            this.isAttacking = false;
            // Return to idle or walking animation based on movement
            const isMoving = this.physics && this.physics.is_moving();
            if (isMoving) {
                const walkAnim = this.animations.find(a =>
                    a.name.toLowerCase().includes('walk') ||
                    a.name.toLowerCase().includes('run')
                ) || this.animations[0];
                this.playAnimation(walkAnim);
            } else {
                const idleAnim = this.animations.find(a =>
                    a.name.toLowerCase().includes('idle')
                ) || this.animations[0];
                this.playAnimation(idleAnim);
            }
        });
    }

    private createAnimationButtons() {
        const container = document.getElementById('animation-buttons');
        if (!container) return;

        container.innerHTML = '';

        this.animations.forEach((anim, index) => {
            const button = document.createElement('button');
            button.className = 'anim-button';

            const cleanName = anim.name.split('|')[1] || anim.name;
            button.textContent = cleanName;
            button.id = `anim-btn-${index}`;

            button.addEventListener('click', () => {
                this.playAnimation(anim);
                this.updateActiveButton(index);
            });

            container.appendChild(button);
        });
    }

    private updateActiveButton(activeIndex: number) {
        this.animations.forEach((_, index) => {
            const btn = document.getElementById(`anim-btn-${index}`);
            if (btn) {
                if (index === activeIndex) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    private playAnimation(animation: AnimationGroup) {
        if (this.currentAnimation === animation && animation.isPlaying) {
            return;
        }

        this.animations.forEach(anim => anim.stop());
        animation.start(true, 1.0, animation.from, animation.to, false);
        this.currentAnimation = animation;

        const index = this.animations.indexOf(animation);
        if (index !== -1) {
            this.updateActiveButton(index);
        }
    }

    private spawnNPCs() {
        // Spawn NPCs at random positions around the map
        const npcCount = 1;
        const spawnRadius = 40; // Spawn within a 40-unit radius

        // Available monster models
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
            const terrainY = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;

            const spawnPos = new Vector3(x, terrainY + 1, z);

            // Randomly select a monster model
            const modelName = monsterModels[i % monsterModels.length];

            const npc = new NPC(this.scene, spawnPos, `Enemy_${i}`, modelName);
            this.npcs.push(npc);
        }

        console.log(`Spawned ${npcCount} NPCs with models: ${monsterModels.join(', ')}`);
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
            if (currentTime - this.lastFpsUpdateTime >= 100) {
                const elapsed = currentTime - this.lastFpsUpdateTime;
                this.currentFps = (this.frameCount / elapsed) * 1000;
                this.frameCount = 0;
                this.lastFpsUpdateTime = currentTime;

                if (fpsElement) {
                    fpsElement.textContent = this.currentFps.toFixed(1);
                }
            }

            if (posElement && this.player) {
                const pos = this.player.position;
                posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
            }

            // Update health display
            if (healthText) {
                healthText.textContent = `${Math.max(0, this.playerHealth).toFixed(0)}/${this.playerMaxHealth}`;
            }
            if (healthFill) {
                const healthPercent = (this.playerHealth / this.playerMaxHealth) * 100;
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
                npcCount.textContent = `${this.npcs.length}`;
            }
        });

        const slider = document.getElementById('vertical-offset') as HTMLInputElement;
        const offsetValue = document.getElementById('offset-value');

        if (slider && offsetValue) {
            slider.addEventListener('input', () => {
                const adjustment = parseFloat(slider.value);
                offsetValue.textContent = adjustment.toFixed(1);

                if (this.skeletonRoot) {
                    this.skeletonRoot.position.y = this.baseOffset - 1.0 + adjustment;
                }
            });
        }
    }

    private update() {
        if (!this.player || !this.physics) return;

        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 16.67; // Normalize to 60fps
        this.lastFrameTime = currentTime;

        // Get camera direction for movement
        const forward = this.camera.getForwardRay().direction;
        forward.y = 0;
        forward.normalize();

        const right = Vector3.Cross(forward, Vector3.Up());

        // Read input
        let moveX = 0;
        let moveZ = 0;

        if (this.inputMap['w']) moveZ = 1;
        if (this.inputMap['s']) moveZ = -1;
        if (this.inputMap['a']) moveX = -1;
        if (this.inputMap['d']) moveX = 1;

        const isSprinting = this.inputMap['shift'] || false;
        const shouldJump = this.inputMap[' '] || false;

        // Update physics in WASM (all calculations happen in Rust)
        this.physics.update(
            moveX,
            moveZ,
            forward.x,
            forward.z,
            right.x,
            right.z,
            isSprinting,
            shouldJump,
            deltaTime
        );

        // Read physics results and apply to player
        this.player.position.x = this.physics.get_position_x();
        this.player.position.y = this.physics.get_position_y();
        this.player.position.z = this.physics.get_position_z();

        const isMoving = this.physics.is_moving();

        if (isMoving) {
            // Adjust rotation so the model faces the movement direction
            this.player.rotation.y = this.physics.get_movement_angle() + Math.PI;
        }

        // Update animations based on movement (only if not attacking)
        if (!this.isAttacking && this.animations.length > 0 && this.animations[0].targetedAnimations.length > 0) {
            if (isMoving) {
                const walkAnim = this.animations.find(a =>
                    a.name.toLowerCase().includes('walk') ||
                    a.name.toLowerCase().includes('run')
                ) || this.animations[0];
                this.playAnimation(walkAnim);

                if (walkAnim) {
                    walkAnim.speedRatio = isSprinting ? 1.5 : 1.0;
                }
            } else {
                const idleAnim = this.animations.find(a =>
                    a.name.toLowerCase().includes('idle')
                ) || this.animations[0];
                this.playAnimation(idleAnim);
            }
        }

        // Update NPCs
        this.updateNPCs(deltaTime);
    }

    private updateNPCs(deltaTime: number) {
        if (!this.player) return;

        const playerPos = this.player.position;

        // Update each NPC and check for attacks
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];

            if (npc.health <= 0) {
                // Remove dead NPCs
                this.npcs.splice(i, 1);
                continue;
            }

            const result = npc.update(playerPos, deltaTime);

            if (result.attacked) {
                this.playerHealth -= result.damage;
                console.log(`Player hit! Health: ${this.playerHealth}/${this.playerMaxHealth}`);

                if (this.playerHealth <= 0) {
                    console.log('Player died!');
                    this.playerHealth = 0;
                    // You can add death handling here (respawn, game over screen, etc.)
                }
            }
        }
    }
}

// Start the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
