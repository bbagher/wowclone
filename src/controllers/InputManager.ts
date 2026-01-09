import { Scene } from '@babylonjs/core/scene';
import { GameConfig } from '../config';
import { MovementInput } from '../types';

export class InputManager {
    private inputMap: { [key: string]: boolean } = {};
    private scene: Scene;
    private keyboardObserver: any = null;

    constructor(_canvas: HTMLCanvasElement, scene: Scene) {
        this.scene = scene;
    }

    public setup(): void {
        // Keyboard input
        this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();

            switch (kbInfo.type) {
                case GameConfig.KEYBOARD_EVENT_TYPE.KEY_DOWN:
                    this.inputMap[key] = true;
                    break;
                case GameConfig.KEYBOARD_EVENT_TYPE.KEY_UP:
                    this.inputMap[key] = false;
                    break;
            }
        });

        // WoW-style: Mouse cursor is always visible, no pointer lock
    }

    public getMovementInput(): MovementInput {
        return {
            forward: this.inputMap[GameConfig.KEYS.FORWARD] || false,
            backward: this.inputMap[GameConfig.KEYS.BACKWARD] || false,
            left: this.inputMap[GameConfig.KEYS.LEFT] || false,
            right: this.inputMap[GameConfig.KEYS.RIGHT] || false,
            jump: this.inputMap[GameConfig.KEYS.JUMP] || false,
            sprint: this.inputMap[GameConfig.KEYS.SPRINT] || false,
            rotateLeft: this.inputMap[GameConfig.KEYS.ROTATE_LEFT] || false,
            rotateRight: this.inputMap[GameConfig.KEYS.ROTATE_RIGHT] || false
        };
    }

    public dispose(): void {
        if (this.keyboardObserver) {
            this.scene.onKeyboardObservable.remove(this.keyboardObserver);
            this.keyboardObserver = null;
        }
    }
}
