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
import {
    applyNailongSkillEffect,
    clearNailongSkillEffect,
    DEFAULT_NAILONG_SKILL_CONFIG,
    isNailongSpecialSkill,
    NailongSkillConfig,
    NailongSkillEffect,
    NailongSkillTarget,
    updateNailongSkillEffect,
} from './NailongSkillModel';

type SkillPlayerId = 'player1' | 'player2';

interface NailongRuntimeEffect {
    controller: unknown;
    playerNode: Node;
    modelEffect: NailongSkillEffect;
}

interface KunSkillEffect {
    trajectory: KunSkillTrajectory;
    ballNode: Node;
    elapsed: number;
}

export class SkillExecutor {
    private readonly _nailongEffects: Map<SkillPlayerId, NailongRuntimeEffect> = new Map();
    public readonly kobeSkillConfig: KobeSkillConfig = { ...DEFAULT_KOBE_SKILL_CONFIG };
    public readonly kunSkillConfig: KunSkillConfig = { ...DEFAULT_KUN_SKILL_CONFIG };
    public readonly nailongSkillConfig: NailongSkillConfig = { ...DEFAULT_NAILONG_SKILL_CONFIG };
    private _kunSkillEffect: KunSkillEffect = null;

    public execute(skillId: string, playerId: SkillPlayerId, playerNode: Node, ballNode: Node): boolean {
        if (!playerNode) {
            return false;
        }

        if (isNailongSpecialSkill(skillId)) {
            return this.executeNailongSpecial(skillId, playerId, playerNode);
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
        this.updateNailongSkill(deltaTime);
        this.updateKunSkill(deltaTime, ballNode);
    }

    public clearEffects(): void {
        this._nailongEffects.forEach((effect) => this.restoreNailongEffect(effect));
        this._nailongEffects.clear();
        this._kunSkillEffect = null;
    }

    private executeNailongSpecial(skillId: string, playerId: SkillPlayerId, playerNode: Node): boolean {
        const controller = playerNode.getComponent('PlayerController') as unknown;
        if (!this.hasHitRange(controller)) {
            return false;
        }

        const activeEffect = this._nailongEffects.get(playerId);
        const target = this.createNailongTarget(controller, playerNode);
        const modelEffect = applyNailongSkillEffect(
            skillId,
            target,
            activeEffect?.modelEffect ?? null,
            this.nailongSkillConfig,
        );
        if (!modelEffect) {
            return false;
        }

        this.applyNailongTarget(controller, playerNode, target);
        this._nailongEffects.set(playerId, {
            controller,
            playerNode,
            modelEffect,
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

    private updateNailongSkill(deltaTime: number): void {
        const expiredPlayers: SkillPlayerId[] = [];
        this._nailongEffects.forEach((effect, playerId) => {
            if (!this.hasHitRange(effect.controller) || !effect.playerNode?.isValid) {
                expiredPlayers.push(playerId);
                return;
            }

            const target = this.createNailongTarget(effect.controller, effect.playerNode);
            const nextEffect = updateNailongSkillEffect(effect.modelEffect, target, deltaTime);
            this.applyNailongTarget(effect.controller, effect.playerNode, target);
            if (!nextEffect) {
                expiredPlayers.push(playerId);
                return;
            }
            effect.modelEffect = nextEffect;
        });

        for (const playerId of expiredPlayers) {
            this._nailongEffects.delete(playerId);
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

    private restoreNailongEffect(effect: NailongRuntimeEffect): void {
        if (!this.hasHitRange(effect.controller) || !effect.playerNode?.isValid) {
            return;
        }

        const target = this.createNailongTarget(effect.controller, effect.playerNode);
        clearNailongSkillEffect(effect.modelEffect, target);
        this.applyNailongTarget(effect.controller, effect.playerNode, target);
    }

    private createNailongTarget(
        controller: { hitRange: number; hitRangeX: number; hitRangeY: number },
        playerNode: Node,
    ): NailongSkillTarget {
        const scale = playerNode.scale;
        return {
            hitRange: controller.hitRange,
            hitRangeX: controller.hitRangeX,
            hitRangeY: controller.hitRangeY,
            scale: { x: scale.x, y: scale.y, z: scale.z },
        };
    }

    private applyNailongTarget(
        controller: { hitRange: number; hitRangeX: number; hitRangeY: number },
        playerNode: Node,
        target: NailongSkillTarget,
    ): void {
        controller.hitRange = target.hitRange;
        controller.hitRangeX = target.hitRangeX;
        controller.hitRangeY = target.hitRangeY;
        playerNode.setScale(target.scale.x, target.scale.y, target.scale.z);
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
