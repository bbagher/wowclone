import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GameConfig } from '../config';

export class CameraController {
    private camera: ArcRotateCamera;

    constructor(scene: Scene, canvas: HTMLCanvasElement) {
        this.camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2,
            Math.PI / 3,
            10,
            Vector3.Zero(),
            scene
        );

        this.setup(canvas);
    }

    private setup(canvas: HTMLCanvasElement): void {
        this.camera.attachControl(canvas, true);
        this.camera.radius = GameConfig.CAMERA_RADIUS;
        this.camera.beta = GameConfig.CAMERA_BETA;
        this.camera.lowerRadiusLimit = GameConfig.CAMERA_MIN_RADIUS;
        this.camera.upperRadiusLimit = GameConfig.CAMERA_MAX_RADIUS;
        this.camera.lowerBetaLimit = GameConfig.CAMERA_MIN_BETA;
        this.camera.upperBetaLimit = GameConfig.CAMERA_MAX_BETA;
        this.camera.wheelPrecision = GameConfig.CAMERA_WHEEL_PRECISION;

        // Make camera more responsive
        this.camera.angularSensibilityX = GameConfig.CAMERA_ANGULAR_SENSITIVITY;
        this.camera.angularSensibilityY = GameConfig.CAMERA_ANGULAR_SENSITIVITY;
        this.camera.inertia = GameConfig.CAMERA_INERTIA;
        this.camera.panningSensibility = 0; // Disable panning

        // WoW-style camera - disable automatic rotation
        this.camera.useAutoRotationBehavior = false;
    }

    public setTarget(target: Mesh): void {
        this.camera.lockedTarget = target;
    }

    public getCamera(): ArcRotateCamera {
        return this.camera;
    }

    public getForwardDirection(): Vector3 {
        const forward = this.camera.getForwardRay().direction;
        forward.y = 0;
        forward.normalize();
        return forward;
    }

    public getRightDirection(): Vector3 {
        const forward = this.getForwardDirection();
        return Vector3.Cross(forward, Vector3.Up());
    }

    public getAlpha(): number {
        return this.camera.alpha;
    }

    public dispose(): void {
        this.camera.dispose();
    }
}
