import { Node, RigidBody2D, Vec2, Vec3 } from 'cc';

type SkillPlayerId = 'player1' | 'player2';

interface DuangEffect {
    controller: unknown;
    originalHitRange: number;
    originalHitRangeX: number;
    originalHitRangeY: number;
    remaining: number;
}

interface JiyinDanceEffect {
    remaining: number;
    tickRemaining: number;
    direction: number;
}

export class SkillExecutor {
    private readonly _duangEffects: Map<SkillPlayerId, DuangEffect> = new Map();
    private _jiyinDanceEffect: JiyinDanceEffect = null;

    public execute(skillId: string, playerId: SkillPlayerId, playerNode: Node, ballNode: Node): boolean {
        if (!playerNode) {
            return false;
        }

        if (skillId === 'duang') {
            return this.executeDuang(playerId, playerNode);
        }

        if (!ballNode || !ballNode.active) {
            return false;
        }

        if (skillId === 'helicopter_smash') {
            return this.executeHelicopterSmash(playerId, playerNode, ballNode);
        }

        if (skillId === 'jiyin_dance') {
            return this.executeJiyinDance(ballNode);
        }

        return false;
    }

    public update(deltaTime: number, ballNode: Node): void {
        this.updateDuang(deltaTime);
        this.updateJiyinDance(deltaTime, ballNode);
    }

    public clearEffects(): void {
        this._duangEffects.forEach((effect) => this.restoreHitRange(effect));
        this._duangEffects.clear();
        this._jiyinDanceEffect = null;
    }

    private executeDuang(playerId: SkillPlayerId, playerNode: Node): boolean {
        const controller = playerNode.getComponent('PlayerController') as unknown;
        if (!this.hasHitRange(controller)) {
            return false;
        }

        const activeEffect = this._duangEffects.get(playerId);
        const originalHitRange = activeEffect?.originalHitRange ?? controller.hitRange;
        const originalHitRangeX = activeEffect?.originalHitRangeX ?? controller.hitRangeX;
        const originalHitRangeY = activeEffect?.originalHitRangeY ?? controller.hitRangeY;
        controller.hitRange = originalHitRange * 3;
        controller.hitRangeX = originalHitRangeX * 3;
        controller.hitRangeY = originalHitRangeY * 3;
        this._duangEffects.set(playerId, {
            controller,
            originalHitRange,
            originalHitRangeX,
            originalHitRangeY,
            remaining: 3,
        });

        return true;
    }

    private executeHelicopterSmash(playerId: SkillPlayerId, playerNode: Node, ballNode: Node): boolean {
        const ballBody = ballNode.getComponent(RigidBody2D);
        if (!ballBody) {
            return false;
        }

        const ballWorldPosition = ballNode.worldPosition;
        playerNode.setWorldPosition(
            new Vec3(ballWorldPosition.x, ballWorldPosition.y + 120, playerNode.worldPosition.z),
        );

        const dirX = playerId === 'player1' ? 1 : -1;
        ballBody.linearVelocity = new Vec2(360 * dirX, -1200);
        ballBody.angularVelocity = 0;
        return true;
    }

    private executeJiyinDance(ballNode: Node): boolean {
        const ballBody = ballNode.getComponent(RigidBody2D);
        if (!ballBody) {
            return false;
        }

        this._jiyinDanceEffect = {
            remaining: 1.2,
            tickRemaining: 0,
            direction: 1,
        };
        return true;
    }

    private updateDuang(deltaTime: number): void {
        const expiredPlayers: SkillPlayerId[] = [];
        this._duangEffects.forEach((effect, playerId) => {
            effect.remaining -= deltaTime;
            if (effect.remaining <= 0) {
                this.restoreHitRange(effect);
                expiredPlayers.push(playerId);
            }
        });

        for (const playerId of expiredPlayers) {
            this._duangEffects.delete(playerId);
        }
    }

    private updateJiyinDance(deltaTime: number, ballNode: Node): void {
        if (!this._jiyinDanceEffect || !ballNode || !ballNode.active) {
            return;
        }

        const effect = this._jiyinDanceEffect;
        effect.remaining -= deltaTime;
        effect.tickRemaining -= deltaTime;

        if (effect.remaining <= 0) {
            this._jiyinDanceEffect = null;
            return;
        }

        if (effect.tickRemaining > 0) {
            return;
        }

        const ballBody = ballNode.getComponent(RigidBody2D);
        if (!ballBody) {
            this._jiyinDanceEffect = null;
            return;
        }

        effect.direction *= -1;
        effect.tickRemaining = 0.2;
        const velocity = ballBody.linearVelocity;
        ballBody.linearVelocity = new Vec2(velocity.x + 260 * effect.direction, velocity.y);
    }

    private restoreHitRange(effect: DuangEffect): void {
        if (this.hasHitRange(effect.controller)) {
            effect.controller.hitRange = effect.originalHitRange;
            effect.controller.hitRangeX = effect.originalHitRangeX;
            effect.controller.hitRangeY = effect.originalHitRangeY;
        }
    }

    private hasHitRange(controller: unknown): controller is { hitRange: number; hitRangeX: number; hitRangeY: number } {
        return (
            typeof controller === 'object' &&
            controller !== null &&
            typeof (controller as { hitRange?: unknown }).hitRange === 'number' &&
            typeof (controller as { hitRangeX?: unknown }).hitRangeX === 'number' &&
            typeof (controller as { hitRangeY?: unknown }).hitRangeY === 'number'
        );
    }
}
