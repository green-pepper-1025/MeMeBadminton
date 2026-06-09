import {
    buildKobeSkillShot,
    DEFAULT_KOBE_SKILL_CONFIG,
    getKobeSkillPoint,
} from '../assets/scripts/skill/KobeSpecialModel';

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function testLeftKobeSkillShotCrossesToRightDownCourt(): void {
    const point = getKobeSkillPoint('player1', DEFAULT_KOBE_SKILL_CONFIG);
    const shot = buildKobeSkillShot('player1', DEFAULT_KOBE_SKILL_CONFIG);

    assertEqual(point.x, DEFAULT_KOBE_SKILL_CONFIG.leftKobeSkillPoint.x, 'left Kobe uses left skill point');
    assertEqual(point.y, DEFAULT_KOBE_SKILL_CONFIG.leftKobeSkillPoint.y, 'left Kobe skill point is airborne');
    assertEqual(shot.velocity.x, DEFAULT_KOBE_SKILL_CONFIG.kobeSkillHorizontalSpeed, 'left Kobe shoots right');
    assertEqual(
        shot.velocity.y,
        -(DEFAULT_KOBE_SKILL_CONFIG.kobeSkillVerticalSpeed + DEFAULT_KOBE_SKILL_CONFIG.kobeSkillDownwardForce),
        'left Kobe shoots downward with configured downward force',
    );
}

function testRightKobeSkillShotCrossesToLeftDownCourt(): void {
    const point = getKobeSkillPoint('player2', DEFAULT_KOBE_SKILL_CONFIG);
    const shot = buildKobeSkillShot('player2', DEFAULT_KOBE_SKILL_CONFIG);

    assertEqual(point.x, DEFAULT_KOBE_SKILL_CONFIG.rightKobeSkillPoint.x, 'right Kobe uses right skill point');
    assertEqual(point.y, DEFAULT_KOBE_SKILL_CONFIG.rightKobeSkillPoint.y, 'right Kobe skill point is airborne');
    assertEqual(shot.velocity.x, -DEFAULT_KOBE_SKILL_CONFIG.kobeSkillHorizontalSpeed, 'right Kobe shoots left');
    assertEqual(
        shot.velocity.y,
        -(DEFAULT_KOBE_SKILL_CONFIG.kobeSkillVerticalSpeed + DEFAULT_KOBE_SKILL_CONFIG.kobeSkillDownwardForce),
        'right Kobe shoots downward with configured downward force',
    );
}

function testDefaultKobeSkillShotClearsNetBeforeLanding(): void {
    const floorY = -350;
    const netHeight = 140;
    const ballOffsetY = -24;
    const requiredNetClearance = 18;
    const leftShot = buildKobeSkillShot('player1', DEFAULT_KOBE_SKILL_CONFIG);
    const rightShot = buildKobeSkillShot('player2', DEFAULT_KOBE_SKILL_CONFIG);

    const leftStartY = leftShot.skillPoint.y + ballOffsetY;
    const leftTimeToNet = Math.abs(leftShot.skillPoint.x / leftShot.velocity.x);
    const leftYAtNet = leftStartY + leftShot.velocity.y * leftTimeToNet;

    const rightStartY = rightShot.skillPoint.y + ballOffsetY;
    const rightTimeToNet = Math.abs(rightShot.skillPoint.x / rightShot.velocity.x);
    const rightYAtNet = rightStartY + rightShot.velocity.y * rightTimeToNet;

    assert(leftYAtNet > floorY + netHeight + requiredNetClearance, 'left Kobe default shot should clear the net');
    assert(rightYAtNet > floorY + netHeight + requiredNetClearance, 'right Kobe default shot should clear the net');
}

testLeftKobeSkillShotCrossesToRightDownCourt();
testRightKobeSkillShotCrossesToLeftDownCourt();
testDefaultKobeSkillShotClearsNetBeforeLanding();
