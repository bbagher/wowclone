import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationState } from '../types';

export class AnimationController {
    private state: AnimationState = {
        groups: [],
        current: null
    };
    private buttonContainer: HTMLElement | null = null;

    constructor(animations: AnimationGroup[]) {
        this.state.groups = animations;

        // Stop all animations initially
        this.state.groups.forEach(anim => anim.stop());
    }

    public setButtonContainer(containerId: string): void {
        this.buttonContainer = document.getElementById(containerId);
        if (this.buttonContainer) {
            this.createButtons();
        }
    }

    public playAnimation(animation: AnimationGroup): void {
        // Don't restart if already playing this animation
        if (this.state.current === animation && animation.isPlaying) {
            return;
        }

        // Stop all animations first
        this.state.groups.forEach(anim => anim.stop());

        // Play new animation
        animation.start(true, 1.0, animation.from, animation.to, false);
        this.state.current = animation;

        // Update active button
        const index = this.state.groups.indexOf(animation);
        if (index !== -1) {
            this.updateActiveButton(index);
        }
    }

    public playAnimationByName(name: string): void {
        const animation = this.findAnimation(name);
        if (animation) {
            this.playAnimation(animation);
        }
    }

    public findAnimation(searchTerm: string): AnimationGroup | null {
        return this.state.groups.find(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) || null;
    }

    public setAnimationSpeed(speed: number): void {
        if (this.state.current) {
            this.state.current.speedRatio = speed;
        }
    }

    public getAnimations(): AnimationGroup[] {
        return this.state.groups;
    }

    public getCurrentAnimation(): AnimationGroup | null {
        return this.state.current;
    }

    private createButtons(): void {
        if (!this.buttonContainer) return;

        this.buttonContainer.innerHTML = '';

        this.state.groups.forEach((anim, index) => {
            const button = document.createElement('button');
            button.className = 'anim-button';

            // Clean up animation name for display
            const cleanName = anim.name.split('|')[1] || anim.name;
            button.textContent = cleanName;
            button.id = `anim-btn-${index}`;

            button.addEventListener('click', () => {
                this.playAnimation(anim);
            });

            this.buttonContainer!.appendChild(button);
        });
    }

    private updateActiveButton(activeIndex: number): void {
        this.state.groups.forEach((_, index) => {
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

    public dispose(): void {
        this.state.groups.forEach(anim => anim.stop());
        this.state.current = null;
    }
}
