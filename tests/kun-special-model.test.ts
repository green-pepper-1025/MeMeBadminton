import {
    buildKunSkillTrajectory,
    DEFAULT_KUN_SKILL_CONFIG,
    getKunSkillPoint,
    isKunSpecialSkill,
    sampleKunSkillTrajectory,
} from '../assets/scripts/skill/KunSkillModel';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function testLeftKunSkillUsesLeftPoint(): void {
    const point = getKunSkillPoint('player1', DEFAULT_KUN_SKILL_CONFIG);

    assertEqual(point.x, DEFAULT_KUN_SKILL_CONFIG.leftKunSkillPoint.x, 'left Kun uses left skill point');
    assertEqual(point.y, DEFAULT_KUN_SKILL_CONFIG.leftKunSkillPoint.y, 'left Kun uses configured airborne point');
}

function testRightKunSkillUsesRightPoint(): void {
    const point = getKunSkillPoint('player2', DEFAULT_KUN_SKILL_CONFIG);

    assertEqual(point.x, DEFAULT_KUN_SKILL_CONFIG.rightKunSkillPoint.x, 'right Kun uses right skill point');
    assertEqual(point.y, DEFAULT_KUN_SKILL_CONFIG.rightKunSkillPoint.y, 'right Kun uses configured airborne point');
}

function testLeftKunTrajectoryMovesRight(): void {
    const trajectory = buildKunSkillTrajectory('player1', DEFAULT_KUN_SKILL_CONFIG);

    assert(trajectory.initialVelocity.x > 0, 'left Kun initial velocity points right');
    assert(
        trajectory.samples[trajectory.samples.length - 1].x > trajectory.samples[0].x,
        'left Kun trajectory advances right',
    );
}

function testRightKunTrajectoryMovesLeft(): void {
    const trajectory = buildKunSkillTrajectory('player2', DEFAULT_KUN_SKILL_CONFIG);

    assert(trajectory.initialVelocity.x < 0, 'right Kun initial velocity points left');
    assert(
        trajectory.samples[trajectory.samples.length - 1].x < trajectory.samples[0].x,
        'right Kun trajectory advances left',
    );
}

function testDefaultKunTrajectoryClearsNetBeforeLanding(): void {
    const floorY = -350;
    const netHeight = 140;
    const requiredNetClearance = 18;
    const leftTrajectory = buildKunSkillTrajectory('player1', DEFAULT_KUN_SKILL_CONFIG);
    const rightTrajectory = buildKunSkillTrajectory('player2', DEFAULT_KUN_SKILL_CONFIG);

    const leftNetSample = sampleKunSkillTrajectory(
        leftTrajectory,
        Math.abs(leftTrajectory.start.x / leftTrajectory.initialVelocity.x),
    );
    const rightNetSample = sampleKunSkillTrajectory(
        rightTrajectory,
        Math.abs(rightTrajectory.start.x / rightTrajectory.initialVelocity.x),
    );

    assert(leftNetSample.y > floorY + netHeight + requiredNetClearance, 'left Kun default trajectory clears the net');
    assert(rightNetSample.y > floorY + netHeight + requiredNetClearance, 'right Kun default trajectory clears the net');
    assert(
        leftTrajectory.samples.every((sample) => sample.y > floorY),
        'left Kun default trajectory does not land during control window',
    );
    assert(
        rightTrajectory.samples.every((sample) => sample.y > floorY),
        'right Kun default trajectory does not land during control window',
    );
}

function testNonKunSpecialSkillIsNotKunRoute(): void {
    assert(!isKunSpecialSkill('helicopter_smash'), 'Kobe special does not use Kun route');
    assert(!isKunSpecialSkill('duang'), 'Nailong special does not use Kun route');
    assert(isKunSpecialSkill('jiyin_dance'), 'Kun special uses Kun route');
}

testLeftKunSkillUsesLeftPoint();
testRightKunSkillUsesRightPoint();
testLeftKunTrajectoryMovesRight();
testRightKunTrajectoryMovesLeft();
testDefaultKunTrajectoryClearsNetBeforeLanding();
testNonKunSpecialSkillIsNotKunRoute();
