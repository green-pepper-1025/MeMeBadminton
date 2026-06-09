import { Node, RigidBody2D, UITransform, Vec2, Vec3, tween } from 'cc';
import { buildKobeSkillShot, DEFAULT_KOBE_SKILL_CONFIG, KobeSkillConfig } from './KobeSpecialModel';
import {
    buildKunSkillTrajectory,
    DEFAULT_KUN_SKILL_CONFIG,
    isKunSpecialSkill,
    KunSkillConfig,
    KunSkillTrajectory,
    sampleKunSkillVelocity,
} from './KunSkillModel';

type SkillPlayerId = 'player1' | 'player2';

interface DuangEffect {
    controller: unknown;
    originalHitRange: number;
    originalHitRangeX: number;
    originalHitRangeY: number;
    remaining: number;
}

interface KunSkillEffect {
    trajectory: KunSkillTrajectory;
    ballNode: Node;
    elapsed: number;
}

export class SkillExecutor {
    private readonly _duangEffects: Map<SkillPlayerId, DuangEffect> = new Map();
    public readonly kobeSkillConfig: KobeSkillConfig = { ...DEFAULT_KOBE_SKILL_CONFIG };
    public readonly kunSkillConfig: KunSkillConfig = { ...DEFAULT_KUN_SKILL_CONFIG };
    private _kunSkillEffect: KunSkillEffect = null;

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

        if (isKunSpecialSkill(skillId)) {
            return this.executeKunSpecial(playerId, playerNode, ballNode);
        }

        return false;
    }

    public update(deltaTime: number, ballNode: Node): void {
        this.updateDuang(deltaTime);
        this.updateKunSkill(deltaTime, ballNode);
    }

    public clearEffects(): void {
        this._duangEffects.forEach((effect) => this.restoreHitRange(effect));
        this._duangEffects.clear();
        this._kunSkillEffect = null;
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
        if (this.hasSkillController(controller)) {
            controller.lockSkillInput(this.kobeSkillConfig.kobeSkillInputLockDuration);
            controller.lockHitAfterSkill(this.kobeSkillConfig.kobeSkillDuration);
            controller.playSkillSmashAnimation();
        }

        ballBody.linearVelocity = new Vec2(shot.velocity.x, shot.velocity.y);
        ballBody.angularVelocity = 0;
        this.playKobeSkillFeedback(playerNode, ballNode);
        return true;
    }

    private executeKunSpecial(playerId: SkillPlayerId, playerNode: Node, ballNode: Node): boolean {
        const ballBody = ballNode.getComponent(RigidBody2D);
        if (!ballBody) {
            return false;
        }

        const trajectory = buildKunSkillTrajectory(playerId, this.kunSkillConfig);
        playerNode.setPosition(trajectory.skillPoint.x, trajectory.skillPoint.y, playerNode.position.z);
        this.setBallPositionInSkillSpace(playerNode, ballNode, trajectory.start.x, trajectory.start.y);
        this.resetBallFlightState(ballNode);

        const controller = playerNode.getComponent('PlayerController') as unknown;
        if (this.hasSkillController(controller)) {
            controller.lockSkillInput(this.kunSkillConfig.kunSkillInputLockDuration);
            controller.lockHitAfterSkill(this.kunSkillConfig.kunSkillDuration + 0.1);
            controller.playSkillSmashAnimation();
        }

        ballBody.linearVelocity = new Vec2(trajectory.initialVelocity.x, trajectory.initialVelocity.y);
        ballBody.angularVelocity = 0;
        this._kunSkillEffect = {
            trajectory,
            ballNode,
            elapsed: 0,
        };
        this.playKunSkillFeedback(playerNode, ballNode);
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

    private updateKunSkill(deltaTime: number, ballNode: Node): void {
        if (!this._kunSkillEffect || !ballNode || !ballNode.active || ballNode !== this._kunSkillEffect.ballNode) {
            return;
        }

        const effect = this._kunSkillEffect;
        effect.elapsed += deltaTime;
        if (effect.elapsed >= effect.trajectory.duration) {
            this._kunSkillEffect = null;
            return;
        }

        const ballBody = ballNode.getComponent(RigidBody2D);
        if (!ballBody) {
            this._kunSkillEffect = null;
            return;
        }

        const velocity = sampleKunSkillVelocity(effect.trajectory, effect.elapsed);
        ballBody.linearVelocity = new Vec2(velocity.x, velocity.y);
        ballBody.angularVelocity = 0;
    }

    private playKunSkillFeedback(playerNode: Node, ballNode: Node): void {
        const playerScale = playerNode.scale.clone();
        tween(playerNode)
            .to(0.04, { scale: new Vec3(playerScale.x * 0.82, playerScale.y * 1.18, playerScale.z) })
            .to(
                0.08,
                { scale: new Vec3(playerScale.x * 1.14, playerScale.y * 0.9, playerScale.z) },
                { easing: 'quadOut' },
            )
            .to(0.12, { scale: playerScale }, { easing: 'quadOut' })
            .start();

        const ballScale = ballNode.scale.clone();
        tween(ballNode)
            .to(0.08, { scale: new Vec3(ballScale.x * 1.45, ballScale.y * 0.7, ballScale.z) })
            .to(0.16, { scale: ballScale }, { easing: 'quadOut' })
            .start();
    }

    private setBallPositionInSkillSpace(playerNode: Node, ballNode: Node, x: number, y: number): void {
        if (ballNode.parent === playerNode.parent) {
            ballNode.setPosition(x, y, ballNode.position.z);
            return;
        }

        const worldPosition = this.localPointToWorld(playerNode.parent, x, y, ballNode.worldPosition.z);
        ballNode.setWorldPosition(worldPosition);
    }

    private localPointToWorld(parent: Node | null, x: number, y: number, z: number): Vec3 {
        const localPosition = new Vec3(x, y, z);
        const transform = parent?.getComponent(UITransform);
        if (transform) {
            return transform.convertToWorldSpaceAR(localPosition);
        }

        const parentWorld = parent?.worldPosition;
        if (!parentWorld) {
            return localPosition;
        }

        return new Vec3(parentWorld.x + x, parentWorld.y + y, parentWorld.z + z);
    }

    private resetBallFlightState(ballNode: Node): void {
        const collision = ballNode.getComponent('ShuttleCourtCollision') as unknown;
        if (this.hasResetFlightState(collision)) {
            collision.resetFlightState(true);
        }
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

    private hasSkillController(
        controller: unknown,
    ): controller is {
        lockSkillInput: (duration: number) => void;
        playSkillSmashAnimation: () => void;
        lockHitAfterSkill: (duration?: number) => void;
    } {
        return (
            typeof controller === 'object' &&
            controller !== null &&
            typeof (controller as { lockSkillInput?: unknown }).lockSkillInput === 'function' &&
            typeof (controller as { playSkillSmashAnimation?: unknown }).playSkillSmashAnimation === 'function' &&
            typeof (controller as { lockHitAfterSkill?: unknown }).lockHitAfterSkill === 'function'
        );
    }

    private hasResetFlightState(collision: unknown): collision is { resetFlightState: (active?: boolean) => void } {
        return (
            typeof collision === 'object' &&
            collision !== null &&
            typeof (collision as { resetFlightState?: unknown }).resetFlightState === 'function'
        );
    }
}
