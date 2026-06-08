import { _decorator, Component, Collider2D, Contact2DType, IPhysics2DContact } from 'cc';
const { ccclass } = _decorator;

@ccclass('FloorCollision')
export class FloorCollision extends Component {
    private _cooldown: boolean = false;

    onLoad() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            console.log('[FloorCollision] 监听已注册');
        }
    }

    private onBeginContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null,
    ): void {
        console.log('[FloorCollision] 碰撞触发，对方:', otherCollider.node.name);
        if (this._cooldown) return;
        if (otherCollider.node.name === 'Shuttlecock') {
            this._cooldown = true;

            // 用字符串查找组件，避免导入自定义类
            const gm = this.node.scene.getComponentInChildren('GameManager') as any;
            if (gm && gm.onBallLanded) {
                console.log('[FloorCollision] 调用 onBallLanded');
                gm.onBallLanded(otherCollider.node.worldPosition.x);
            } else {
                console.error('[FloorCollision] 未找到 GameManager 组件');
            }

            this.scheduleOnce(() => {
                this._cooldown = false;
            }, 1);
        }
    }
}
