import { chooseHitAction, isShuttleInHitRange } from '../assets/scripts/core/HitDecision';

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

testRejectsShuttleOutsideRectangularHitRange();
testChoosesLowHitBelowLowThreshold();
testChoosesHighHitAtOrAboveLowThreshold();
testRejectsHitActionOutsideRange();
