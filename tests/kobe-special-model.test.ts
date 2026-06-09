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

testLeftKobeSkillShotCrossesToRightDownCourt();
testRightKobeSkillShotCrossesToLeftDownCourt();
