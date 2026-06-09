export type KobeSkillPlayerId = 'player1' | 'player2';

export interface KobeSkillPoint {
    x: number;
    y: number;
}

export interface KobeSkillConfig {
    leftKobeSkillPoint: KobeSkillPoint;
    rightKobeSkillPoint: KobeSkillPoint;
    kobeSkillHorizontalSpeed: number;
    kobeSkillVerticalSpeed: number;
    kobeSkillDownwardForce: number;
    kobeSkillDuration: number;
    kobeSkillInputLockDuration: number;
}

export interface KobeSkillShot {
    skillPoint: KobeSkillPoint;
    velocity: KobeSkillPoint;
}

export const DEFAULT_KOBE_SKILL_CONFIG: KobeSkillConfig = {
    leftKobeSkillPoint: { x: -285, y: -30 },
    rightKobeSkillPoint: { x: 285, y: -30 },
    kobeSkillHorizontalSpeed: 980,
    kobeSkillVerticalSpeed: 1180,
    kobeSkillDownwardForce: 180,
    kobeSkillDuration: 0.32,
    kobeSkillInputLockDuration: 0.28,
};

export function getKobeSkillPoint(playerId: KobeSkillPlayerId, config: KobeSkillConfig): KobeSkillPoint {
    return playerId === 'player1' ? config.leftKobeSkillPoint : config.rightKobeSkillPoint;
}

export function buildKobeSkillShot(playerId: KobeSkillPlayerId, config: KobeSkillConfig): KobeSkillShot {
    const dirX = playerId === 'player1' ? 1 : -1;
    return {
        skillPoint: getKobeSkillPoint(playerId, config),
        velocity: {
            x: config.kobeSkillHorizontalSpeed * dirX,
            y: -Math.abs(config.kobeSkillVerticalSpeed + config.kobeSkillDownwardForce),
        },
    };
}
