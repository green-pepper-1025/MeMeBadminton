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
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property
    public moveSpeed: number = 400;

    @property({ type: Enum(KeyCode) })
    public leftKey: KeyCode = KeyCode.KEY_A;

    @property({ type: Enum(KeyCode) })
    public rightKey: KeyCode = KeyCode.KEY_D;

    @property({ type: Enum(KeyCode) })
    public jumpKey: KeyCode = KeyCode.KEY_W;

    // 挥拍键 —— 上挥和下挥
    @property({ type: Enum(KeyCode) })
    public swingUpKey: KeyCode = KeyCode.KEY_W;

    @property({ type: Enum(KeyCode) })
    public swingDownKey: KeyCode = KeyCode.KEY_S;

    @property({ type: Enum(KeyCode) })
    public skillKey: KeyCode = KeyCode.SPACE;

    @property
    public minX: number = -600;
    @property
    public maxX: number = 600;

    @property
    public jumpSpeed: number = 720;

    @property
    public gravity: number = 1800;

    // 击球力度
    @property
    public hitForceY: number = 800;
    @property
    public hitForceX: number = 300;

    // 击球力度基础值（普通击球）
    @property
    public hitForceBase: number = 800;

    // 角度对垂直力的影响系数（度 -> 力）
    @property
    public angleToForceScale: number = 15;

    @property
    public swingAngleUp: number = 30; // 上挥时球拍向上旋转的角度（度）
    @property
    public swingAngleDown: number = -30; // 下挥时向下旋转的角度
    @property
    public swingDuration: number = 0.08; // 挥动持续秒数
    @property
    public swingRecoverDuration: number = 0.12; // 恢复时间

    // 球拍子节点（需要在属性里拖入）
    @property(Node)
    public racketNode: Node = null;

    // 羽毛球节点（也拖入）
    @property(Node)
    public shuttlecockNode: Node = null;

    // 击球判定的最大距离
    @property
    public hitRange: number = 80;

    @property
    public playerId: number = 1; // 1 或 2，在编辑器里给 Player1 设为 1，Player2 设为 2

    @property
    public isLocalControlled: boolean = true;

    private _moveDirection: number = 0;
    private _isSwingUp: boolean = false;
    private _isSwingDown: boolean = false;
    private _hitLocked: boolean = false;
    private _verticalSpeed: number = 0;
    private _groundY: number = -250;
    private _isGrounded: boolean = true;

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
        } else if (event.keyCode === this.swingUpKey) {
            command = { playerId: this.playerId, type: CommandType.SWING_UP, timestamp: Date.now() };
        } else if (event.keyCode === this.swingDownKey) {
            command = { playerId: this.playerId, type: CommandType.SWING_DOWN, timestamp: Date.now() };
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
        } else if (event.keyCode === this.swingUpKey) {
            this._isSwingUp = false;
            this._hitLocked = false;
        } else if (event.keyCode === this.swingDownKey) {
            this._isSwingDown = false;
            this._hitLocked = false;
        }
    }

    public handleCommand(command: PlayerCommand): void {
        if (command.playerId !== this.playerId) {
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
            case CommandType.SWING_UP:
                this._isSwingUp = true;
                this.playSwingAnimation(true);
                this.onSwing();
                break;
            case CommandType.SWING_DOWN:
                this._isSwingDown = true;
                this.playSwingAnimation(false);
                this.onSwing();
                break;
            case CommandType.USE_SKILL:
                this.useSkill();
                break;
        }
    }

    // 挥拍时触发的逻辑（击球 + 发球尝试）
    private onSwing() {
        if (!this.racketNode) return;

        // 1. 先尝试发球（如果处于发球状态）
        if (this._gameManager && this._gameManager.tryServe) {
            const racketWorldPos = this.racketNode.worldPosition;
            const facingRight = this.playerId === 1; // P1 朝右，P2 朝左
            this._gameManager.tryServe(this.playerId, racketWorldPos, facingRight);
        }

        // 2. 如果球已经在场上，进行正常击球检测
        if (this.shuttlecockNode && this.shuttlecockNode.active) {
            this.checkAndHit();
        }
    }

    private useSkill(): void {
        if (this._gameManager && this._gameManager.tryUseSkill) {
            this._gameManager.tryUseSkill(this.playerId);
        }
    }

    private playSwingAnimation(isUp: boolean) {
        if (!this.racketNode) return;

        // 停止球拍上正在进行的动画，防止冲突
        tween(this.racketNode).stop();

        const targetAngle = isUp ? this.swingAngleUp : this.swingAngleDown;
        // 挥动到目标角度
        tween(this.racketNode)
            .to(this.swingDuration, { eulerAngles: new Vec3(0, 0, targetAngle) }, { easing: 'quadOut' })
            // 恢复原角度
            .to(this.swingRecoverDuration, { eulerAngles: new Vec3(0, 0, 0) }, { easing: 'quadIn' })
            .start();
    }

    private jump(): void {
        if (!this._isGrounded) {
            return;
        }

        this._isGrounded = false;
        this._verticalSpeed = this.jumpSpeed;
    }

    private checkAndHit(): boolean {
        // 获取球拍的世界坐标
        const racketWorldPos = this.racketNode.getWorldPosition();
        const ballWorldPos = this.shuttlecockNode.getWorldPosition();

        // 计算水平与垂直距离
        const dx = ballWorldPos.x - racketWorldPos.x;
        const dy = ballWorldPos.y - racketWorldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.hitRange) {
            const ballBody = this.shuttlecockNode.getComponent(RigidBody2D);
            if (ballBody) {
                if (this._gameManager?.canApplyBallPhysics && !this._gameManager.canApplyBallPhysics()) {
                    return false;
                }

                if (this._hitLocked) {
                    return;
                }

                // 根据玩家方向确定水平力方向
                const dirX = this.playerId === 1 ? 1 : -1;
                // 上挥时垂直力度向上，下挥时可向下或较小向上
                const forceY = this._isSwingUp ? this.hitForceY : this.hitForceY * 0.5;
                const impulse = new Vec2(this.hitForceX * dirX, forceY);
                ballBody.applyLinearImpulseToCenter(impulse, true);
                // 防止一帧内多次击打（松开键前只打一次，可通过添加冷却，这里简单置位）
                this._hitLocked = true;
                if (this._gameManager && this._gameManager.onPlayerHitBall) {
                    this._gameManager.onPlayerHitBall(this.playerId);
                }
                return true;
            }
        }

        return false;
    }

    update(deltaTime: number) {
        // 移动
        if (this._moveDirection !== 0) {
            const newX = this.node.position.x + this._moveDirection * this.moveSpeed * deltaTime;
            const clampedX = Math.max(this.minX, Math.min(this.maxX, newX));
            this.node.setPosition(clampedX, this.node.position.y, this.node.position.z);
        }

        if (!this._isGrounded) {
            this._verticalSpeed -= this.gravity * deltaTime;
            const nextY = this.node.position.y + this._verticalSpeed * deltaTime;

            if (nextY <= this._groundY) {
                this.node.setPosition(this.node.position.x, this._groundY, this.node.position.z);
                this._verticalSpeed = 0;
                this._isGrounded = true;
            } else {
                this.node.setPosition(this.node.position.x, nextY, this.node.position.z);
            }
        }

        // 挥拍击球检测
        if ((this._isSwingUp || this._isSwingDown) && this.racketNode && this.shuttlecockNode) {
            this.checkAndHit();
        }
    }
}
