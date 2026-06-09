export const NAILONG_SPECIAL_SKILL_ID = 'duang';

export interface NailongSkillConfig {
    duration: number;
    hitRangeMultiplier: number;
    visualScaleMultiplier: number;
}

export const DEFAULT_NAILONG_SKILL_CONFIG: NailongSkillConfig = {
    duration: 10,
    hitRangeMultiplier: 3,
    visualScaleMultiplier: 1.35,
};

export interface NailongSkillScale {
    x: number;
    y: number;
    z: number;
}

export interface NailongSkillTarget {
    hitRange: number;
    hitRangeX: number;
    hitRangeY: number;
    scale: NailongSkillScale;
}

export interface NailongSkillEffect {
    originalHitRange: number;
    originalHitRangeX: number;
    originalHitRangeY: number;
    originalScale: NailongSkillScale;
    remaining: number;
}

export function isNailongSpecialSkill(skillId: string): boolean {
    return skillId === NAILONG_SPECIAL_SKILL_ID;
}

export function applyNailongSkillEffect(
    skillId: string,
    target: NailongSkillTarget,
    activeEffect: NailongSkillEffect | null,
    config: NailongSkillConfig = DEFAULT_NAILONG_SKILL_CONFIG,
): NailongSkillEffect | null {
    if (!isNailongSpecialSkill(skillId)) {
        return activeEffect;
    }

    const originalHitRange = activeEffect?.originalHitRange ?? target.hitRange;
    const originalHitRangeX = activeEffect?.originalHitRangeX ?? target.hitRangeX;
    const originalHitRangeY = activeEffect?.originalHitRangeY ?? target.hitRangeY;
    const originalScale = activeEffect?.originalScale ?? cloneScale(target.scale);

    target.hitRange = originalHitRange * config.hitRangeMultiplier;
    target.hitRangeX = originalHitRangeX * config.hitRangeMultiplier;
    target.hitRangeY = originalHitRangeY * config.hitRangeMultiplier;
    target.scale.x = originalScale.x * config.visualScaleMultiplier;
    target.scale.y = originalScale.y * config.visualScaleMultiplier;
    target.scale.z = originalScale.z;

    return {
        originalHitRange,
        originalHitRangeX,
        originalHitRangeY,
        originalScale: cloneScale(originalScale),
        remaining: config.duration,
    };
}

export function updateNailongSkillEffect(
    effect: NailongSkillEffect | null,
    target: NailongSkillTarget,
    deltaTime: number,
): NailongSkillEffect | null {
    if (!effect) {
        return null;
    }

    const remaining = effect.remaining - deltaTime;
    if (remaining <= 0) {
        restoreNailongSkillTarget(effect, target);
        return null;
    }

    return {
        ...effect,
        originalScale: cloneScale(effect.originalScale),
        remaining,
    };
}

export function clearNailongSkillEffect(effect: NailongSkillEffect | null, target: NailongSkillTarget): void {
    if (!effect) {
        return;
    }

    restoreNailongSkillTarget(effect, target);
}

export function restoreNailongSkillTarget(effect: NailongSkillEffect, target: NailongSkillTarget): void {
    target.hitRange = effect.originalHitRange;
    target.hitRangeX = effect.originalHitRangeX;
    target.hitRangeY = effect.originalHitRangeY;
    target.scale.x = effect.originalScale.x;
    target.scale.y = effect.originalScale.y;
    target.scale.z = effect.originalScale.z;
}

function cloneScale(scale: NailongSkillScale): NailongSkillScale {
    return {
        x: scale.x,
        y: scale.y,
        z: scale.z,
    };
}
