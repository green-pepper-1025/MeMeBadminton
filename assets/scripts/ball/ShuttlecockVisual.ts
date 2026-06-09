import { _decorator, Component, RigidBody2D, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ShuttlecockVisual')
export class ShuttlecockVisual extends Component {

    // 如果球图片默认朝上（例如 Y 轴正方向），设为 -90
    // 默认朝右（X 轴正方向），设为 0
    @property
    public angleOffset: number = 0;

    private _rigidbody: RigidBody2D = null;

    onLoad() {
        this._rigidbody = this.getComponent(RigidBody2D);
    }

    update(deltaTime: number) {
        if (!this._rigidbody) return;

        const vel = this._rigidbody.linearVelocity;
        // 忽略极慢速度，避免方向跳动
        if (vel.lengthSqr() < 1) return;

        // 计算速度方向的角度（弧度转度数）
        const angleRad = Math.atan2(vel.y, vel.x);
        const angleDeg = angleRad * (180 / Math.PI) + this.angleOffset;

        this.node.eulerAngles = new Vec3(0, 0, angleDeg);
    }
}

