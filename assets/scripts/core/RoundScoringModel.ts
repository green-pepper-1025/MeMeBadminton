export type RoundScoringGameState = 'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd';

export interface RoundScoringState {
    gameState: RoundScoringGameState;
    hasScoredThisRally: boolean;
}

export function createRoundScoringState(): RoundScoringState {
    return {
        gameState: 'waitingServe',
        hasScoredThisRally: false,
    };
}

export function startNextRally(state: RoundScoringState): void {
    state.gameState = 'playing';
    state.hasScoredThisRally = false;
}

export function lockRoundForScore(state: RoundScoringState): boolean {
    if (state.gameState !== 'playing' || state.hasScoredThisRally) {
        return false;
    }

    state.gameState = 'roundEnd';
    state.hasScoredThisRally = true;
    return true;
}
