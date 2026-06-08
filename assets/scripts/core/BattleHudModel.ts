export interface ScoreboardInput {
    player1Name: string;
    player2Name: string;
    score1: number;
    score2: number;
    roundsWon1: number;
    roundsWon2: number;
}

export interface ScoreboardModel {
    player1Name: string;
    player2Name: string;
    score1Text: string;
    score2Text: string;
    gameText: string;
    roundsText: string;
}

export interface SkillMeterInput {
    charge: number;
    usesRemaining: number;
    isReady: boolean;
}

export interface SkillMeterModel {
    fillRatio: number;
    isFull: boolean;
    usesText: string;
}

export function buildScoreboardModel(input: ScoreboardInput): ScoreboardModel {
    const currentGame = input.roundsWon1 + input.roundsWon2 + 1;

    return {
        player1Name: input.player1Name,
        player2Name: input.player2Name,
        score1Text: formatScore(input.score1),
        score2Text: formatScore(input.score2),
        gameText: `GAME ${currentGame}`,
        roundsText: `${input.roundsWon1} - ${input.roundsWon2}`,
    };
}

export function buildSkillMeterModel(input: SkillMeterInput): SkillMeterModel {
    const clampedCharge = Math.max(0, Math.min(100, input.charge));

    return {
        fillRatio: clampedCharge / 100,
        isFull: input.isReady || clampedCharge >= 100,
        usesText: `x${Math.max(0, input.usesRemaining)}`,
    };
}

function formatScore(score: number): string {
    const normalized = Math.max(0, Math.floor(score)).toString();
    return normalized.length >= 2 ? normalized : `0${normalized}`;
}
