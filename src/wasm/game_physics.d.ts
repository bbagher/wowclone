/* tslint:disable */
/* eslint-disable */

export class PlayerPhysics {
  free(): void;
  [Symbol.dispose](): void;
  get_rotation(): number;
  /**
   * Set the grounded state and reset vertical velocity
   * This is called from TypeScript when collision detection determines
   * the player has landed on a surface (ground, rock, platform, etc.)
   */
  set_grounded(grounded: boolean): void;
  set_position(x: number, y: number, z: number): void;
  get_position_x(): number;
  get_position_y(): number;
  get_position_z(): number;
  /**
   * Get movement direction for character rotation
   */
  get_movement_angle(): number;
  constructor();
  /**
   * Update physics simulation
   * Parameters:
   * - move_x: horizontal movement input (-1 to 1)
   * - move_z: forward movement input (-1 to 1)
   * - forward_x, forward_z: camera forward direction (normalized)
   * - right_x, right_z: camera right direction (normalized)
   * - is_sprinting: whether sprint is active
   * - should_jump: whether jump button is pressed
   * - delta_time: time step for frame-rate independent physics
   */
  update(move_x: number, move_z: number, forward_x: number, forward_z: number, right_x: number, right_z: number, is_sprinting: boolean, should_jump: boolean, delta_time: number): void;
  is_moving(): boolean;
}

export class Vector3 {
  free(): void;
  [Symbol.dispose](): void;
  add(other: Vector3): Vector3;
  constructor(x: number, y: number, z: number);
  scale(scalar: number): Vector3;
  length(): number;
  normalize(): void;
  x: number;
  y: number;
  z: number;
}

export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_get_vector3_x: (a: number) => number;
  readonly __wbg_get_vector3_y: (a: number) => number;
  readonly __wbg_get_vector3_z: (a: number) => number;
  readonly __wbg_playerphysics_free: (a: number, b: number) => void;
  readonly __wbg_set_vector3_x: (a: number, b: number) => void;
  readonly __wbg_set_vector3_y: (a: number, b: number) => void;
  readonly __wbg_set_vector3_z: (a: number, b: number) => void;
  readonly __wbg_vector3_free: (a: number, b: number) => void;
  readonly init: () => void;
  readonly playerphysics_get_movement_angle: (a: number) => number;
  readonly playerphysics_get_position_x: (a: number) => number;
  readonly playerphysics_get_position_y: (a: number) => number;
  readonly playerphysics_get_position_z: (a: number) => number;
  readonly playerphysics_is_moving: (a: number) => number;
  readonly playerphysics_new: () => number;
  readonly playerphysics_set_grounded: (a: number, b: number) => void;
  readonly playerphysics_set_position: (a: number, b: number, c: number, d: number) => void;
  readonly playerphysics_update: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
  readonly vector3_add: (a: number, b: number) => number;
  readonly vector3_length: (a: number) => number;
  readonly vector3_new: (a: number, b: number, c: number) => number;
  readonly vector3_normalize: (a: number) => void;
  readonly vector3_scale: (a: number, b: number) => number;
  readonly playerphysics_get_rotation: (a: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
