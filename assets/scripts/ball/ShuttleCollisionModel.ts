export interface NetCollisionInput {
    previousX: number;
    currentX: number;
    velocityX: number;
    velocityY: number;
    netX: number;
    netHalfThickness: number;
    shuttleRadius: number;
    shuttleHeight: number;
    netHeight: number;
    netReboundRatio: number;
    netVerticalDamping: number;
    netMinFallSpeed: number;
}

export interface SideWallCollisionInput {
    currentX: number;
    velocityX: number;
    velocityY: number;
    leftWallX: number;
    rightWallX: number;
    shuttleRadius: number;
    wallRestitution: number;
    wallVerticalRetention: number;
}

export interface CeilingCollisionInput {
    currentY: number;
    velocityX: number;
    velocityY: number;
    ceilingY: number;
    shuttleRadius: number;
    ceilingRestitution: number;
    ceilingPushDown: number;
    ceilingMinFallSpeed: number;
}

export interface CollisionResult {
    collided: boolean;
    nextX: number;
    nextVelocityX: number;
    nextVelocityY: number;
}

export interface CeilingCollisionResult {
    collided: boolean;
    nextY: number;
    nextVelocityX: number;
    nextVelocityY: number;
}

export interface ActivationHistoryInput {
    currentX: number;
    previousX: number;
    wasActive: boolean;
}

export function getActivationPreviousX(input: ActivationHistoryInput): number {
    return input.wasActive ? input.previousX : input.currentX;
}

export function resolveNetCollision(input: NetCollisionInput): CollisionResult {
    const collisionBand = Math.max(0, input.netHalfThickness) + Math.max(0, input.shuttleRadius);
    const wasLeft = input.previousX <= input.netX;
    const isLeft = input.currentX <= input.netX;
    const crossedNet = wasLeft !== isLeft;
    const insideNetBand = Math.abs(input.currentX - input.netX) <= collisionBand;
    const movingIntoNet =
        (wasLeft && input.velocityX > 0 && input.currentX >= input.netX - collisionBand) ||
        (!wasLeft && input.velocityX < 0 && input.currentX <= input.netX + collisionBand);

    if (input.shuttleHeight >= input.netHeight || (!crossedNet && (!insideNetBand || !movingIntoNet))) {
        return {
            collided: false,
            nextX: input.currentX,
            nextVelocityX: input.velocityX,
            nextVelocityY: input.velocityY,
        };
    }

    const incomingFromLeft = wasLeft || input.velocityX > 0;
    const nextX = input.netX + (incomingFromLeft ? -collisionBand : collisionBand);
    const reboundSign = incomingFromLeft ? -1 : 1;
    const nextVelocityX = reboundSign * Math.abs(input.velocityX) * input.netReboundRatio;
    const dampedY = input.velocityY * input.netVerticalDamping;
    const nextVelocityY = Math.min(dampedY, -Math.abs(input.netMinFallSpeed));

    return {
        collided: true,
        nextX,
        nextVelocityX,
        nextVelocityY,
    };
}

export function resolveSideWallCollision(input: SideWallCollisionInput): CollisionResult {
    const minX = input.leftWallX + input.shuttleRadius;
    const maxX = input.rightWallX - input.shuttleRadius;

    if (input.currentX < minX && input.velocityX < 0) {
        return {
            collided: true,
            nextX: minX,
            nextVelocityX: Math.abs(input.velocityX) * input.wallRestitution,
            nextVelocityY: input.velocityY * input.wallVerticalRetention,
        };
    }

    if (input.currentX > maxX && input.velocityX > 0) {
        return {
            collided: true,
            nextX: maxX,
            nextVelocityX: -Math.abs(input.velocityX) * input.wallRestitution,
            nextVelocityY: input.velocityY * input.wallVerticalRetention,
        };
    }

    return {
        collided: false,
        nextX: input.currentX,
        nextVelocityX: input.velocityX,
        nextVelocityY: input.velocityY,
    };
}

export function resolveCeilingCollision(input: CeilingCollisionInput): CeilingCollisionResult {
    const maxY = input.ceilingY - Math.max(0, input.shuttleRadius);
    const clampedY = maxY - Math.max(0, input.ceilingPushDown);

    if (input.currentY <= maxY || input.velocityY <= 0) {
        return {
            collided: false,
            nextY: input.currentY,
            nextVelocityX: input.velocityX,
            nextVelocityY: input.velocityY,
        };
    }

    const dampedDownwardSpeed = -Math.abs(input.velocityY) * Math.max(0, input.ceilingRestitution);
    const minimumDownwardSpeed = -Math.abs(input.ceilingMinFallSpeed);

    return {
        collided: true,
        nextY: clampedY,
        nextVelocityX: input.velocityX,
        nextVelocityY: Math.min(dampedDownwardSpeed, minimumDownwardSpeed),
    };
}
