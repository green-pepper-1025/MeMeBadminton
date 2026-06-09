export type KunSkillPlayerId = 'player1' | 'player2';

export interface KunSkillPoint {
    x: number;
    y: number;
}

export interface KunSkillConfig {
    leftKunSkillPoint: KunSkillPoint;
    rightKunSkillPoint: KunSkillPoint;
    kunSkillHorizontalSpeed: number;
    kunSkillDuration: number;
    kunSkillCurveAmplitude: number;
    kunSkillCurveFrequency: number;
    kunSkillVerticalLift: number;
    kunSkillVerticalDrop: number;
    kunSkillBallOffsetY: number;
    kunSkillControlPoints: number;
    kunSkillInputLockDuration: number;
}

export interface KunSkillTrajectorySample extends KunSkillPoint {
    time: number;
}

export interface KunSkillTrajectory {
    skillPoint: KunSkillPoint;
    start: KunSkillPoint;
    initialVelocity: KunSkillPoint;
    duration: number;
    direction: number;
    samples: KunSkillTrajectorySample[];
    config: KunSkillConfig;
}

export const KUN_SPECIAL_SKILL_ID = 'jiyin_dance';

export const DEFAULT_KUN_SKILL_CONFIG: KunSkillConfig = {
    leftKunSkillPoint: { x: -380, y: 92 },
    rightKunSkillPoint: { x: 380, y: 92 },
    kunSkillHorizontalSpeed: 900,
    kunSkillDuration: 0.82,
    kunSkillCurveAmplitude: 94,
    kunSkillCurveFrequency: 1.5,
    kunSkillVerticalLift: 88,
    kunSkillVerticalDrop: 70,
    kunSkillBallOffsetY: -18,
    kunSkillControlPoints: 18,
    kunSkillInputLockDuration: 0.32,
};

export function isKunSpecialSkill(skillId: string): boolean {
    return skillId === KUN_SPECIAL_SKILL_ID;
}

export function getKunSkillPoint(playerId: KunSkillPlayerId, config: KunSkillConfig): KunSkillPoint {
    return playerId === 'player1' ? config.leftKunSkillPoint : config.rightKunSkillPoint;
}

export function buildKunSkillTrajectory(playerId: KunSkillPlayerId, config: KunSkillConfig): KunSkillTrajectory {
    const direction = getKunSkillDirection(playerId);
    const skillPoint = getKunSkillPoint(playerId, config);
    const start = {
        x: skillPoint.x,
        y: skillPoint.y + config.kunSkillBallOffsetY,
    };
    const sampleCount = Math.max(2, Math.floor(config.kunSkillControlPoints));
    const trajectory: KunSkillTrajectory = {
        skillPoint,
        start,
        initialVelocity: calculateKunSkillVelocity(0, direction, config),
        duration: config.kunSkillDuration,
        direction,
        samples: [],
        config,
    };

    for (let i = 0; i < sampleCount; i++) {
        const time = (config.kunSkillDuration * i) / (sampleCount - 1);
        trajectory.samples.push(sampleKunSkillTrajectory(trajectory, time));
    }

    return trajectory;
}

export function sampleKunSkillTrajectory(trajectory: KunSkillTrajectory, time: number): KunSkillTrajectorySample {
    const config = trajectory.config;
    const clampedTime = clamp(time, 0, config.kunSkillDuration);
    const progress = config.kunSkillDuration > 0 ? clampedTime / config.kunSkillDuration : 1;
    const taper = Math.sin(Math.PI * progress);
    const curve =
        config.kunSkillCurveAmplitude * Math.sin(Math.PI * 2 * config.kunSkillCurveFrequency * progress) * taper;
    const lift = config.kunSkillVerticalLift * taper;

    return {
        time: clampedTime,
        x: trajectory.start.x + trajectory.direction * config.kunSkillHorizontalSpeed * clampedTime,
        y: trajectory.start.y + lift + curve - config.kunSkillVerticalDrop * progress,
    };
}

export function sampleKunSkillVelocity(trajectory: KunSkillTrajectory, time: number): KunSkillPoint {
    return calculateKunSkillVelocity(time, trajectory.direction, trajectory.config);
}

function calculateKunSkillVelocity(time: number, direction: number, config: KunSkillConfig): KunSkillPoint {
    if (config.kunSkillDuration <= 0) {
        return { x: direction * config.kunSkillHorizontalSpeed, y: 0 };
    }

    const clampedTime = clamp(time, 0, config.kunSkillDuration);
    const progress = clampedTime / config.kunSkillDuration;
    const waveAngle = Math.PI * 2 * config.kunSkillCurveFrequency * progress;
    const taperAngle = Math.PI * progress;
    const waveDerivative =
        config.kunSkillCurveAmplitude *
        (Math.PI * 2 * config.kunSkillCurveFrequency * Math.cos(waveAngle) * Math.sin(taperAngle) +
            Math.PI * Math.sin(waveAngle) * Math.cos(taperAngle));
    const liftDerivative = config.kunSkillVerticalLift * Math.PI * Math.cos(taperAngle);
    const y = (liftDerivative + waveDerivative - config.kunSkillVerticalDrop) / config.kunSkillDuration;

    return {
        x: direction * config.kunSkillHorizontalSpeed,
        y,
    };
}

function getKunSkillDirection(playerId: KunSkillPlayerId): number {
    return playerId === 'player1' ? 1 : -1;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
