import { _decorator, Component, Node, RigidBody2D, Vec2, Label, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

type GameState = 'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd';

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

    @property
    public pointsToWinRound: number = 11;

    @property
    public roundsToWinMatch: number = 2;

    // 发球基础力度
    @property
    public serveForceX: number = 300;   // 水平方向
    @property
    public serveForceY: number = 600;   // 垂直方向

    private _score1: number = 0;
    private _score2: number = 0;
    private _roundsWon1: number = 0;
    private _roundsWon2: number = 0;

    // 当前状态：'waitingServe' | 'playing' | 'roundEnd' | 'matchEnd'
    private _gameState: GameState = 'waitingServe';
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
    private addScoreAndServe(winner: 1 | 2): void {
        if (winner === 1) {
            this._score1++;
        } else {
            this._score2++;
        }
        this.updateScoreLabels();

        // 得分方获得发球权
        this._currentServer = winner;
        this.resetBall();

        if (this._score1 >= this.pointsToWinRound || this._score2 >= this.pointsToWinRound) {
            this.endRound(winner);
            return;
        }

        this._gameState = 'waitingServe';
    }

    // 发球：由 PlayerController 调用
    public tryServe(playerId: number, racketWorldPos: Vec3, facingRight: boolean): void {
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

    public onBallLanded(ballX: number): void {
        if (this._gameState !== 'playing') {
            return;
        }

        // 获取球网世界 X 坐标作为分界线
        const dividerX = this.netNode ? this.netNode.worldPosition.x : 0;
        const winner = ballX < dividerX ? 2 : 1;

        console.log(
            `[落点] X: ${ballX}, 分界: ${dividerX}, 判定: ${winner === 2 ? '左半场 P2得分' : '右半场 P1得分'}`
        );

        this.addScoreAndServe(winner as 1 | 2);
    }

    private endRound(winner: 1 | 2): void {
        if (winner === 1) {
            this._roundsWon1++;
        } else {
            this._roundsWon2++;
        }

        console.log(`[局结束] P1局数: ${this._roundsWon1}, P2局数: ${this._roundsWon2}`);

        if (this._roundsWon1 >= this.roundsToWinMatch || this._roundsWon2 >= this.roundsToWinMatch) {
            this._gameState = 'matchEnd';
            console.log(`[比赛结束] 获胜方: P${winner}`);
            return;
        }

        this._gameState = 'roundEnd';
        this._score1 = 0;
        this._score2 = 0;
        this.updateScoreLabels();
        this._gameState = 'waitingServe';
    }

    private resetBall(): void {
        if (!this.shuttlecock) {
            return;
        }

        const ballBody = this.shuttlecock.getComponent(RigidBody2D);
        if (ballBody) {
            ballBody.linearVelocity = new Vec2(0, 0);
            ballBody.angularVelocity = 0;
        }

        this.shuttlecock.active = false;
    }

    private updateScoreLabels(): void {
        if (this.score1Label) {
            this.score1Label.string = this._score1.toString();
        }
        if (this.score2Label) {
            this.score2Label.string = this._score2.toString();
        }
    }

    update(deltaTime: number): void {
        if (this._gameState !== 'playing' || !this.shuttlecock || !this.shuttlecock.active) {
            return;
        }

        // 兜底：如果地板碰撞没有配置成功，仍然按高度阈值结算。
        const ballY = this.shuttlecock.worldPosition.y;
        if (ballY <= this.floorY) {
            this.onBallLanded(this.shuttlecock.worldPosition.x);
        }
    }
}
