import { Node, RigidBody2D, Vec2, Vec3, tween } from 'cc';
import { buildKobeSkillShot, DEFAULT_KOBE_SKILL_CONFIG, KobeSkillConfig } from './KobeSpecialModel';

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
    public readonly kobeSkillConfig: KobeSkillConfig = { ...DEFAULT_KOBE_SKILL_CONFIG };
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

        const shot = buildKobeSkillShot(playerId, this.kobeSkillConfig);
        playerNode.setPosition(shot.skillPoint.x, shot.skillPoint.y, playerNode.position.z);
        ballNode.setPosition(shot.skillPoint.x, shot.skillPoint.y - 24, ballNode.position.z);

        const controller = playerNode.getComponent('PlayerController') as unknown;
        if (this.hasKobeSkillController(controller)) {
            controller.lockSkillInput(this.kobeSkillConfig.kobeSkillInputLockDuration);
            controller.lockHitAfterSkill(this.kobeSkillConfig.kobeSkillDuration);
            controller.playSkillSmashAnimation();
        }

        ballBody.linearVelocity = new Vec2(shot.velocity.x, shot.velocity.y);
        ballBody.angularVelocity = 0;
        this.playKobeSkillFeedback(playerNode, ballNode);
        return true;
    }

    private playKobeSkillFeedback(playerNode: Node, ballNode: Node): void {
        const playerScale = playerNode.scale.clone();
        tween(playerNode)
            .to(0.05, { scale: new Vec3(playerScale.x * 1.12, playerScale.y * 1.12, playerScale.z) })
            .to(0.12, { scale: playerScale }, { easing: 'quadOut' })
            .start();

        const ballScale = ballNode.scale.clone();
        tween(ballNode)
            .to(0.04, { scale: new Vec3(ballScale.x * 1.35, ballScale.y * 0.75, ballScale.z) })
            .to(0.12, { scale: ballScale }, { easing: 'quadOut' })
            .start();
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

    private hasKobeSkillController(
        controller: unknown,
    ): controller is { lockSkillInput: (duration: number) => void; playSkillSmashAnimation: () => void; lockHitAfterSkill: (duration?: number) => void } {
        return (
            typeof controller === 'object' &&
            controller !== null &&
            typeof (controller as { lockSkillInput?: unknown }).lockSkillInput === 'function' &&
            typeof (controller as { playSkillSmashAnimation?: unknown }).playSkillSmashAnimation === 'function' &&
            typeof (controller as { lockHitAfterSkill?: unknown }).lockHitAfterSkill === 'function'
        );
    }
}
