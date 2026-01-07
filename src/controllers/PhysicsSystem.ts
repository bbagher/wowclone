import { Vector3 } from '@babylonjs/core/Maths/math';
import { GameConfig } from '../config';
import { PlayerState } from '../types';

export class PhysicsSystem {
    public applyGravity(velocity: Vector3): void {
        velocity.y += GameConfig.GRAVITY;
    }

    public applyVelocity(position: Vector3, velocity: Vector3): void {
        position.addInPlace(velocity);
    }

    public checkGroundCollision(playerState: PlayerState): void {
        if (!playerState.mesh) return;

        // Simple ground collision at fixed height
        // TODO: Implement proper terrain collision using raycasting
        if (playerState.mesh.position.y <= GameConfig.PLAYER_GROUND_HEIGHT) {
            playerState.mesh.position.y = GameConfig.PLAYER_GROUND_HEIGHT;
            playerState.velocity.y = 0;
            playerState.isGrounded = true;
        } else {
            playerState.isGrounded = false;
        }
    }

    public jump(playerState: PlayerState): boolean {
        if (!playerState.isGrounded) {
            return false;
        }

        playerState.velocity.y = GameConfig.JUMP_FORCE;
        playerState.isGrounded = false;
        return true;
    }
}
