import {
    createRoundScoringState,
    lockRoundForScore,
    startNextRally,
} from '../assets/scripts/core/RoundScoringModel';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function testRoundLocksAfterFirstScore(): void {
    const state = createRoundScoringState();
    startNextRally(state);

    const first = lockRoundForScore(state);
    const second = lockRoundForScore(state);

    assertEqual(first, true, 'first score event in a rally is accepted');
    assertEqual(second, false, 'second score event in the same rally is ignored');
    assertEqual(state.gameState, 'roundEnd', 'accepted score immediately locks the rally');
    assertEqual(state.hasScoredThisRally, true, 'accepted score marks the rally as already scored');
}

function testNewRallyClearsScoreLock(): void {
    const state = createRoundScoringState();
    startNextRally(state);
    lockRoundForScore(state);

    startNextRally(state);
    const nextScore = lockRoundForScore(state);

    assertEqual(state.gameState, 'roundEnd', 'new rally can be locked by its own score event');
    assertEqual(nextScore, true, 'new rally accepts one score after serve unlocks it');
}

testRoundLocksAfterFirstScore();
testNewRallyClearsScoreLock();
