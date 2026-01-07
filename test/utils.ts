import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';

export const EPSILON = 0.001;
export const ANGLE_EPSILON = 0.01; // More tolerance for angles

export interface TestEnvironment {
    engine: NullEngine;
    scene: Scene;
}

export function createTestScene(): TestEnvironment {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    return { engine, scene };
}

export function expectVectorClose(actual: Vector3, expected: Vector3, epsilon = EPSILON) {
    expect(actual.x).toBeCloseTo(expected.x, 3);
    expect(actual.y).toBeCloseTo(expected.y, 3);
    expect(actual.z).toBeCloseTo(expected.z, 3);
}

export function expectAngleClose(actual: number, expected: number, message?: string | number) {
    // Normalize angles to [-PI, PI]
    const normalizeAngle = (a: number) => {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
    };

    const epsilon = typeof message === 'number' ? message : ANGLE_EPSILON;
    const normalizedActual = normalizeAngle(actual);
    const normalizedExpected = normalizeAngle(expected);
    const diff = Math.abs(normalizedActual - normalizedExpected);

    expect(diff).toBeLessThan(epsilon);
}

export function getForwardFromRotation(rotationY: number): Vector3 {
    return new Vector3(
        Math.sin(rotationY),
        0,
        Math.cos(rotationY)
    );
}

export function getRotationFromDirection(direction: Vector3): number {
    return Math.atan2(direction.x, direction.z);
}
