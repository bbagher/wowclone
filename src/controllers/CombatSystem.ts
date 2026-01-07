export class CombatSystem {
    private playerHealth: number;
    private playerMaxHealth: number;
    private attackRange: number = 3;
    private attackDamage: number = 25;

    constructor(maxHealth: number = 100) {
        this.playerMaxHealth = maxHealth;
        this.playerHealth = maxHealth;
    }

    public takeDamage(amount: number): void {
        this.playerHealth = Math.max(0, this.playerHealth - amount);
        console.log(`Player hit! Health: ${this.playerHealth}/${this.playerMaxHealth}`);

        if (this.playerHealth <= 0) {
            console.log('Player died!');
        }
    }

    public heal(amount: number): void {
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + amount);
    }

    public getHealth(): number {
        return this.playerHealth;
    }

    public getMaxHealth(): number {
        return this.playerMaxHealth;
    }

    public getHealthPercent(): number {
        return (this.playerHealth / this.playerMaxHealth) * 100;
    }

    public isDead(): boolean {
        return this.playerHealth <= 0;
    }

    public getAttackRange(): number {
        return this.attackRange;
    }

    public getAttackDamage(): number {
        return this.attackDamage;
    }

    public reset(): void {
        this.playerHealth = this.playerMaxHealth;
    }
}
