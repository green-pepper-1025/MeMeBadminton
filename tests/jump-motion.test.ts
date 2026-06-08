import { JumpMotion } from '../assets/scripts/core/JumpMotion';

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

function testJumpMovesPlayerUpAndReturnsToGround(): void {
    const motion = new JumpMotion({ groundY: -250, jumpSpeed: 720, gravity: 1800 });

    assertEqual(motion.tryJump(), true, 'grounded player can start a jump');

    const rising = motion.step(-250, 0.1);
    assert(rising.y > -250, 'jumping player moves above the ground after stepping');
    assertEqual(rising.isGrounded, false, 'player is airborne while rising');

    let state = rising;
    for (let i = 0; i < 60; i++) {
        state = motion.step(state.y, 1 / 60);
    }

    assertEqual(state.y, -250, 'player lands exactly on the configured ground');
    assertEqual(state.isGrounded, true, 'player is grounded after landing');
}

function testCannotStartSecondJumpWhileAirborne(): void {
    const motion = new JumpMotion({ groundY: -250, jumpSpeed: 720, gravity: 1800 });

    assertEqual(motion.tryJump(), true, 'first jump starts');
    assertEqual(motion.tryJump(), false, 'second jump is rejected while airborne');
}

testJumpMovesPlayerUpAndReturnsToGround();
testCannotStartSecondJumpWhileAirborne();
