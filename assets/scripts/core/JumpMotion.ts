export interface JumpMotionOptions {
    groundY: number;
    jumpSpeed: number;
    gravity: number;
}

export interface JumpMotionStep {
    y: number;
    isGrounded: boolean;
}

export class JumpMotion {
    private groundY: number;
    private jumpSpeed: number;
    private gravity: number;
    private verticalSpeed: number = 0;
    private isGrounded: boolean = true;

    constructor(options: JumpMotionOptions) {
        this.groundY = options.groundY;
        this.jumpSpeed = options.jumpSpeed;
        this.gravity = options.gravity;
    }

    public configure(options: JumpMotionOptions): void {
        this.groundY = options.groundY;
        this.jumpSpeed = options.jumpSpeed;
        this.gravity = options.gravity;
        this.verticalSpeed = 0;
        this.isGrounded = true;
    }

    public tryJump(): boolean {
        if (!this.isGrounded) {
            return false;
        }

        this.isGrounded = false;
        this.verticalSpeed = this.jumpSpeed;
        return true;
    }

    public step(currentY: number, deltaTime: number): JumpMotionStep {
        if (this.isGrounded) {
            return {
                y: this.groundY,
                isGrounded: true,
            };
        }

        this.verticalSpeed -= this.gravity * deltaTime;
        const nextY = currentY + this.verticalSpeed * deltaTime;

        if (nextY <= this.groundY) {
            this.verticalSpeed = 0;
            this.isGrounded = true;
            return {
                y: this.groundY,
                isGrounded: true,
            };
        }

        return {
            y: nextY,
            isGrounded: false,
        };
    }
}
