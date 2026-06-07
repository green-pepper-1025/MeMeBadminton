# 03 Online Room Spec

## 一、页面目标

联机房间负责让两名玩家进入同一局游戏，并在人数满足后进入角色选择。

## 二、MVP 模式

首版允许使用本地模拟联机：

- 点击“双人联机”后进入房间等待。
- 本地按钮或调试逻辑模拟第二名玩家加入。
- 两名玩家存在后进入角色选择。

真实 WebSocket 可以后续替换这个模拟层，但页面和数据结构保持不变。

## 三、房间状态

```typescript
enum RoomState {
    CONNECTING = 'connecting',
    WAITING_PLAYER = 'waiting_player',
    READY_FOR_SELECT = 'ready_for_select',
    CLOSED = 'closed',
}
```

## 四、房间数据

```typescript
interface RoomSnapshot {
    roomId: string;
    state: RoomState;
    players: RoomPlayer[];
}

interface RoomPlayer {
    playerId: 'player1' | 'player2';
    displayName: string;
    isLocal: boolean;
    connected: boolean;
}
```

## 五、页面 UI

```text
┌──────────────────────────────┐
│  双人联机                     │
│                              │
│  房间号: ABCD                 │
│                              │
│  P1: 已加入                   │
│  P2: 等待中...                │
│                              │
│  [ 取消 ]                     │
└──────────────────────────────┘
```

两人都加入后：

```text
┌──────────────────────────────┐
│  双人联机                     │
│                              │
│  P1: 已加入                   │
│  P2: 已加入                   │
│                              │
│  正在进入角色选择...           │
└──────────────────────────────┘
```

## 六、交互

### 进入房间

从主页面点击“双人联机”：

1. 设置状态为 `CONNECTING`。
2. 创建或加入房间。
3. 成功后设置状态为 `WAITING_PLAYER`。

### 第二名玩家加入

收到第二名玩家加入事件：

1. 更新 `RoomSnapshot.players`。
2. 设置状态为 `READY_FOR_SELECT`。
3. 进入角色选择页面。

### 取消

点击“取消”：

1. 离开房间。
2. 返回主页面。

## 七、后续 WebSocket 消息

```typescript
enum RoomMessageType {
    ROOM_CREATE = 'room_create',
    ROOM_JOIN = 'room_join',
    ROOM_LEAVE = 'room_leave',
    ROOM_SNAPSHOT = 'room_snapshot',
    ROOM_READY_FOR_SELECT = 'room_ready_for_select',
}
```

MVP 可以先不实现这些消息，但 UI 层不要写死成本地逻辑，后续应能替换为 NetworkManager。

## 八、验收标准

- 从主页面能进入房间页面。
- 房间页面能显示 P1/P2 状态。
- 模拟第二名玩家加入后能进入角色选择。
- 点击取消能回主页面。
