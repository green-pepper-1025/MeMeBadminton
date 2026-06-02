import { _decorator, Component, Node, RigidBody2D, Vec2, Label, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    @property(Label)
    public score1Label: Label = null;
    @property(Label)
    public score2Label: Label = null;

    @property(Node)
    public shuttlecock: Node = null;

    @property(Node)
    public netNode: Node = null;   // 拖入球网节点

    @property
    public floorY: number = -350;

    // 发球基础力度
    @property
    public serveForceX: number = 300;   // 水平方向
    @property
    public serveForceY: number = 600;   // 垂直方向

    private _score1: number = 0;
    private _score2: number = 0;

    // 当前状态：'waitingServe' | 'playing'
    private _gameState: string = 'waitingServe';
    // 当前发球方：1 或 2
    private _currentServer: number = 1;

    onLoad() {
        // 游戏开始时，隐藏球
        if (this.shuttlecock) {
            this.shuttlecock.active = false;
        }
        // 让 P1 先发球
        this._gameState = 'waitingServe';
        this._currentServer = 1;
    }

    // 供外部调用：得分后进入发球状态
    private addScoreAndServe(winner: 1 | 2) {
        if (winner === 1) {
            this._score1++;
            this.score1Label.string = this._score1.toString();
        } else {
            this._score2++;
            this.score2Label.string = this._score2.toString();
        }

        // 得分方获得发球权
        this._currentServer = winner;
        this._gameState = 'waitingServe';

        // 隐藏球（其实已经落地隐藏了，但再确保一次）
        if (this.shuttlecock) {
            this.shuttlecock.active = false;
        }
    }

    // 发球：由 PlayerController 调用
    public tryServe(playerId: number, racketWorldPos: Vec3, facingRight: boolean) {
        // 只有处于等待发球状态，且是该玩家发球，才能执行
        if (this._gameState !== 'waitingServe' || playerId !== this._currentServer) {
            return;
        }

        const ball = this.shuttlecock;
        if (!ball) return;

        // 激活球并放到球拍位置
        ball.active = true;
        ball.setWorldPosition(racketWorldPos);

        // 获取球的刚体
        const ballBody = ball.getComponent(RigidBody2D);
        if (ballBody) {
            // 停止之前的任何运动
            ballBody.linearVelocity = new Vec2(0, 0);
            ballBody.angularVelocity = 0;

            // 根据朝向计算发球方向（发球方向总是从发球方面向对方）
            const dirX = facingRight ? 1 : -1;   // 右侧玩家面向左，左侧面向右
            const impulse = new Vec2(this.serveForceX * dirX, this.serveForceY);
            ballBody.applyLinearImpulseToCenter(impulse, true);
        }

        // 进入比赛状态
        this._gameState = 'playing';
    }

    update(deltaTime: number) {
        if (this._gameState !== 'playing' || !this.shuttlecock || !this.shuttlecock.active) return;

        const ballY = this.shuttlecock.worldPosition.y;
        if (ballY <= this.floorY) {
            const ballX = this.shuttlecock.worldPosition.x;
            
            // 获取球网世界 X 坐标作为分界线
            let dividerX = 0;
            if (this.netNode) {
                dividerX = this.netNode.worldPosition.x;
            }
            
            console.log(`[落点] X: ${ballX}, 分界: ${dividerX}, 判定: ${ballX < dividerX ? '左半场 P2得分' : '右半场 P1得分'}`);

            this.shuttlecock.active = false;

            if (ballX < dividerX) {
                this.addScoreAndServe(2);
            } else {
                this.addScoreAndServe(1);
            }
        }
    }
}