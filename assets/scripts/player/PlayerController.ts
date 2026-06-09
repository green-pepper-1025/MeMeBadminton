import {
    _decorator,
    Component,
    Node,
    input,
    Input,
    KeyCode,
    EventKeyboard,
    Enum,
    RigidBody2D,
    Vec2,
    Vec3,
    tween,
} from 'cc';
import { CommandType, PlayerCommand } from '../core/InputRouter';
import { chooseHitAction, HitAction, HitDecisionConfig, isShuttleInHitRange } from '../core/HitDecision';
import { JumpMotion } from '../core/JumpMotion';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property public moveSpeed: number = 400;
    @property({ type: Enum(KeyCode) }) public leftKey: KeyCode = KeyCode.KEY_A;
    @property({ type: Enum(KeyCode) }) public rightKey: KeyCode = KeyCode.KEY_D;
    @property({ type: Enum(KeyCode) }) public jumpKey: KeyCode = KeyCode.KEY_W;
    @property({ type: Enum(KeyCode) }) public strikeKey: KeyCode = KeyCode.KEY_S;
    @property({ type: Enum(KeyCode) }) public swingUpKey: KeyCode = KeyCode.KEY_W;
    @property({ type: Enum(KeyCode) }) public swingDownKey: KeyCode = KeyCode.KEY_S;
    @property({ type: Enum(KeyCode) }) public skillKey: KeyCode = KeyCode.SPACE;

    @property public minX: number = -600;
    @property public maxX: number = 600;

    @property public jumpSpeed: number = 720;
    
    @property public gravity: number = 1800;
    

    // 击球力度
    @property
    public hitForceY: number = 800;
    @property
    public hitForceX: number = 300;

    // 击球力度基础值（普通击球）
    @property
    public hitForceBase: number = 800;

    @property
    public lowHitForceX: number = 180;

    @property
    public lowHitForceY: number = 900;

    // 角度对垂直力的影响系数（度 -> 力）
    @property
    public angleToForceScale: number = 15;

    // 随机仰角范围（度）
    @property public minAngle: number = -10;   // 最小仰角（可向下）
    @property public maxAngle: number = 30;    // 最大仰角

    // 速度范围（与角度联动）
    @property public maxSpeed: number = 150;   // 角度最小时的最高速度
    @property public minSpeed: number = 70;   // 角度最大时的最低速度

    // ---------- 新增肢体节点引用 ----------
    @property(Node) public leftLegNode: Node = null;
    @property(Node) public rightLegNode: Node = null;
    @property(Node) public leftArmNode: Node = null;
    @property(Node) public rightArmNode: Node = null;  // 握拍手臂

    // ---------- 腿部动画参数 ----------
    @property public legSwingSpeed: number = 8;       // 摆动频率
    @property public legSwingAngle: number = 25;      // 最大摆动角度（度）

    // ---------- 手臂动画参数 ----------
    @property public armSwingAngle: number = 15;      // 另一只手臂摆动角度

    // ---------- 挥拍动画参数（现在应用于右手臂） ----------
    @property public swingAngleUp: number = 45;       // 上挥手臂角度（向上抬）
    @property public swingAngleDown: number = -20;    // 下挥手臂角度（向下压）
    @property public swingDuration: number = 0.08;    // 挥动持续秒数
    @property public swingRecoverDuration: number = 0.12;    // 恢复时间
    @property public restArmAngle: number = 60;       // 手臂初始角度（准备姿势）

    // 球拍子节点（需要在属性里拖入）
    @property(Node)
    public racketNode: Node = null;

    // 羽毛球节点（也拖入）
    @property(Node)
    public shuttlecockNode: Node = null;

    // 击球判定
    @property(Node) public hitPointNode: Node = null;   // 击球判定点（球拍上的空节点）
    @property public hitRange: number = 80;
    @property public hitRangeX: number = 80;
    @property public hitRangeY: number = 120;

    @property
    public lowHitThreshold: number = -20;

    @property
    public highHitMinY: number = 20;

    @property
    public hitCooldown: number = 0.18;

    @property
    public playerId: number = 1; // 1 或 2，在编辑器里给 Player1 设为 1，Player2 设为 2

    @property
    public isLocalControlled: boolean = true;



    private _moveDirection: number = 0;
    private _isSwingUp: boolean = false;
    private _isSwingDown: boolean = false;
    private _hitLocked: boolean = false;
    private _hitCooldownRemaining: number = 0;
    private _inputLockRemaining: number = 0;
    private _skillPoseLockRemaining: number = 0;
    private _currentHitAction: HitAction = 'high';
    private _groundY: number = -250;
    private _lastSwingAngle: number = 0;
    private _jumpMotion: JumpMotion = new JumpMotion({
        groundY: this._groundY,
        jumpSpeed: this.jumpSpeed,
        gravity: this.gravity,
    });

    // 引用 GameManager 组件（运行时查找）
    private _gameManager: any = null;

    onLoad() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        this._groundY = this.node.position.y;

        // 查找 GameManager，假设挂在 Canvas/GameManager 节点上
        const gmNode = this.node.scene.getChildByName('Canvas')?.getChildByName('GameManager');
        if (gmNode) {
            this._gameManager = gmNode.getComponent('GameManager');
        }

        if (this.playerId === 2 && this.skillKey === KeyCode.SPACE) {
            this.skillKey = KeyCode.ENTER;
        }
        this.configureDefaultKeysForPlayer2();
        this._jumpMotion.configure({
            groundY: this._groundY,
            jumpSpeed: this.jumpSpeed,
            gravity: this.gravity,
        });
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    private onKeyDown(event: EventKeyboard) {
        if (!this.isLocalControlled) {
            return;
        }

        let command: PlayerCommand = null;
        if (event.keyCode === this.leftKey) {
            command = { playerId: this.playerId, type: CommandType.MOVE_LEFT, timestamp: Date.now() };
        } else if (event.keyCode === this.rightKey) {
            command = { playerId: this.playerId, type: CommandType.MOVE_RIGHT, timestamp: Date.now() };
        } else if (event.keyCode === this.jumpKey) {
            command = { playerId: this.playerId, type: CommandType.JUMP, timestamp: Date.now() };
        } else if (event.keyCode === this.strikeKey) {
            command = { playerId: this.playerId, type: CommandType.STRIKE, timestamp: Date.now() };
        } else if (event.keyCode === this.skillKey) {
            command = { playerId: this.playerId, type: CommandType.USE_SKILL, timestamp: Date.now() };
        }

        if (command) {
            this.handleCommand(command);
            this._gameManager?.onLocalPlayerCommand?.(command);
        }
    }

    private onKeyUp(event: EventKeyboard) {
        if (!this.isLocalControlled) {
            return;
        }

        if (event.keyCode === this.leftKey || event.keyCode === this.rightKey) {
            const command: PlayerCommand = { playerId: this.playerId, type: CommandType.STOP_MOVE, timestamp: Date.now() };
            this.handleCommand(command);
            this._gameManager?.onLocalPlayerCommand?.(command);
        } else if (event.keyCode === this.strikeKey) {
            this._isSwingUp = false;
            this._isSwingDown = false;
        }
    }

    public handleCommand(command: PlayerCommand): void {
        if (command.playerId !== this.playerId) {
            return;
        }

        if (this._inputLockRemaining > 0 && command.type !== CommandType.USE_SKILL) {
            return;
        }

        switch (command.type) {
            case CommandType.MOVE_LEFT:
                this._moveDirection = -1;
                break;
            case CommandType.MOVE_RIGHT:
                this._moveDirection = 1;
                break;
            case CommandType.STOP_MOVE:
                this._moveDirection = 0;
                break;
            case CommandType.JUMP:
                this.jump();
                break;
            case CommandType.STRIKE:
                this.onStrikePressed();
                break;
            case CommandType.SWING_UP:
                this.performHighHit();
                break;
            case CommandType.SWING_DOWN:
                this.performLowHit();
                break;
            case CommandType.USE_SKILL:
                this.useSkill();
                break;
        }
    }

    // 统一击球入口：输入层只发送“击球”，具体动作由球相对玩家的位置决定。
    private onStrikePressed(): void {
        if (!this.shuttlecockNode || !this.shuttlecockNode.active) {
            this.tryServe();
            this.performHighHit(false);
            return;
        }

        const action = this.selectHitAction();
        if (!action) {
            return;
        }

        if (action === 'low') {
            this.performLowHit();
        } else {
            this.performHighHit();
        }
    }

    private tryServe(): void {
        if (!this.racketNode) return;

        if (this._gameManager && this._gameManager.tryServe) {
            const racketWorldPos = this.racketNode.worldPosition;
            const facingRight = this.playerId === 2; // P1 朝右，P2 朝左
            this._gameManager.tryServe(this.playerId, racketWorldPos, facingRight);
        }
    }

    private useSkill(): void {
        if (this._gameManager && this._gameManager.tryUseSkill) {
            this._gameManager.tryUseSkill(this.playerId);
        }
    }

    private configureDefaultKeysForPlayer2(): void {
        if (this.playerId !== 2) {
            return;
        }

        if (this.leftKey === KeyCode.KEY_A) this.leftKey = KeyCode.ARROW_LEFT;
        if (this.rightKey === KeyCode.KEY_D) this.rightKey = KeyCode.ARROW_RIGHT;
        if (this.jumpKey === KeyCode.KEY_W) this.jumpKey = KeyCode.ARROW_UP;
        if (this.strikeKey === KeyCode.KEY_S) this.strikeKey = KeyCode.ARROW_DOWN;
        if (this.skillKey === KeyCode.SPACE) this.skillKey = KeyCode.ENTER;
    }

    private playSwingAnimation(isUp: boolean) {
        if (!this.rightArmNode) {
            this._isSwingUp = false;
            this._isSwingDown = false;
            return;
        }

        tween(this.rightArmNode).stop();
        // 瞬时复位到初始角度 (手臂自然下垂或微曲)
        this.rightArmNode.eulerAngles = new Vec3(0, 0, this.restArmAngle);

        const targetAngle = isUp ? this.swingAngleUp : this.swingAngleDown;
        this._lastSwingAngle = targetAngle;

        tween(this.rightArmNode)
            .to(this.swingDuration, { eulerAngles: new Vec3(0, 0, targetAngle) }, {
                easing: 'quadOut',
                onComplete: () => {
                    this.performHit();
                }
            })
            .to(this.swingRecoverDuration, { eulerAngles: new Vec3(0, 0, this.restArmAngle) }, {
                easing: 'quadIn',
                onComplete: () => {
                    this._isSwingUp = false;
                    this._isSwingDown = false;
                },
            })
            .start();
    }

    public lockSkillInput(duration: number): void {
        this._inputLockRemaining = Math.max(this._inputLockRemaining, duration);
        this._skillPoseLockRemaining = Math.max(this._skillPoseLockRemaining, duration);
        this._moveDirection = 0;
    }

    public playSkillSmashAnimation(): void {
        this._currentHitAction = 'high';
        this._isSwingUp = true;
        this._isSwingDown = false;
        this.playSwingAnimation(true);
    }

    public lockHitAfterSkill(duration: number = this.hitCooldown): void {
        this._hitLocked = true;
        this._hitCooldownRemaining = Math.max(this._hitCooldownRemaining, duration);
    }

    private jump(): void {
        this._jumpMotion.tryJump();
    }

    private performHighHit(tryHit: boolean = true): void {
        this._currentHitAction = 'high';
        this._isSwingUp = true;
        this._isSwingDown = false;
        this.playSwingAnimation(true);
        if (tryHit) {
            this.performHit();
        }
    }

    private performLowHit(): void {
        this._currentHitAction = 'low';
        this._isSwingUp = false;
        this._isSwingDown = true;
        this.playSwingAnimation(false);
        this.performHit();
    }

    private selectHitAction(): HitAction | null {
        if (!this.canHit()) {
            return null;
        }

        const ballWorldPos = this.shuttlecockNode.getWorldPosition();
        const playerWorldPos = this.node.getWorldPosition();
        const dx = ballWorldPos.x - playerWorldPos.x;
        const dy = ballWorldPos.y - playerWorldPos.y;

        return chooseHitAction(dx, dy, this.getHitDecisionConfig());
    }

    private canHit(): boolean {
        return Boolean(this.racketNode && this.shuttlecockNode && this.shuttlecockNode.active && !this._hitLocked);
    }

    private performHit(): boolean {
        if (!this.canHit()) {
            return false;
        }

        const action = this.selectHitAction();
        if (!action) {
            return false;
        }
        this._currentHitAction = action;

        if (this._gameManager?.canApplyBallPhysics && !this._gameManager.canApplyBallPhysics()) {
            return false;
        }

        const ballBody = this.shuttlecockNode.getComponent(RigidBody2D);
        if (!ballBody) {
            return false;
        }

        // 先用随机仰角修复击球手感
        const angle = this.minAngle + Math.random() * (this.maxAngle - this.minAngle);
        const absAngle = Math.abs(angle);
        const angleRad = angle * (Math.PI / 180);

        // 速度：角度越小越快，角度越大越慢
        const speed = this.maxSpeed - (absAngle / this.maxAngle) * (this.maxSpeed - this.minSpeed);

        // 水平方向由玩家朝向决定
        const dirX = this.playerId === 1 ? 1 : -1;
        const vx = Math.cos(angleRad) * speed * dirX;
        const vy = Math.sin(angleRad) * speed;

        const impulse = new Vec2(vx, vy);
        ballBody.applyLinearImpulseToCenter(impulse, true);

        // const dirX = this.playerId === 1 ? 1 : -1;
        // const impulse =
        //     action === 'low'
        //         ? new Vec2(this.lowHitForceX * dirX, this.lowHitForceY)
        //         : new Vec2(this.hitForceX * dirX, this.hitForceY);

        // ballBody.applyLinearImpulseToCenter(impulse, true);
        
        this._hitLocked = true;
        this._hitCooldownRemaining = this.hitCooldown;
        if (this._gameManager && this._gameManager.onPlayerHitBall) {
            this._gameManager.onPlayerHitBall(this.playerId);
        }
        return true;
    }

    private getHitDecisionConfig(): HitDecisionConfig {
        return {
            hitRangeX: this.hitRangeX > 0 ? this.hitRangeX : this.hitRange,
            hitRangeY: this.hitRangeY > 0 ? this.hitRangeY : this.hitRange,
            lowHitThreshold: this.lowHitThreshold,
            highHitMinY: this.highHitMinY,
        };
    }

    private updateHitLock(deltaTime: number): void {
        if (!this._hitLocked) {
            return;
        }

        this._hitCooldownRemaining = Math.max(0, this._hitCooldownRemaining - deltaTime);
        if (!this.shuttlecockNode || !this.shuttlecockNode.active) {
            this._hitLocked = false;
            return;
        }

        if (!this.hitPointNode) {
            // 如果未设置击球点，退化为使用球员节点
            this.hitPointNode = this.racketNode ? this.racketNode : this.node;
        }
        const ballWorldPos = this.shuttlecockNode.getWorldPosition();
        const hitPointWorldPos = this.hitPointNode.getWorldPosition();
        const dx = ballWorldPos.x - hitPointWorldPos.x;
        const dy = ballWorldPos.y - hitPointWorldPos.y;
        const shuttleStillInRange = isShuttleInHitRange(dx, dy, this.getHitDecisionConfig());

        if (!shuttleStillInRange || this._hitCooldownRemaining <= 0) {
            this._hitLocked = false;
        }
    }

    // 更新腿部与左臂（非握拍手）的摆动
    private updateLimbAnimations(_dt: number) {
        const time = Date.now() / 1000; // 或者使用累计时间，这里简单用当前时间
        // 根据移动方向计算摆幅（静止时不摆）
        const active = Math.abs(this._moveDirection) > 0;
        const swingFactor = active ? this._moveDirection : 0; // 正向或反向影响摆动相位

        // 腿的摆动（正弦波，相位差180度）
        const legAngle = active ? Math.sin(time * this.legSwingSpeed) * this.legSwingAngle : 0;
        if (this.leftLegNode) this.leftLegNode.eulerAngles = new Vec3(0, 0, legAngle * swingFactor);
        if (this.rightLegNode) this.rightLegNode.eulerAngles = new Vec3(0, 0, -legAngle * swingFactor);

        // 左臂（非握拍手）自然摆动，与腿协调
        const armAngle = active ? Math.sin(time * this.legSwingSpeed + Math.PI) * this.armSwingAngle : 0;
        if (this.leftArmNode) this.leftArmNode.eulerAngles = new Vec3(0, 0, armAngle * swingFactor);
    }


    update(deltaTime: number) {
        this._inputLockRemaining = Math.max(0, this._inputLockRemaining - deltaTime);
        this._skillPoseLockRemaining = Math.max(0, this._skillPoseLockRemaining - deltaTime);

        // 移动
        if (this._moveDirection !== 0 && this._inputLockRemaining <= 0) {
            const newX = this.node.position.x + this._moveDirection * this.moveSpeed * deltaTime;
            const clampedX = Math.max(this.minX, Math.min(this.maxX, newX));
            this.node.setPosition(clampedX, this.node.position.y, this.node.position.z);
        }

        // 更新腿部摆动和手臂摆动（移动时才动）
        this.updateLimbAnimations(deltaTime);
        this.updateHitLock(deltaTime);

        if (this._skillPoseLockRemaining <= 0) {
            const jumpState = this._jumpMotion.step(this.node.position.y, deltaTime);
            if (jumpState.y !== this.node.position.y) {
                this.node.setPosition(this.node.position.x, jumpState.y, this.node.position.z);
            }
        }

        // 击球动画期间持续检测，避免球在挥动中进入范围却漏判。
        if ((this._isSwingUp || this._isSwingDown) && this.racketNode && this.shuttlecockNode) {
            this.performHit();
        }
    }
}
