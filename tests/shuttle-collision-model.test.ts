import {
    getActivationPreviousX,
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
testActivationResetsPreviousXWhenBallWasInactive();
