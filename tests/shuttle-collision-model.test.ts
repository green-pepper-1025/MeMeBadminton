import {
    getActivationPreviousX,
    resolveCeilingCollision,
    resolveNetCollision,
    resolveSideWallCollision,
} from '../assets/scripts/ball/ShuttleCollisionModel';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertClose(actual: number, expected: number, message: string): void {
    if (Math.abs(actual - expected) > 0.0001) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function testLowShuttleHitsNetWhenCrossingCenterLine(): void {
    const result = resolveNetCollision({
        previousX: -12,
        currentX: 14,
        velocityX: 300,
        velocityY: 240,
        netX: 0,
        netHalfThickness: 10,
        shuttleRadius: 12,
        shuttleHeight: 80,
        netHeight: 140,
        netReboundRatio: 0.18,
        netVerticalDamping: 0.25,
        netMinFallSpeed: 180,
    });

    assert(result.collided, 'low shuttle crossing the net collides');
    assert(result.nextX < 0, 'net collision keeps shuttle on the incoming side');
    assertClose(result.nextVelocityX, -54, 'net collision lightly rebounds and damps horizontal velocity');
    assertClose(result.nextVelocityY, -180, 'net collision forces a downward fall');
}

function testHighShuttleClearsNet(): void {
    const result = resolveNetCollision({
        previousX: -12,
        currentX: 14,
        velocityX: 300,
        velocityY: 240,
        netX: 0,
        netHalfThickness: 10,
        shuttleRadius: 12,
        shuttleHeight: 180,
        netHeight: 140,
        netReboundRatio: 0.18,
        netVerticalDamping: 0.25,
        netMinFallSpeed: 180,
    });

    assert(!result.collided, 'high shuttle crossing the net is allowed through');
}

function testSideWallReflectsAndClampsInsideCourt(): void {
    const result = resolveSideWallCollision({
        currentX: -650,
        velocityX: -420,
        velocityY: 160,
        leftWallX: -640,
        rightWallX: 640,
        shuttleRadius: 12,
        wallRestitution: 0.45,
        wallVerticalRetention: 0.9,
    });

    assert(result.collided, 'shuttle outside left wall collides');
    assertClose(result.nextX, -628, 'wall collision clamps shuttle inside playable area');
    assertClose(result.nextVelocityX, 189, 'wall collision reverses and damps horizontal speed');
    assertClose(result.nextVelocityY, 144, 'wall collision preserves most vertical speed');
}

function testCeilingReflectsDownAndClampsBelowBoundary(): void {
    const result = resolveCeilingCollision({
        currentY: 716,
        velocityX: 260,
        velocityY: 500,
        ceilingY: 700,
        shuttleRadius: 12,
        ceilingRestitution: 0.45,
        ceilingPushDown: 4,
        ceilingMinFallSpeed: 120,
        ceilingMaxFallSpeed: 420,
    });

    assert(result.collided, 'upward shuttle above ceiling collides');
    assertClose(result.nextY, 684, 'ceiling collision clamps shuttle below top boundary');
    assertClose(result.nextVelocityX, 260, 'ceiling collision preserves horizontal velocity');
    assertClose(result.nextVelocityY, -225, 'ceiling collision reverses and damps vertical speed');
}

function testCeilingAppliesMinimumDownwardSpeedAfterWeakBounce(): void {
    const result = resolveCeilingCollision({
        currentY: 713,
        velocityX: -80,
        velocityY: 90,
        ceilingY: 700,
        shuttleRadius: 12,
        ceilingRestitution: 0.6,
        ceilingPushDown: 3,
        ceilingMinFallSpeed: 120,
        ceilingMaxFallSpeed: 420,
    });

    assert(result.collided, 'weak upward shuttle above ceiling collides');
    assertClose(result.nextVelocityY, -120, 'ceiling collision enforces a minimum downward speed');
}

function testCeilingLimitsVeryFastBounce(): void {
    const result = resolveCeilingCollision({
        currentY: 720,
        velocityX: 180,
        velocityY: 1600,
        ceilingY: 700,
        shuttleRadius: 12,
        ceilingRestitution: 0.45,
        ceilingPushDown: 4,
        ceilingMinFallSpeed: 120,
        ceilingMaxFallSpeed: 420,
    });

    assert(result.collided, 'very fast upward shuttle above ceiling collides');
    assertClose(result.nextVelocityY, -420, 'ceiling collision caps excessive downward bounce speed');
}

function testActivationResetsPreviousXWhenBallWasInactive(): void {
    const previousX = getActivationPreviousX({
        currentX: -480,
        previousX: 0,
        wasActive: false,
    });

    assertClose(previousX, -480, 'new serve starts collision history from the racket position');
}

testLowShuttleHitsNetWhenCrossingCenterLine();
testHighShuttleClearsNet();
testSideWallReflectsAndClampsInsideCourt();
testCeilingReflectsDownAndClampsBelowBoundary();
testCeilingAppliesMinimumDownwardSpeedAfterWeakBounce();
testCeilingLimitsVeryFastBounce();
testActivationResetsPreviousXWhenBallWasInactive();
