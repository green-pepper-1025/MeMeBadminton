import { chooseHitAction, chooseHitActionFromPoints, isShuttleInHitRange } from '../assets/scripts/core/HitDecision';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

const config = {
    hitRangeX: 90,
    hitRangeY: 130,
    lowHitThreshold: -25,
    highHitMinY: 35,
};

function testRejectsShuttleOutsideRectangularHitRange(): void {
    assertEqual(isShuttleInHitRange(91, 0, config), false, 'shuttle outside horizontal range is rejected');
    assertEqual(isShuttleInHitRange(0, 131, config), false, 'shuttle outside vertical range is rejected');
}

function testChoosesLowHitBelowLowThreshold(): void {
    assertEqual(chooseHitAction(20, -26, config), 'low', 'low shuttle uses low hit action');
}

function testChoosesHighHitAtOrAboveLowThreshold(): void {
    assertEqual(chooseHitAction(20, -25, config), 'high', 'mid shuttle uses high hit action');
    assertEqual(chooseHitAction(20, 36, config), 'high', 'high shuttle uses high hit action');
}

function testRejectsHitActionOutsideRange(): void {
    assertEqual(chooseHitAction(91, 36, config), null, 'out-of-range shuttle has no hit action');
}

function testChoosesHitActionFromHitPointInsteadOfPlayerCenter(): void {
    const shuttle = { x: 370, y: -160 };
    const hitPoint = { x: 367, y: -165 };
    const playerCenter = { x: 500, y: -250 };

    assertEqual(
        chooseHitAction(shuttle.x - playerCenter.x, shuttle.y - playerCenter.y, config),
        null,
        'shuttle near Player2 racket is outside the player-centered hit range'
    );
    assertEqual(
        chooseHitActionFromPoints(shuttle, hitPoint, config),
        'high',
        'shuttle near Player2 racket uses the hit point for hit selection'
    );
}

testRejectsShuttleOutsideRectangularHitRange();
testChoosesLowHitBelowLowThreshold();
testChoosesHighHitAtOrAboveLowThreshold();
testRejectsHitActionOutsideRange();
testChoosesHitActionFromHitPointInsteadOfPlayerCenter();
