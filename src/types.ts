import { Mesh, AnimationGroup, AbstractMesh } from '@babylonjs/core';

export interface PlayerState {
    mesh: Mesh | null;
    skeletonRoot: AbstractMesh | null;
    velocity: { x: number; y: number; z: number };
    isGrounded: boolean;
    baseOffset: number;
}

export interface MovementInput {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sprint: boolean;
    rotateLeft: boolean;
    rotateRight: boolean;
}

export interface AnimationState {
    groups: AnimationGroup[];
    current: AnimationGroup | null;
}
