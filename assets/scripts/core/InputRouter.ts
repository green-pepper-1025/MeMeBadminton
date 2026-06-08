import { _decorator, Component, EventKeyboard, input, Input, KeyCode } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 玩家ID枚举（为后期联网预留）
 */
export enum PlayerID {
    PLAYER_1 = 1,
    PLAYER_2 = 2,
}

/**
 * 指令类型枚举
 */
export enum CommandType {
    MOVE_LEFT = 'move_left',
    MOVE_RIGHT = 'move_right',
    SWING_UP = 'swing_up',
    SWING_DOWN = 'swing_down',
    JUMP = 'jump',
    STOP_MOVE = 'stop_move',
    USE_SKILL = 'use_skill',
}

/**
 * 玩家指令接口（后期网络同步的核心数据结构）
 */
export interface PlayerCommand {
    playerId: PlayerID;
    type: CommandType;
    timestamp: number; // 时间戳，用于网络同步时的延迟补偿
}

/**
 * 输入路由器
 * 职责：将键盘事件转换为标准化指令，分发给对应玩家
 */
@ccclass('InputRouter')
export class InputRouter extends Component {
    @property({ tooltip: '玩家1移动速度' })
    moveSpeed: number = 300;

    // 按键映射表（可配置化，方便后期改键位）
    private keyMap: Map<KeyCode, { playerId: PlayerID; type: CommandType }> = new Map();

    // 当前按下的按键集合（用于处理持续移动）
    private activeKeys: Set<KeyCode> = new Set();

    // 玩家控制器引用
    private players: Map<PlayerID, any> = new Map();

    onLoad() {
        this.initKeyMapping();
        this.registerInputEvents();
    }

    /**
     * 初始化按键映射
     */
    private initKeyMapping() {
        // 玩家1：WASD
        this.keyMap.set(KeyCode.KEY_W, { playerId: PlayerID.PLAYER_1, type: CommandType.JUMP });
        this.keyMap.set(KeyCode.KEY_S, { playerId: PlayerID.PLAYER_1, type: CommandType.SWING_DOWN });
        this.keyMap.set(KeyCode.KEY_A, { playerId: PlayerID.PLAYER_1, type: CommandType.MOVE_LEFT });
        this.keyMap.set(KeyCode.KEY_D, { playerId: PlayerID.PLAYER_1, type: CommandType.MOVE_RIGHT });
        this.keyMap.set(KeyCode.SPACE, { playerId: PlayerID.PLAYER_1, type: CommandType.USE_SKILL });

        // 玩家2：方向键
        this.keyMap.set(KeyCode.ARROW_UP, { playerId: PlayerID.PLAYER_2, type: CommandType.JUMP });
        this.keyMap.set(KeyCode.ARROW_DOWN, { playerId: PlayerID.PLAYER_2, type: CommandType.SWING_DOWN });
        this.keyMap.set(KeyCode.ARROW_LEFT, { playerId: PlayerID.PLAYER_2, type: CommandType.MOVE_LEFT });
        this.keyMap.set(KeyCode.ARROW_RIGHT, { playerId: PlayerID.PLAYER_2, type: CommandType.MOVE_RIGHT });
        this.keyMap.set(KeyCode.ENTER, { playerId: PlayerID.PLAYER_2, type: CommandType.USE_SKILL });
    }

    /**
     * 注册输入事件
     */
    private registerInputEvents() {
        // 键盘按下
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        // 键盘抬起
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /**
     * 处理按键按下
     */
    private onKeyDown(event: EventKeyboard) {
        const keyCode = event.keyCode;
        const mapping = this.keyMap.get(keyCode);

        if (!mapping) return;

        // 记录按键状态
        this.activeKeys.add(keyCode);

        // 创建并分发指令
        const command: PlayerCommand = {
            playerId: mapping.playerId,
            type: mapping.type,
            timestamp: Date.now(),
        };

        this.dispatchCommand(command);
    }

    /**
     * 处理按键抬起
     */
    private onKeyUp(event: EventKeyboard) {
        const keyCode = event.keyCode;
        const mapping = this.keyMap.get(keyCode);

        if (!mapping) return;

        // 移除按键状态
        this.activeKeys.delete(keyCode);

        // 如果是移动键，发送停止指令
        if (mapping.type === CommandType.MOVE_LEFT || mapping.type === CommandType.MOVE_RIGHT) {
            const command: PlayerCommand = {
                playerId: mapping.playerId,
                type: CommandType.STOP_MOVE,
                timestamp: Date.now(),
            };
            this.dispatchCommand(command);
        }
    }

    /**
     * 分发指令给对应玩家
     */
    private dispatchCommand(command: PlayerCommand) {
        const player = this.players.get(command.playerId);
        if (player && player.handleCommand) {
            player.handleCommand(command);
        } else {
            console.warn(`Player ${command.playerId} not found or has no handleCommand method`);
        }
    }

    /**
     * 注册玩家控制器（由 PlayerController 调用）
     */
    public registerPlayer(playerId: PlayerID, controller: any) {
        this.players.set(playerId, controller);
        console.log(`Player ${playerId} registered`);
    }

    /**
     * 获取当前按下的移动方向（用于持续移动）
     */
    public getMoveDirection(playerId: PlayerID): number {
        let direction = 0;

        for (const keyCode of this.activeKeys) {
            const mapping = this.keyMap.get(keyCode);
            if (mapping && mapping.playerId === playerId) {
                if (mapping.type === CommandType.MOVE_LEFT) direction -= 1;
                if (mapping.type === CommandType.MOVE_RIGHT) direction += 1;
            }
        }

        return direction; // -1: 左, 0: 停止, 1: 右
    }

    update(dt: number) {
        // 每帧检查持续移动（处理按住按键的情况）
        for (const playerId of [PlayerID.PLAYER_1, PlayerID.PLAYER_2]) {
            const direction = this.getMoveDirection(playerId);
            if (direction !== 0) {
                const command: PlayerCommand = {
                    playerId,
                    type: direction < 0 ? CommandType.MOVE_LEFT : CommandType.MOVE_RIGHT,
                    timestamp: Date.now(),
                };
                this.dispatchCommand(command);
            }
        }
    }
}
