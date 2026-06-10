import {
    applyNailongSkillEffect,
    clearNailongSkillEffect,
    DEFAULT_NAILONG_SKILL_CONFIG,
    NAILONG_SPECIAL_SKILL_ID,
    updateNailongSkillEffect,
} from '../assets/scripts/skill/NailongSkillModel';

interface TestScale {
    x: number;
    y: number;
    z: number;
}

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

function assertClose(actual: number, expected: number, message: string): void {
    if (Math.abs(actual - expected) > 0.0001) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function createState() {
    return {
        hitRange: 80,
        hitRangeX: 90,
        hitRangeY: 120,
        scale: { x: 1, y: 1.2, z: 1 } as TestScale,
    };
}

function testDefaultNailongConfig(): void {
    assertEqual(DEFAULT_NAILONG_SKILL_CONFIG.duration, 20, 'default Nailong special duration is 20 seconds');
    assertEqual(DEFAULT_NAILONG_SKILL_CONFIG.hitRangeMultiplier, 3, 'default Nailong hit range multiplier is 3');
    assertEqual(DEFAULT_NAILONG_SKILL_CONFIG.visualScaleMultiplier, 1.35, 'default Nailong visual scale multiplier is 1.35');
}

function testApplyExpandsRangeAndVisualScale(): void {
    const target = createState();
    const effect = applyNailongSkillEffect(NAILONG_SPECIAL_SKILL_ID, target, null, DEFAULT_NAILONG_SKILL_CONFIG);

    assert(effect !== null, 'duang creates an active effect');
    assertEqual(target.hitRange, 240, 'hitRange expands by multiplier');
    assertEqual(target.hitRangeX, 270, 'hitRangeX expands by multiplier');
    assertEqual(target.hitRangeY, 360, 'hitRangeY expands by multiplier');
    assertClose(target.scale.x, 1.35, 'scale x expands by visual multiplier');
    assertClose(target.scale.y, 1.62, 'scale y expands by visual multiplier');
    assertClose(target.scale.z, 1, 'scale z is preserved');
    assertEqual(effect?.remaining, 20, 'effect duration starts at default duration');
}

function testRepeatedApplyDoesNotStackMultipliers(): void {
    const target = createState();
    let effect = applyNailongSkillEffect(NAILONG_SPECIAL_SKILL_ID, target, null, DEFAULT_NAILONG_SKILL_CONFIG);
    effect = updateNailongSkillEffect(effect, target, 4);
    effect = applyNailongSkillEffect(NAILONG_SPECIAL_SKILL_ID, target, effect, DEFAULT_NAILONG_SKILL_CONFIG);

    assert(effect !== null, 'repeated duang keeps an active effect');
    assertEqual(target.hitRange, 240, 'repeated apply does not stack hitRange');
    assertEqual(target.hitRangeX, 270, 'repeated apply does not stack hitRangeX');
    assertEqual(target.hitRangeY, 360, 'repeated apply does not stack hitRangeY');
    assertClose(target.scale.x, 1.35, 'repeated apply does not stack scale x');
    assertClose(target.scale.y, 1.62, 'repeated apply does not stack scale y');
    assertEqual(effect?.remaining, 20, 'repeated apply refreshes duration');
}

function testExpiryRestoresOriginalState(): void {
    const target = createState();
    let effect = applyNailongSkillEffect(NAILONG_SPECIAL_SKILL_ID, target, null, DEFAULT_NAILONG_SKILL_CONFIG);

    effect = updateNailongSkillEffect(effect, target, 20);

    assertEqual(effect, null, 'expired effect is cleared');
    assertEqual(target.hitRange, 80, 'expired effect restores hitRange');
    assertEqual(target.hitRangeX, 90, 'expired effect restores hitRangeX');
    assertEqual(target.hitRangeY, 120, 'expired effect restores hitRangeY');
    assertClose(target.scale.x, 1, 'expired effect restores scale x');
    assertClose(target.scale.y, 1.2, 'expired effect restores scale y');
    assertClose(target.scale.z, 1, 'expired effect restores scale z');
}

function testClearRestoresOriginalState(): void {
    const target = createState();
    const effect = applyNailongSkillEffect(NAILONG_SPECIAL_SKILL_ID, target, null, DEFAULT_NAILONG_SKILL_CONFIG);

    clearNailongSkillEffect(effect, target);

    assertEqual(target.hitRange, 80, 'clear restores hitRange');
    assertEqual(target.hitRangeX, 90, 'clear restores hitRangeX');
    assertEqual(target.hitRangeY, 120, 'clear restores hitRangeY');
    assertClose(target.scale.x, 1, 'clear restores scale x');
    assertClose(target.scale.y, 1.2, 'clear restores scale y');
    assertClose(target.scale.z, 1, 'clear restores scale z');
}

function testNonDuangSkillIsNotAffected(): void {
    const target = createState();
    const effect = applyNailongSkillEffect('helicopter_smash', target, null, DEFAULT_NAILONG_SKILL_CONFIG);

    assertEqual(effect, null, 'non-duang skill does not create an effect');
    assertEqual(target.hitRange, 80, 'non-duang skill does not change hitRange');
    assertClose(target.scale.x, 1, 'non-duang skill does not change visual scale');
}

testDefaultNailongConfig();
testApplyExpandsRangeAndVisualScale();
testRepeatedApplyDoesNotStackMultipliers();
testExpiryRestoresOriginalState();
testClearRestoresOriginalState();
testNonDuangSkillIsNotAffected();
