import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import '@babylonjs/core/Culling/ray'; // Side effect import
import { GameConfig } from '../config';

export class CameraController {
    private camera: ArcRotateCamera;
    private canvas: HTMLCanvasElement;
    private scene: Scene;
    private isRightMouseDown: boolean = false;
    private isLeftMouseDown: boolean = false;
    private lastPointerX: number = 0; // Track pointer position for right-click drag
    private lastPointerY: number = 0;
    private targetAlpha: number = 0; // Target rotation for realignment
    private realignSpeed: number = 0.05; // Speed of camera realignment (0-1)
    private pointerObserver: any = null;

    constructor(scene: Scene, canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.scene = scene;
        this.camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2,
            Math.PI / 3,
            10,
            Vector3.Zero(),
            scene
        );

        this.targetAlpha = this.camera.alpha;
        this.setup();
    }

    private setup(): void {
        this.camera.attachControl(this.canvas, true);

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

        // WoW-style camera - disable automatic rotation
        this.camera.useAutoRotationBehavior = false;

        // Configure mouse inputs for WoW-style camera
        // Only left mouse button rotates the camera (right click will rotate character)
        const mouseInput = this.camera.inputs.attached.mouse;
        if (mouseInput) {
            // Only allow left (0) mouse button to rotate camera
            // Right mouse (2) is reserved for character rotation
            (mouseInput as any).buttons = [0];
        }

        // Disable pointer lock to keep cursor visible
        if (this.canvas.style) {
            this.canvas.style.cursor = 'default';
        }

        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Use Babylon's pointer observable to track mouse button states
        // This integrates properly with Babylon's input system
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                const event = pointerInfo.event as PointerEvent;
                if (event.button === 2) { // Right mouse
                    this.isRightMouseDown = true;
                    this.lastPointerX = event.clientX;
                    this.lastPointerY = event.clientY;
                    console.log('Right mouse DOWN');
                } else if (event.button === 0) { // Left mouse
                    this.isLeftMouseDown = true;
                    console.log('Left mouse DOWN');
                }
            } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
                const event = pointerInfo.event as PointerEvent;
                if (event.button === 2) { // Right mouse
                    this.isRightMouseDown = false;
                    console.log('Right mouse UP');
                } else if (event.button === 0) { // Left mouse
                    this.isLeftMouseDown = false;
                    console.log('Left mouse UP');
                }
            } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
                const event = pointerInfo.event as PointerEvent;

                // Handle right mouse drag to rotate camera
                if (this.isRightMouseDown) {
                    const deltaX = event.clientX - this.lastPointerX;
                    const deltaY = event.clientY - this.lastPointerY;

                    // Apply rotation using the same sensitivity as left mouse
                    this.camera.alpha += deltaX / this.camera.angularSensibilityX;
                    this.camera.beta += deltaY / this.camera.angularSensibilityY;

                    // Update last position
                    this.lastPointerX = event.clientX;
                    this.lastPointerY = event.clientY;
                }
            }
        });
    }

    public update(isCharacterMoving: boolean = false, isCharacterRotating: boolean = false): void {
        // While dragging, just track the current camera position
        // Don't try to realign - let Babylon's camera controls handle it
        if (this.isRightMouseDown || this.isLeftMouseDown) {
            // Update target to current position so realignment starts from here when released
            this.targetAlpha = this.camera.alpha;
            console.log('DRAGGING - left:', this.isLeftMouseDown, 'right:', this.isRightMouseDown, 'alpha:', this.camera.alpha);
            return; // Exit early - don't do any realignment while dragging
        }

        // Get character's current rotation
        const target = this.camera.lockedTarget as Mesh;

        // When character is rotating with Q/E, lock camera behind character's back
        if (isCharacterRotating && target && target.rotation) {
            // Instantly lock camera behind character during rotation
            this.camera.alpha = this.calculateCameraAlphaBehindCharacter(target.rotation.y);
            this.targetAlpha = this.camera.alpha;
            return;
        }

        // While character is moving, don't realign camera
        // The character faces camera.alpha while moving, so realignment would create a feedback loop
        if (isCharacterMoving) {
            // Just track current position - don't realign
            this.targetAlpha = this.camera.alpha;
            return;
        }

        // Auto-realign camera behind character when not dragging AND character is idle
        if (target && target.rotation) {
            // Calculate target position using the same formula to prevent inconsistencies
            this.targetAlpha = this.normalizeAngle(
                this.calculateCameraAlphaBehindCharacter(target.rotation.y)
            );
        }

        // Smoothly interpolate camera to target position
        const currentAlpha = this.camera.alpha;
        const diff = this.getShortestAngleDiff(currentAlpha, this.targetAlpha);

        // Lerp towards target
        if (Math.abs(diff) > 0.01) {
            console.log('REALIGNING - target:', this.targetAlpha, 'current:', currentAlpha, 'diff:', diff);
            this.camera.alpha = this.normalizeAngle(currentAlpha + diff * this.realignSpeed);
        }
    }

    /**
     * Returns true if right mouse button is currently being held down.
     * This is used to trigger continuous character rotation to match camera.
     */
    public isRightMouseDragging(): boolean {
        return this.isRightMouseDown;
    }

    /**
     * Calculate the camera alpha needed to position the camera behind the character's back.
     * This is the single source of truth for the camera-to-character lock formula.
     * Formula from test-orientation.html: camera.alpha = -character.rotation.y - Math.PI / 2
     */
    private calculateCameraAlphaBehindCharacter(characterRotationY: number): number {
        return -characterRotationY - Math.PI / 2;
    }

    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    private getShortestAngleDiff(from: number, to: number): number {
        const normFrom = this.normalizeAngle(from);
        const normTo = this.normalizeAngle(to);
        let diff = normTo - normFrom;

        // Take shortest path
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;

        return diff;
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

    public isMouseDragging(): boolean {
        return this.isRightMouseDown || this.isLeftMouseDown;
    }

    public dispose(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }
        this.camera.dispose();
    }
}
