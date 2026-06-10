export type HitAction = 'high' | 'low';

export interface HitDecisionConfig {
    hitRangeX: number;
    hitRangeY: number;
    lowHitThreshold: number;
    highHitMinY: number;
}

export interface HitPointLike {
    x: number;
    y: number;
}

export function isShuttleInHitRange(dx: number, dy: number, config: HitDecisionConfig): boolean {
    return Math.abs(dx) <= config.hitRangeX && Math.abs(dy) <= config.hitRangeY;
}

export function chooseHitAction(dx: number, dy: number, config: HitDecisionConfig): HitAction | null {
    if (!isShuttleInHitRange(dx, dy, config)) {
        return null;
    }

    if (dy < config.lowHitThreshold) {
        return 'low';
    }

    return 'high';
}

export function chooseHitActionFromPoints(
    shuttlePosition: HitPointLike,
    hitPointPosition: HitPointLike,
    config: HitDecisionConfig
): HitAction | null {
    return chooseHitAction(shuttlePosition.x - hitPointPosition.x, shuttlePosition.y - hitPointPosition.y, config);
}
