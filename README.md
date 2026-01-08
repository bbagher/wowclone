# 3D Game - WoW-Style Third-Person MMO

A 3D game built with **Babylon.js**, **TypeScript**, and **Rust/WASM** for high-performance physics. Features a WoW-style third-person camera, combat system, NPC AI, and a modular architecture designed for scalability.

## Architecture Overview

This codebase follows a **modular controller pattern** where each system is isolated into its own class with a single responsibility. The main game class acts as a coordinator, not an implementer.

### Core Philosophy
- **Separation of Concerns**: Each controller manages one aspect of the game
- **Type Safety**: Full TypeScript with no `any` types
- **Configuration-Driven**: All constants in `config.ts`, no magic numbers
- **Resource Management**: All controllers implement `dispose()` for proper cleanup
- **WASM Integration**: Physics engine written in Rust for performance

## Project Structure

```
3dgame/
├── src/
│   ├── main-wasm.ts                    # Main game coordinator (entry point)
│   ├── config.ts                       # Game configuration constants
│   ├── types.ts                        # TypeScript interfaces
│   ├── NPC.ts                          # NPC class (enemy AI)
│   │
│   ├── controllers/                    # Modular game systems
│   │   ├── WasmPlayerController.ts     # Player movement & WASM physics integration
│   │   ├── CameraController.ts         # WoW-style third-person camera
│   │   ├── InputManager.ts             # Keyboard/mouse input handling
│   │   ├── AnimationController.ts      # Animation state machine
│   │   ├── EnvironmentManager.ts       # Terrain & nature assets
│   │   ├── NPCManager.ts               # NPC spawning & management
│   │   └── CombatSystem.ts             # Health & damage system
│   │
│   └── wasm/                           # Generated WASM bindings
│       ├── game_physics.js
│       ├── game_physics.d.ts
│       └── game_physics_bg.wasm.d.ts
│
├── game-physics/                       # Rust WASM physics engine
│   ├── src/
│   │   └── lib.rs                      # Physics implementation
│   └── Cargo.toml                      # Rust dependencies
│
├── public/
│   ├── models/                         # 3D models (GLB/GLTF)
│   └── assets/                         # Textures, nature assets
│
├── test/                               # Jest unit tests
│   ├── camera-character-alignment.test.ts
│   ├── camera-realignment.test.ts
│   ├── model-orientation.test.ts
│   └── player-integration.test.ts
│
├── index.html                          # Entry point (loads main-wasm.ts)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## System Architecture

### 1. Main Game Loop ([src/main-wasm.ts](src/main-wasm.ts))

The `Game` class is the **coordinator** that:
- Initializes all controllers in the correct order
- Runs the render loop
- Delegates work to specialized controllers
- Handles resource cleanup

**Key Responsibilities:**
- Scene setup (engine, lights, background)
- Controller initialization
- Update loop coordination
- UI setup (HUD, health bar, FPS counter)

**Does NOT handle:**
- Player movement logic (delegated to WasmPlayerController)
- Input processing (delegated to InputManager)
- Camera management (delegated to CameraController)
- Physics (delegated to WASM or PhysicsSystem)

### 2. Configuration ([src/config.ts](src/config.ts))

Centralized configuration for all game constants:
- Movement speeds (walk, sprint)
- Physics values (gravity, jump force, ground level)
- Camera settings (radius, angles, sensitivity)
- Combat values (attack range, damage, NPC health)
- Shadow settings (map size, blur)
- UI update intervals

**Why this matters:** No magic numbers in code. Easy to tweak gameplay without hunting through files.

### 3. Controllers

#### WasmPlayerController ([src/controllers/WasmPlayerController.ts](src/controllers/WasmPlayerController.ts))

**Purpose:** Manages the player character with WASM-powered physics.

**Responsibilities:**
- Load player model (Skeleton.glb)
- Integrate with Rust WASM physics engine
- Update player position/rotation based on physics
- Manage animations (idle, walk, run, attack)
- Handle attack actions
- Apply visual transforms (skeleton vertical offset)

**Key Methods:**
- `loadPlayer()`: Loads 3D model, sets up skeleton, applies shadows
- `update()`: Reads input, calls WASM physics, updates animations
- `performAttack()`: Triggers attack animation
- `getMesh()`: Returns player mesh for camera targeting

**WASM Integration:**
```typescript
// Update physics in Rust, get results back
this.physics.update(moveX, moveZ, forwardX, forwardZ, rightX, rightZ, sprinting, jump, deltaTime);
this.mesh.position.x = this.physics.get_position_x();
this.mesh.position.y = this.physics.get_position_y();
this.mesh.position.z = this.physics.get_position_z();
```

#### CameraController ([src/controllers/CameraController.ts](src/controllers/CameraController.ts))

**Purpose:** WoW-style third-person camera that follows the player.

**Responsibilities:**
- Configure arc rotate camera (distance, angles, sensitivity)
- Lock camera to player target
- Provide direction helpers for movement
- Auto-realign behind player when not moving/dragging

**Key Methods:**
- `setTarget()`: Lock camera to player mesh
- `getForwardDirection()`: Returns camera forward vector (for movement)
- `getRightDirection()`: Returns camera right vector (for strafing)
- `update()`: Auto-realign when idle (configurable)

**Camera Behavior:**
- Player model faces **away** from camera (WoW-style)
- WASD moves relative to camera direction
- Mouse drag rotates camera around player
- Auto-realignment when not moving (optional)

**Camera-to-Character Lock Formula:**

For the camera to remain locked behind the character's back at all times, the relationship between the character's rotation and camera alpha is:

```typescript
camera.alpha = -character.rotation.y - Math.PI / 2
// Or equivalently:
camera.alpha = -character.rotation.y + (3 * Math.PI / 2)
```

This ensures the camera stays positioned behind the character regardless of which direction the character is facing:

| Character Rotation | Camera Alpha | Camera Position |
|-------------------|--------------|-----------------|
| 0° (0 rad)        | 270° (3π/2)  | Behind character |
| 90° (π/2)         | 180° (π)     | Behind character |
| 180° (π)          | 90° (π/2)    | Behind character |
| 270° (-π/2)       | 0° (0)       | Behind character |

The negative sign inverts the rotation direction, and the -π/2 offset accounts for Babylon.js's coordinate system where the camera's initial alpha position needs to be adjusted.

#### InputManager ([src/controllers/InputManager.ts](src/controllers/InputManager.ts))

**Purpose:** Centralized input handling with proper cleanup.

**Responsibilities:**
- Listen for keyboard events (WASD, Shift, Space)
- Track key states in a map
- Provide structured input to player controller
- Clean up event listeners on dispose

**Key Methods:**
- `setup()`: Register keyboard observers
- `getMovementInput()`: Returns structured input object
- `dispose()`: Remove observers (prevents memory leaks)

**Returns:**
```typescript
{
  forward: boolean,   // W key
  backward: boolean,  // S key
  left: boolean,      // A key
  right: boolean,     // D key
  sprint: boolean,    // Shift key
  jump: boolean       // Space key
}
```

#### AnimationController ([src/controllers/AnimationController.ts](src/controllers/AnimationController.ts))

**Purpose:** Manages animation playback and transitions.

**Responsibilities:**
- Play/stop animations
- Create animation UI buttons
- Control animation speed (e.g., faster run when sprinting)
- Find animations by name (idle, walk, attack)

**Key Methods:**
- `play()`: Plays an animation (stops others)
- `findAnimation()`: Finds animation by name pattern
- `setButtonContainer()`: Creates UI buttons for all animations
- `setSpeedRatio()`: Adjusts animation speed

**Animation State Machine:**
- Idle: When not moving
- Walk/Run: When moving (speed increases with sprint)
- Attack: Plays once, returns to idle/walk

#### EnvironmentManager ([src/controllers/EnvironmentManager.ts](src/controllers/EnvironmentManager.ts))

**Purpose:** Creates and manages the game world.

**Responsibilities:**
- Create terrain (ground mesh with height variation)
- Load nature assets (trees, rocks, bushes, grass)
- Place assets randomly with proper ground alignment
- Apply shadows to large objects

**Key Methods:**
- `createGround()`: Generates terrain mesh
- `loadNatureAssets()`: Loads and instances environment objects

**Asset Placement:**
- Uses raycasting to find exact ground height
- Random positions within bounds
- Random rotations for variety
- Scale variations (80%-120%)

#### NPCManager ([src/controllers/NPCManager.ts](src/controllers/NPCManager.ts))

**Purpose:** Spawns and manages enemy NPCs.

**Responsibilities:**
- Spawn NPCs at random positions
- Update all NPCs each frame
- Find nearest NPC for combat
- Remove dead NPCs
- Track NPC count

**Key Methods:**
- `spawnNPCs()`: Creates enemies with random models
- `update()`: Updates all NPCs, returns attack results
- `findNearestNPC()`: Finds closest enemy within range
- `getNPCCount()`: Returns alive NPC count

**NPC Behavior:**
- Each NPC has its own AI (see NPC.ts)
- Chase player when in range
- Attack when close enough
- Die when health reaches zero

#### CombatSystem ([src/controllers/CombatSystem.ts](src/controllers/CombatSystem.ts))

**Purpose:** Manages player health and damage.

**Responsibilities:**
- Track player health
- Apply damage to player
- Calculate health percentage (for UI)
- Provide combat constants (attack range, damage)

**Key Methods:**
- `takeDamage()`: Reduces health, returns if dead
- `getHealth()`: Returns current health
- `getHealthPercent()`: Returns health as percentage
- `getAttackDamage()`: Returns player attack damage
- `getAttackRange()`: Returns attack reach

### 4. WASM Physics Engine ([game-physics/src/lib.rs](game-physics/src/lib.rs))

Written in **Rust** for maximum performance, compiled to WebAssembly.

**PlayerPhysics Struct:**
```rust
pub struct PlayerPhysics {
    position: Vector3,
    velocity: Vector3,
    is_grounded: bool,
    move_speed: f32,
    sprint_multiplier: f32,
    jump_force: f32,
    gravity: f32,
}
```

**Key Methods:**
- `new()`: Initialize player physics state
- `update()`: Main physics loop (movement, gravity, collision)
- `get_position_x/y/z()`: Get current position
- `get_movement_angle()`: Get rotation for character facing
- `is_moving()`: Check if player is moving

**Why Rust/WASM?**
- **Performance**: Physics calculations run at native speed
- **Consistency**: Same behavior across all browsers
- **Scalability**: Can handle complex physics without JS overhead

**Build Command:**
```bash
npm run build:wasm  # Compiles Rust to WASM
```

### 5. NPC AI ([src/NPC.ts](src/NPC.ts))

Each NPC is an autonomous entity with its own AI.

**Responsibilities:**
- Load monster model (Slime, Bat, Skeleton)
- Chase player when in detection range
- Attack player when in melee range
- Play animations (idle, walk, attack, death)
- Track health
- Handle death (play animation, disable)

**AI States:**
- **Idle**: Default state, out of range
- **Chasing**: Moving toward player
- **Attacking**: In range, playing attack animation

**Key Methods:**
- `update()`: AI loop, returns attack result
- `takeDamage()`: Reduces health, returns if dead
- `die()`: Plays death animation, marks as dead

## Data Flow

### Player Movement
1. User presses WASD → **InputManager** captures keys
2. **InputManager** returns structured input to **Game**
3. **Game** passes input to **WasmPlayerController**
4. **WasmPlayerController** gets camera directions from **CameraController**
5. **WasmPlayerController** calls Rust WASM physics
6. WASM returns new position/rotation
7. **WasmPlayerController** updates mesh transform
8. **AnimationController** updates animation state
9. **CameraController** follows player (auto-realign if idle)

### Combat Flow
1. User presses F → **Game** receives keyboard event
2. **Game** calls `playerController.performAttack()`
3. **WasmPlayerController** plays attack animation
4. **Game** calls `npcManager.findNearestNPC()`
5. **NPCManager** returns closest enemy in range
6. **NPC** takes damage via `takeDamage()`
7. If dead, **NPCManager** removes NPC
8. UI updates NPC count

### NPC Attack Flow
1. **Game** calls `npcManager.update()`
2. Each **NPC** checks distance to player
3. If in range, **NPC** attacks
4. **NPCManager** returns attack results
5. **Game** passes damage to **CombatSystem**
6. **CombatSystem** reduces player health
7. UI updates health bar

## Configuration System

All game constants are in [src/config.ts](src/config.ts):

```typescript
export const GameConfig = {
  MOVE_SPEED: 0.1,
  SPRINT_MULTIPLIER: 2.0,
  GRAVITY: -0.02,
  JUMP_FORCE: 0.3,
  // ... 20+ more constants
} as const;
```

**Benefits:**
- No magic numbers scattered in code
- Easy to tweak gameplay
- Type-safe (TypeScript const assertion)
- Single source of truth

## Type System

All interfaces are in [src/types.ts](src/types.ts):

```typescript
export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
}

export interface PlayerState {
  mesh: AbstractMesh;
  skeletonRoot: AbstractMesh | null;
  isGrounded: boolean;
  verticalVelocity: number;
}

export interface AnimationState {
  groups: AnimationGroup[];
  current: AnimationGroup | null;
}
```

**Benefits:**
- Compile-time type checking
- Auto-complete in IDE
- Self-documenting code
- Catches bugs early

## Testing

Tests are in [test/](test/) using **Jest**.

**Test Files:**
- `camera-character-alignment.test.ts`: Tests camera-character facing
- `camera-realignment.test.ts`: Tests auto-realign feature
- `model-orientation.test.ts`: Tests model rotation
- `player-integration.test.ts`: Tests full player system

**Run Tests:**
```bash
npm test           # Run once
npm run test:watch # Watch mode
```

## Development

### Quick Start
```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
```

### Build for Production
```bash
npm run build      # Builds WASM + TypeScript + bundles
```

### WASM Development
```bash
cd game-physics
wasm-pack build --target web --out-dir ../src/wasm
```

## Controls

- **WASD**: Move character
- **Mouse Drag**: Rotate camera
- **Shift**: Sprint (2x speed)
- **Space**: Jump
- **F**: Attack nearest NPC
- **Click Canvas**: Lock pointer

## UI Elements

- **FPS Counter**: Real-time performance (top-left)
- **Position**: Player X, Y, Z coordinates
- **Health Bar**: Visual health indicator with color
- **NPC Count**: Number of alive enemies
- **Animation Buttons**: Manual animation control (right panel)
- **Vertical Offset Slider**: Adjust skeleton height

## Performance Considerations

### WASM Physics
- Runs at native speed (Rust compiled to WASM)
- No JavaScript overhead for physics calculations
- Handles 60+ FPS easily

### Asset Instancing
- Nature assets are instanced (not cloned)
- Single mesh with multiple transforms
- Reduces draw calls significantly

### Shadow Optimization
- Only large objects cast shadows (trees, rocks)
- Blur exponential shadow maps (better quality, same cost)
- Configurable shadow map size

### Animation System
- Animations only update when state changes
- Speed ratios adjust playback (no re-calculation)
- Single animation plays at a time (no blending overhead)

## Adding New Features

### Add a New Controller
1. Create `src/controllers/NewController.ts`
2. Export a class with `dispose()` method
3. Import in `main-wasm.ts`
4. Initialize in `Game` constructor
5. Call in `update()` loop if needed

### Add a New Animation
1. Export animation from Blender (embedded in GLB)
2. Load with model (automatic)
3. Find by name: `animController.findAnimation('myAnim')`
4. Play: `animController.play(anim)`

### Add a New Enemy Type
1. Export model as GLB
2. Place in `public/models/`
3. Add to `NPCManager.spawnNPCs()` model list
4. Adjust stats in NPC constructor

### Modify Physics
1. Edit `game-physics/src/lib.rs`
2. Run `npm run build:wasm`
3. Reload game (WASM auto-loads)

## Common Patterns

### Controller Pattern
```typescript
export class MyController {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public update(deltaTime: number): void {
    // Update logic
  }

  public dispose(): void {
    // Cleanup
  }
}
```

### WASM Integration
```typescript
import init, { MyWasmClass } from './wasm/my_wasm.js';

// Initialize WASM module
await init();
const wasmInstance = new MyWasmClass();

// Call WASM methods
wasmInstance.update(param1, param2);
const result = wasmInstance.get_result();
```

### Animation State Machine
```typescript
if (isMoving) {
  const anim = this.animController.findAnimation('walk');
  this.animController.play(anim);
} else {
  const anim = this.animController.findAnimation('idle');
  this.animController.play(anim);
}
```

## Debugging Tips

### Enable Babylon Inspector
```typescript
import '@babylonjs/inspector';
scene.debugLayer.show();
```

### Log WASM State
```rust
use web_sys::console;
console::log_1(&format!("Position: {:?}", self.position).into());
```

### Check Input State
```typescript
const input = this.inputManager.getMovementInput();
console.log('Input:', input);
```

## Known Limitations

1. **Simple Ground Collision**: Currently a flat Y-plane. No terrain raycasting yet.
2. **No Animation Blending**: Animations switch instantly (no crossfade).
3. **Basic NPC AI**: Simple chase/attack. No pathfinding or obstacles.
4. **No Networking**: Single-player only (multiplayer requires server).

## Future Enhancements

- Terrain raycasting (walk on hills/slopes)
- Animation blending (smooth transitions)
- NPC pathfinding (A* or navmesh)
- Multiplayer support (WebSocket server)
- Inventory system
- Quest system
- Sound effects and music
- Particle effects (hits, death, abilities)
- Minimap
- Save/load system

## Tech Stack

- **Babylon.js 8**: WebGL 3D engine
- **TypeScript 5**: Type-safe JavaScript
- **Rust 1.70+**: WASM physics engine
- **Vite 6**: Build tool and dev server
- **Jest 30**: Testing framework

## License

This is a proof-of-concept project. Assets are from Quaternius (CC0 license).

## Credits

- **3D Models**: [Quaternius](https://quaternius.com/) (Ultimate Animated Monster Pack, Nature MegaKit)
- **Engine**: [Babylon.js](https://www.babylonjs.com/)
- **WASM**: [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen)
