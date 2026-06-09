import { _decorator, BoxCollider2D, Component, Node, RigidBody2D, Size, UITransform, Vec2, Vec3 } from 'cc';
import {
    getActivationPreviousX,
    resolveCeilingCollision,
    resolveNetCollision,
    resolveSideWallCollision,
} from './ShuttleCollisionModel';
const { ccclass, property } = _decorator;

interface BallPhysicsGate {
    netNode?: Node;
    floorY?: number;
    canApplyBallPhysics?: () => boolean;
    onBallNetFailed?: (ballX: number) => void;
}

@ccclass('ShuttleCourtCollision')
export class ShuttleCourtCollision extends Component {
    @property(Node)
    public gameManagerNode: Node = null;

    @property(Node)
    public netNode: Node = null;

    @property(Node)
    public leftWallNode: Node = null;

    @property(Node)
    public rightWallNode: Node = null;

    @property(Node)
    public ceilingNode: Node = null;

    @property
    public floorY: number = 30;

    @property
    public shuttleHeight: number = 0;

    @property
    public shuttleRadius: number = 12;

    @property
    public netHeight: number = 140;

    @property
    public netHalfThickness: number = 10;

    @property
    public netReboundRatio: number = 0.18;

    @property
    public netVerticalDamping: number = 0.25;

    @property
    public netMinFallSpeed: number = 180;

    @property
    public leftWallX: number = -640;

    @property
    public rightWallX: number = 640;

    @property
    public wallRestitution: number = 0.45;

    @property
    public wallVerticalRetention: number = 0.9;

    @property
    public ceilingY: number = 700;

    @property
    public ceilingWidth: number = 1280;

    @property
    public ceilingThickness: number = 20;

    @property
    public ceilingRestitution: number = 0.2;

    @property
    public ceilingPushDown: number = 4;

    @property
    public ceilingMinFallSpeed: number = 120;

    @property
    public ceilingMaxFallSpeed: number = 200;

    private _body: RigidBody2D = null;
    private _gameManager: BallPhysicsGate = null;
    private _previousX: number = 0;
    private _wasActive: boolean = false;
    private readonly _nextVelocity: Vec2 = new Vec2();
    private readonly _nextWorldPosition: Vec3 = new Vec3();

    onLoad(): void {
        this._body = this.getComponent(RigidBody2D);
        this.resolveSceneReferences();
        this._previousX = this.node.worldPosition.x;
    }

    public resetFlightState(active: boolean = this.node.active): void {
        this._previousX = this.node.worldPosition.x;
        this._wasActive = active;
    }

    lateUpdate(): void {
        if (!this.node.active) {
            this._wasActive = false;
            return;
        }

        if (!this._body) {
            return;
        }

        if (!this.canApplyBallPhysics()) {
            this._previousX = this.node.worldPosition.x;
            return;
        }

        const worldPosition = this.node.worldPosition;
        const currentX = worldPosition.x;
        this._previousX = getActivationPreviousX({
            currentX,
            previousX: this._previousX,
            wasActive: this._wasActive,
        });
        if (!this._wasActive) {
            this._wasActive = true;
        }

        const velocity = this._body.linearVelocity;
        let nextX = currentX;
        let nextY = worldPosition.y;
        let nextVelocityX = velocity.x;
        let nextVelocityY = velocity.y;

        // 网不是一个纯 2D 墙：低球应撞网，高球应按飞行高度从网上方通过。
        const netResult = resolveNetCollision({
            previousX: this._previousX,
            currentX,
            velocityX: nextVelocityX,
            velocityY: nextVelocityY,
            netX: this.getNetX(),
            netHalfThickness: this.netHalfThickness,
            shuttleRadius: this.shuttleRadius,
            shuttleHeight: this.getApproximateShuttleHeight(worldPosition.y),
            netHeight: this.netHeight,
            netReboundRatio: this.netReboundRatio,
            netVerticalDamping: this.netVerticalDamping,
            netMinFallSpeed: this.netMinFallSpeed,
        });
        if (netResult.collided) {
            nextX = netResult.nextX;
            nextVelocityX = netResult.nextVelocityX;
            nextVelocityY = netResult.nextVelocityY;
            this._gameManager?.onBallNetFailed?.(nextX);
            if (!this.node.active) {
                return;
            }
        }

        // 左右墙只处理横向反弹，纵向速度保留一部分，让球继续自然飞行。
        const wallResult = resolveSideWallCollision({
            currentX: nextX,
            velocityX: nextVelocityX,
            velocityY: nextVelocityY,
            leftWallX: this.getLeftWallX(),
            rightWallX: this.getRightWallX(),
            shuttleRadius: this.shuttleRadius,
            wallRestitution: this.wallRestitution,
            wallVerticalRetention: this.wallVerticalRetention,
        });
        if (wallResult.collided) {
            nextX = wallResult.nextX;
            nextVelocityX = wallResult.nextVelocityX;
            nextVelocityY = wallResult.nextVelocityY;
        }

        const ceilingResult = resolveCeilingCollision({
            currentY: nextY,
            velocityX: nextVelocityX,
            velocityY: nextVelocityY,
            ceilingY: this.getCeilingY(),
            shuttleRadius: this.shuttleRadius,
            ceilingRestitution: this.ceilingRestitution,
            ceilingPushDown: this.ceilingPushDown,
            ceilingMinFallSpeed: this.ceilingMinFallSpeed,
            ceilingMaxFallSpeed: this.ceilingMaxFallSpeed,
        });
        if (ceilingResult.collided) {
            nextY = ceilingResult.nextY;
            nextVelocityX = ceilingResult.nextVelocityX;
            nextVelocityY = ceilingResult.nextVelocityY;
        }

        if (netResult.collided || wallResult.collided || ceilingResult.collided) {
            this._nextWorldPosition.set(nextX, nextY, worldPosition.z);
            this.node.setWorldPosition(this._nextWorldPosition);
            this._nextVelocity.set(nextVelocityX, nextVelocityY);
            this._body.linearVelocity = this._nextVelocity;
            this._body.angularVelocity = 0;
        }

        // 出界/落地/得分优先交给现有 GameManager 与 FloorCollision，避免重复结算。
        this._previousX = this.node.worldPosition.x;
    }

    private resolveSceneReferences(): void {
        const canvas = this.node.scene.getChildByName('Canvas');
        if (!this.gameManagerNode) {
            this.gameManagerNode = canvas?.getChildByName('GameManager') ?? null;
        }

        this._gameManager = (this.gameManagerNode?.getComponent('GameManager') as unknown as BallPhysicsGate) ?? null;

        if (!this.netNode) {
            this.netNode = (this._gameManager?.netNode as Node) ?? canvas?.getChildByName('Background')?.getChildByName('Net') ?? null;
        }

        const walls = canvas?.getChildByName('Walls') ?? null;
        if (!this.leftWallNode) {
            this.leftWallNode = walls?.getChildByName('WallLeft') ?? null;
        }
        if (!this.rightWallNode) {
            this.rightWallNode = walls?.getChildByName('WallRight') ?? null;
        }
        if (!this.ceilingNode) {
            this.ceilingNode =
                walls?.getChildByName('Ceiling') ?? walls?.getChildByName('TopWall') ?? this.createCeilingNode(walls);
        }

        if (typeof this._gameManager?.floorY === 'number') {
            this.floorY = this._gameManager.floorY;
        }
    }

    private canApplyBallPhysics(): boolean {
        if (!this._gameManager?.canApplyBallPhysics) {
            return true;
        }

        return this._gameManager.canApplyBallPhysics();
    }

    private getNetX(): number {
        return this.netNode?.worldPosition.x ?? 0;
    }

    private getLeftWallX(): number {
        return this.leftWallNode?.worldPosition.x ?? this.leftWallX;
    }

    private getRightWallX(): number {
        return this.rightWallNode?.worldPosition.x ?? this.rightWallX;
    }

    private getCeilingY(): number {
        return this.ceilingNode?.worldPosition.y ?? this.ceilingY;
    }

    private createCeilingNode(walls: Node | null): Node | null {
        if (!walls) {
            return null;
        }

        const ceiling = new Node('Ceiling');
        walls.addChild(ceiling);
        ceiling.setWorldPosition(0, this.ceilingY, 0);

        const transform = ceiling.addComponent(UITransform);
        transform.setContentSize(this.ceilingWidth, this.ceilingThickness);

        const collider = ceiling.addComponent(BoxCollider2D);
        collider.sensor = true;
        collider.size = new Size(this.ceilingWidth, this.ceilingThickness);

        return ceiling;
    }

    private getApproximateShuttleHeight(worldY: number): number {
        return Math.max(0, worldY - this.floorY + this.shuttleHeight);
    }
}
