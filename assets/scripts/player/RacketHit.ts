import { _decorator, Component, RigidBody2D, Collider2D, Contact2DType, IPhysics2DContact, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RacketHit')
export class RacketHit extends Component {

    // 击球向上的力度
    @property
    public hitForceY: number = 800;

    // 击球水平方向的力度（根据球拍朝向可能更改符号）
    @property
    public hitForceX: number = 300;

    onLoad() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        // 检测碰到的是不是羽毛球
        if (otherCollider.node.name.includes('Shuttle')) {
            const ballBody = otherCollider.getComponent(RigidBody2D);
            if (ballBody) {
                // 根据球拍所在玩家决定击球水平方向
                // 左侧玩家的球拍向右击球，右侧玩家的球拍向左击球
                let xDir = 1;
                if (this.node.parent.name === 'Player2') {
                    xDir = -1;
                }

                const impulse = new Vec2(this.hitForceX * xDir, this.hitForceY);
                ballBody.applyLinearImpulseToCenter(impulse, true);
            }
        }
    }
}