import { buildScoreboardModel, buildSkillMeterModel } from '../assets/scripts/core/BattleHudModel';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function testScoreboardUsesMatchPresentation(): void {
    const model = buildScoreboardModel({
        player1Name: 'KOBE',
        player2Name: 'KUN',
        score1: 3,
        score2: 5,
        roundsWon1: 0,
        roundsWon2: 1,
    });

    assertEqual(model.score1Text, '03', 'P1 score is padded for electronic scoreboard style');
    assertEqual(model.score2Text, '05', 'P2 score is padded for electronic scoreboard style');
    assertEqual(model.player1Name, 'KOBE', 'P1 name is preserved');
    assertEqual(model.player2Name, 'KUN', 'P2 name is preserved');
    assertEqual(model.gameText, 'GAME 2', 'current game is derived from rounds already won');
    assertEqual(model.roundsText, '0 - 1', 'round score is displayed separately from points');
}

function testSkillMeterClampsChargeAndShowsReadyState(): void {
    const charging = buildSkillMeterModel({ charge: 61.8, usesRemaining: 2, isReady: false });
    const ready = buildSkillMeterModel({ charge: 120, usesRemaining: 1, isReady: true });
    const empty = buildSkillMeterModel({ charge: -10, usesRemaining: 0, isReady: false });

    assertEqual(charging.fillRatio, 0.618, 'charge fill ratio keeps normalized precision');
    assertEqual(charging.isFull, false, 'charging meter is not marked full');
    assertEqual(charging.usesText, 'x2', 'remaining uses are formatted for badge display');
    assertEqual(ready.fillRatio, 1, 'ready meter is full');
    assertEqual(ready.isFull, true, 'ready meter is represented visually instead of with READY text');
    assertEqual(empty.fillRatio, 0, 'negative charge is clamped to empty');
    assertEqual(empty.usesText, 'x0', 'zero uses are still visible');
}

testScoreboardUsesMatchPresentation();
testSkillMeterClampsChargeAndShowsReadyState();
