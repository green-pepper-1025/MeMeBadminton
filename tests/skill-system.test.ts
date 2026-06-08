import { SkillSystem } from '../assets/scripts/skill/SkillSystem';

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

function testChargeAndUseConditions(): void {
    const skills = new SkillSystem();
    skills.initializePlayer('player1', 'duang');

    assertEqual(skills.getState('player1').charge, 0, 'initial charge starts at 0');
    assertEqual(skills.tryUseSkill('player1').success, false, 'cannot use skill before full charge');

    skills.update(10);
    assertEqual(skills.getState('player1').charge, 50, 'time charge reaches 50 after 10 seconds');

    skills.addHitCharge('player1');
    assertEqual(skills.getState('player1').charge, 65, 'hit charge adds 15');

    skills.update(20);
    assertEqual(skills.getState('player1').charge, 100, 'charge is capped at 100');

    const result = skills.tryUseSkill('player1');
    assert(result.success, 'can use skill when fully charged');
    assertEqual(result.skillId, 'duang', 'use result contains skill id');
    assertEqual(skills.getState('player1').charge, 0, 'using skill clears charge');
    assertEqual(skills.getState('player1').usesRemaining, 2, 'using skill consumes one use');
}

function testRoundResetAndUseLimit(): void {
    const skills = new SkillSystem();
    skills.initializePlayer('player2', 'helicopter_smash');

    for (let i = 0; i < 3; i++) {
        skills.update(20);
        assert(skills.tryUseSkill('player2').success, `use ${i + 1} succeeds`);
    }

    skills.update(20);
    assertEqual(skills.tryUseSkill('player2').success, false, 'cannot use more than 3 times per round');

    skills.resetRound();
    const state = skills.getState('player2');
    assertEqual(state.charge, 0, 'round reset clears charge');
    assertEqual(state.usesRemaining, 3, 'round reset restores uses');
}

testChargeAndUseConditions();
testRoundResetAndUseLimit();
